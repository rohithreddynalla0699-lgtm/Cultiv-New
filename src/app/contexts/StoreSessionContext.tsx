/**
 * CULTIV Store Session Context
 *
 * Backend-backed source of truth for "who is currently operating in this store".
 * sessionStorage is kept only as a UX cache and is never trusted as the active source of truth.
 */

import React, { createContext, useCallback, useEffect, useRef, useState } from 'react';
import {
  StoreEmployeeSession,
  StoreSessionContextValue,
  CreateEmployeeSessionResult,
  EndEmployeeSessionResult,
  STORE_SESSION_STORAGE_KEY,
  SESSION_INACTIVITY_TIMEOUT_MS,
  SESSION_EXPIRING_WARNING_MS,
} from '../types/storeSession';
import {
  endStoreOperatorSession,
  getStoreOperatorSession,
  startStoreOperatorSession,
  touchStoreOperatorSession,
  type InternalStoreOperatorSession,
} from '../lib/internalOpsApi';

const ADMIN_ACCESS_SESSION_STORAGE_KEY = 'cultiv_admin_access_session_v1';
const INTERNAL_ACCESS_SESSION_UPDATED_EVENT = 'cultiv:internal-access-session-updated';
const TOUCH_THROTTLE_MS = 30 * 1000;

interface InternalAccessSessionSnapshot {
  internalSessionToken: string;
  roleKey: 'owner' | 'admin' | 'store';
  scopeType: 'global' | 'store';
  scopeStoreId: string | null;
}

export const StoreSessionContext = createContext<StoreSessionContextValue | undefined>(
  undefined
);

interface StoreSessionProviderProps {
  children: React.ReactNode;
}

const normalizeInternalAccessSession = (value: unknown): InternalAccessSessionSnapshot | null => {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Record<string, unknown>;
  const internalSessionToken = typeof candidate.internalSessionToken === 'string'
    ? candidate.internalSessionToken.trim()
    : '';
  const roleKey = candidate.roleKey;
  const scopeType = candidate.scopeType;
  const scopeStoreId = typeof candidate.scopeStoreId === 'string' ? candidate.scopeStoreId : null;

  if (!internalSessionToken) return null;
  if (roleKey !== 'owner' && roleKey !== 'admin' && roleKey !== 'store') return null;
  if (scopeType !== 'global' && scopeType !== 'store') return null;

  return {
    internalSessionToken,
    roleKey,
    scopeType,
    scopeStoreId,
  };
};

const readInternalAccessSessionSnapshot = (): InternalAccessSessionSnapshot | null => {
  if (typeof window === 'undefined') return null;

  try {
    const raw = localStorage.getItem(ADMIN_ACCESS_SESSION_STORAGE_KEY);
    if (!raw) return null;
    return normalizeInternalAccessSession(JSON.parse(raw));
  } catch {
    return null;
  }
};

const readStoredSessionCache = (): StoreEmployeeSession | null => {
  if (typeof window === 'undefined') return null;

  try {
    const raw = sessionStorage.getItem(STORE_SESSION_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoreEmployeeSession;
  } catch {
    return null;
  }
};

const mapBackendRoleToStoreSessionRole = (
  role: InternalStoreOperatorSession['employeeRole'],
): 'staff' | 'store_manager' => (role === 'manager' ? 'store_manager' : 'staff');

const mapOperatorSessionToStoreEmployeeSession = (
  operatorSession: InternalStoreOperatorSession,
  previousSession: StoreEmployeeSession | null,
): StoreEmployeeSession => ({
  session_id: operatorSession.id,
  employee_id: operatorSession.employeeId,
  employee_name: operatorSession.employeeName ?? previousSession?.employee_name ?? 'Store Employee',
  employee_role: mapBackendRoleToStoreSessionRole(operatorSession.employeeRole),
  store_id: operatorSession.storeId,
  store_name: previousSession?.store_name ?? 'Active Store',
  shift_id: operatorSession.shiftId,
  clocked_in_at: operatorSession.startedAt,
  clocked_out_at: null,
  session_started_at: operatorSession.startedAt,
  session_expires_at: operatorSession.expiresAt,
  last_activity_at: operatorSession.lastActivityAt,
  is_active: true,
  is_locked: operatorSession.isLocked,
  device_id: operatorSession.deviceId ?? undefined,
  device_name: operatorSession.deviceName ?? undefined,
});

export const StoreSessionProvider: React.FC<StoreSessionProviderProps> = ({
  children,
}) => {
  const [session, setSession] = useState<StoreEmployeeSession | null>(null);
  const [isSessionInitializing, setIsSessionInitializing] = useState(true);
  const [isSessionLoading, setIsSessionLoading] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [isExpiringSoon, setIsExpiringSoon] = useState(false);

  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTouchSentAtRef = useRef(0);
  const sessionRef = useRef<StoreEmployeeSession | null>(null);

  const clearSessionTimers = useCallback(() => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
    if (warningTimerRef.current) {
      clearTimeout(warningTimerRef.current);
      warningTimerRef.current = null;
    }
  }, []);

  const clearLocalSession = useCallback(() => {
    sessionStorage.removeItem(STORE_SESSION_STORAGE_KEY);
    setSession(null);
    sessionRef.current = null;
    setSessionError(null);
    setIsExpiringSoon(false);
    clearSessionTimers();
    lastTouchSentAtRef.current = 0;
  }, [clearSessionTimers]);

  const endSessionWithReason = useCallback(async (
    reason: 'clock_out' | 'logout' | 'expired' | 'manual' | 'replaced',
  ): Promise<EndEmployeeSessionResult> => {
    setIsSessionLoading(true);

    try {
      const activeSession = sessionRef.current;
      if (!activeSession) {
        clearLocalSession();
        return { success: true };
      }

      const endedSession: StoreEmployeeSession = {
        ...activeSession,
        clocked_out_at: new Date().toISOString(),
        is_active: false,
      };

      const internalSession = readInternalAccessSessionSnapshot();
      if (internalSession?.internalSessionToken && internalSession.scopeType === 'store') {
        const { error } = await endStoreOperatorSession({
          internalSessionToken: internalSession.internalSessionToken,
          reason,
        });

        if (error) {
          throw new Error(error);
        }
      }

      clearLocalSession();
      return { success: true, session: endedSession };
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Failed to end session';
      setSessionError(error);
      return { success: false, error };
    } finally {
      setIsSessionLoading(false);
    }
  }, [clearLocalSession]);

  const scheduleSessionTimers = useCallback((lastActivityAtIso: string) => {
    clearSessionTimers();

    const now = Date.now();
    const lastActivity = new Date(lastActivityAtIso).getTime();
    const elapsedMs = Math.max(0, now - lastActivity);
    const timeUntilExpireMs = Math.max(0, SESSION_INACTIVITY_TIMEOUT_MS - elapsedMs);
    const timeUntilWarningMs = Math.max(0, timeUntilExpireMs - SESSION_EXPIRING_WARNING_MS);

    setIsExpiringSoon(timeUntilExpireMs <= SESSION_EXPIRING_WARNING_MS);

    warningTimerRef.current = setTimeout(() => {
      setIsExpiringSoon(true);
    }, timeUntilWarningMs);

    inactivityTimerRef.current = setTimeout(() => {
      setSessionError('Session expired due to inactivity. Please clock in again.');
      void endSessionWithReason('expired');
    }, timeUntilExpireMs);
  }, [clearSessionTimers, endSessionWithReason]);

  const initializeSession = useCallback(async () => {
    setIsSessionInitializing(true);
    try {
      const internalSession = readInternalAccessSessionSnapshot();
      if (!internalSession || internalSession.scopeType !== 'store' || !internalSession.scopeStoreId) {
        clearLocalSession();
        return;
      }

      const cachedSession = readStoredSessionCache();
      const { data, error } = await getStoreOperatorSession({
        internalSessionToken: internalSession.internalSessionToken,
      });

      if (error || !data?.success) {
        clearLocalSession();
        setSessionError(error ?? 'Could not restore store operator session.');
        return;
      }

      if (!data.session) {
        clearLocalSession();
        return;
      }

      const restoredSession = mapOperatorSessionToStoreEmployeeSession(data.session, cachedSession);
      sessionStorage.setItem(STORE_SESSION_STORAGE_KEY, JSON.stringify(restoredSession));
      setSession(restoredSession);
      sessionRef.current = restoredSession;
      setSessionError(null);
      scheduleSessionTimers(restoredSession.last_activity_at);
      lastTouchSentAtRef.current = Date.now();
    } catch {
      clearLocalSession();
      setSessionError('Could not restore store operator session.');
    } finally {
      setIsSessionInitializing(false);
    }
  }, [clearLocalSession, scheduleSessionTimers]);

  const createSession = useCallback(async (
    employeeId: string,
    employeeName: string,
    employeeRole: 'staff' | 'store_manager',
    storeId: string,
    storeName: string,
    shiftId: string,
  ): Promise<CreateEmployeeSessionResult> => {
    setIsSessionLoading(true);
    setSessionError(null);

    try {
      void employeeName;
      void employeeRole;
      void storeId;
      void shiftId;

      const internalSession = readInternalAccessSessionSnapshot();
      if (!internalSession || internalSession.scopeType !== 'store' || !internalSession.scopeStoreId) {
        throw new Error('Store login is required before starting an operator session.');
      }

      const { data, error } = await startStoreOperatorSession({
        internalSessionToken: internalSession.internalSessionToken,
        employeeId,
        deviceName: typeof window !== 'undefined' ? window.location.hostname : undefined,
      });

      if (error || !data?.success || !data.session) {
        throw new Error(error ?? 'Failed to create store operator session');
      }

      const createdSession = mapOperatorSessionToStoreEmployeeSession(data.session, {
        session_id: '',
        employee_id: employeeId,
        employee_name: employeeName,
        employee_role: employeeRole,
        store_id: internalSession.scopeStoreId,
        store_name: storeName,
        shift_id: shiftId,
        clocked_in_at: data.session.startedAt,
        clocked_out_at: null,
        session_started_at: data.session.startedAt,
        session_expires_at: data.session.expiresAt,
        last_activity_at: data.session.lastActivityAt,
        is_active: true,
        is_locked: data.session.isLocked,
      });

      sessionStorage.setItem(STORE_SESSION_STORAGE_KEY, JSON.stringify(createdSession));
      setSession(createdSession);
      sessionRef.current = createdSession;
      setSessionError(null);
      setIsExpiringSoon(false);
      scheduleSessionTimers(createdSession.last_activity_at);
      lastTouchSentAtRef.current = Date.now();

      return { success: true, session: createdSession };
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Failed to create session';
      setSessionError(error);
      return { success: false, error };
    } finally {
      setIsSessionLoading(false);
    }
  }, [scheduleSessionTimers]);

  const endSession = useCallback(async (
    reason: 'clock_out' | 'logout' | 'expired' | 'manual' | 'replaced' = 'manual',
  ): Promise<EndEmployeeSessionResult> => {
    return endSessionWithReason(reason);
  }, [endSessionWithReason]);

  const touchSession = useCallback(async () => {
    const activeSession = sessionRef.current;
    if (!activeSession) return;

    try {
      const nowMs = Date.now();
      if (nowMs - lastTouchSentAtRef.current < TOUCH_THROTTLE_MS) {
        return;
      }

      const internalSession = readInternalAccessSessionSnapshot();
      if (!internalSession || internalSession.scopeType !== 'store') {
        return;
      }

      const { data, error } = await touchStoreOperatorSession({
        internalSessionToken: internalSession.internalSessionToken,
      });

      if (error || !data?.success) {
        console.warn('Failed to touch session.');
        return;
      }

      const updatedSession: StoreEmployeeSession = {
        ...activeSession,
        last_activity_at: data.lastActivityAt,
        session_expires_at: data.expiresAt,
      };

      setSession(updatedSession);
      sessionRef.current = updatedSession;
      setIsExpiringSoon(false);
      sessionStorage.setItem(STORE_SESSION_STORAGE_KEY, JSON.stringify(updatedSession));
      scheduleSessionTimers(updatedSession.last_activity_at);
      lastTouchSentAtRef.current = nowMs;
    } catch {
      console.warn('Failed to touch session.');
    }
  }, [scheduleSessionTimers]);

  const clearSession = useCallback(() => {
    clearLocalSession();
  }, [clearLocalSession]);

  const hasActiveSession = !!(session && session.is_active && !session.is_locked);

  const isOperatingInStore = useCallback((storeId: string): boolean => {
    return !!(hasActiveSession && session && session.store_id === storeId);
  }, [hasActiveSession, session]);

  const canPerformAction = useCallback((): boolean => {
    return !!(hasActiveSession && !session?.is_locked);
  }, [hasActiveSession, session]);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    void initializeSession();
  }, [initializeSession]);

  useEffect(() => {
    if (!session) return undefined;

    const handleActivity = () => {
      void touchSession();
    };

    document.addEventListener('click', handleActivity);
    document.addEventListener('keypress', handleActivity);
    document.addEventListener('touchstart', handleActivity);

    return () => {
      document.removeEventListener('click', handleActivity);
      document.removeEventListener('keypress', handleActivity);
      document.removeEventListener('touchstart', handleActivity);
    };
  }, [session, touchSession]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORE_SESSION_STORAGE_KEY && event.key !== ADMIN_ACCESS_SESSION_STORAGE_KEY) {
        return;
      }
      void initializeSession();
    };

    window.addEventListener('storage', onStorage);
    window.addEventListener(INTERNAL_ACCESS_SESSION_UPDATED_EVENT, initializeSession);

    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(INTERNAL_ACCESS_SESSION_UPDATED_EVENT, initializeSession);
    };
  }, [initializeSession]);

  useEffect(() => {
    return () => {
      clearSessionTimers();
    };
  }, [clearSessionTimers]);

  const value: StoreSessionContextValue = {
    session,
    isSessionInitializing,
    isSessionLoading,
    sessionError,
    isExpiringSoon,
    initializeSession,
    createSession,
    endSession,
    touchSession,
    clearSession,
    hasActiveSession,
    isOperatingInStore,
    canPerformAction,
  };

  return (
    <StoreSessionContext.Provider value={value}>{children}</StoreSessionContext.Provider>
  );
};

export const useStoreSession = (): StoreSessionContextValue => {
  const context = React.useContext(StoreSessionContext);
  if (!context) {
    throw new Error('useStoreSession must be used within StoreSessionProvider');
  }
  return context;
};

export default StoreSessionProvider;
