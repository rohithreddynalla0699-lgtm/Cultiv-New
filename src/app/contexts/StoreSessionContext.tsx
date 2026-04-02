/**
 * CULTIV Store Session Context
 * 
 * Provides store employee session state and actions to all components.
 * Single source of truth for "who is currently operating in this store"
 */

import React, { createContext, useCallback, useEffect, useRef, useState } from 'react';
import {
  StoreEmployeeSession,
  StoreSessionContextValue,
  CreateEmployeeSessionResult,
  EndEmployeeSessionResult,
  STORE_SESSION_STORAGE_KEY,
  SESSION_EXPIRY_DURATION_MS,
  SESSION_INACTIVITY_TIMEOUT_MS,
  SESSION_EXPIRING_WARNING_MS,
} from '../types/storeSession';

// Create context
export const StoreSessionContext = createContext<StoreSessionContextValue | undefined>(
  undefined
);

interface StoreSessionProviderProps {
  children: React.ReactNode;
  sessionRepository?: any; // For future Supabase integration
}

/**
 * Provider component that wraps store operations (POS, Orders, Inventory)
 * Manages employee session state during shift
 */
export const StoreSessionProvider: React.FC<StoreSessionProviderProps> = ({
  children,
  sessionRepository: _sessionRepository,
}) => {
  // State
  const [session, setSession] = useState<StoreEmployeeSession | null>(null);
  const [isSessionLoading, setIsSessionLoading] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [isExpiringSoon, setIsExpiringSoon] = useState(false);

  // Refs
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const scheduleSessionTimers = useCallback(
    (lastActivityAtIso: string) => {
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
        void endSession();
      }, timeUntilExpireMs);
    },
    [clearSessionTimers]
  );

  // Initialize session from storage on mount
  const initializeSession = useCallback(async () => {
    setIsSessionLoading(true);
    try {
      // Try to restore from sessionStorage (device memory)
      const stored = sessionStorage.getItem(STORE_SESSION_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as StoreEmployeeSession;

        // Verify session is still valid (not expired, employee still exists)
        // In production, verify with server
        const expiresAt = new Date(parsed.session_expires_at).getTime();
        if (expiresAt > Date.now()) {
          setSession(parsed);
          setSessionError(null);
          scheduleSessionTimers(parsed.last_activity_at);
          return;
        } else {
          // Session expired, clear it
          sessionStorage.removeItem(STORE_SESSION_STORAGE_KEY);
        }
      }

      // No valid session found
      setSession(null);
      setIsExpiringSoon(false);
    } catch (err) {
      // Storage read error, ignore silently
      console.warn('Failed to restore session from storage:', err);
    } finally {
      setIsSessionLoading(false);
    }
  }, [scheduleSessionTimers]);

  // Create new session (called after successful shift start)
  const createSession = useCallback(
    async (
      employeeId: string,
      employeeName: string,
      employeeRole: 'staff' | 'store_manager',
      storeId: string,
      storeName: string,
      shiftId: string
    ): Promise<CreateEmployeeSessionResult> => {
      setIsSessionLoading(true);
      setSessionError(null);

      try {
        const now = new Date();
        const expiresAt = new Date(now.getTime() + SESSION_EXPIRY_DURATION_MS);

        const newSession: StoreEmployeeSession = {
          session_id: `session-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
          employee_id: employeeId,
          employee_name: employeeName,
          employee_role: employeeRole,
          store_id: storeId,
          store_name: storeName,
          shift_id: shiftId,
          clocked_in_at: now.toISOString(),
          clocked_out_at: null,
          session_started_at: now.toISOString(),
          session_expires_at: expiresAt.toISOString(),
          last_activity_at: now.toISOString(),
          is_active: true,
          is_locked: false,
        };

        // Store in sessionStorage for device persistence
        sessionStorage.setItem(STORE_SESSION_STORAGE_KEY, JSON.stringify(newSession));

        // TODO: In production, also persist to server/database for audit
        // await sessionRepository.createSession(newSession);

        setSession(newSession);
        setSessionError(null);
        setIsExpiringSoon(false);
        scheduleSessionTimers(newSession.last_activity_at);

        return { success: true, session: newSession };
      } catch (err) {
        const error = err instanceof Error ? err.message : 'Failed to create session';
        setSessionError(error);
        return { success: false, error };
      } finally {
        setIsSessionLoading(false);
      }
    },
    []
  );

  // End session (called after shift end or manual logout)
  const endSession = useCallback(async (): Promise<EndEmployeeSessionResult> => {
    setIsSessionLoading(true);

    try {
      if (!session) {
        return { success: false, error: 'No active session' };
      }

      const endedSession: StoreEmployeeSession = {
        ...session,
        clocked_out_at: new Date().toISOString(),
        is_active: false,
      };

      // TODO: In production, persist to server/database for audit
      // await sessionRepository.endSession(endedSession.session_id);

      // Clear from storage
      sessionStorage.removeItem(STORE_SESSION_STORAGE_KEY);

      // Clear state
      setSession(null);
      setSessionError(null);
      setIsExpiringSoon(false);
      clearSessionTimers();

      return { success: true, session: endedSession };
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Failed to end session';
      setSessionError(error);
      return { success: false, error };
    } finally {
      setIsSessionLoading(false);
    }
  }, [clearSessionTimers, session]);

  // Touch session (update last activity on user interaction)
  const touchSession = useCallback(async () => {
    if (!session) return;

    try {
      const now = new Date().toISOString();

      const updatedSession: StoreEmployeeSession = {
        ...session,
        last_activity_at: now,
      };

      // Update in memory
      setSession(updatedSession);
      setIsExpiringSoon(false);

      // Update in storage
      sessionStorage.setItem(STORE_SESSION_STORAGE_KEY, JSON.stringify(updatedSession));

      // TODO: In production, update server/database
      // await sessionRepository.touchSession(updatedSession.session_id, now);

      scheduleSessionTimers(updatedSession.last_activity_at);
    } catch (err) {
      console.warn('Failed to touch session:', err);
    }
  }, [scheduleSessionTimers, session]);

  // Clear session synchronously (e.g., on logout/force-close)
  const clearSession = useCallback(() => {
    sessionStorage.removeItem(STORE_SESSION_STORAGE_KEY);
    setSession(null);
    setSessionError(null);
    setIsExpiringSoon(false);
    clearSessionTimers();
  }, [clearSessionTimers]);

  // Compute derived state
  const hasActiveSession = !!(session && session.is_active && !session.is_locked);

  const isOperatingInStore = useCallback(
    (storeId: string): boolean => {
      return !!(hasActiveSession && session && session.store_id === storeId);
    },
    [hasActiveSession, session]
  );

  const canPerformAction = useCallback((): boolean => {
    return !!(hasActiveSession && !session?.is_locked);
  }, [hasActiveSession, session]);

  // Initialize on mount
  useEffect(() => {
    initializeSession();
  }, [initializeSession]);

  // Listen for user activity (click, keypress, touch)
  useEffect(() => {
    if (!session) return;

    const handleActivity = () => {
      touchSession();
    };

    // Add activity listeners
    document.addEventListener('click', handleActivity);
    document.addEventListener('keypress', handleActivity);
    document.addEventListener('touchstart', handleActivity);

    return () => {
      document.removeEventListener('click', handleActivity);
      document.removeEventListener('keypress', handleActivity);
      document.removeEventListener('touchstart', handleActivity);
    };
  }, [session, touchSession]);

  // Sync session changes across tabs/windows
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORE_SESSION_STORAGE_KEY) return;
      void initializeSession();
    };

    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('storage', onStorage);
    };
  }, [initializeSession]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearSessionTimers();
    };
  }, [clearSessionTimers]);

  const value: StoreSessionContextValue = {
    session,
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

/**
 * Hook to use store employee session
 * Throws if used outside StoreSessionProvider
 */
export const useStoreSession = (): StoreSessionContextValue => {
  const context = React.useContext(StoreSessionContext);
  if (!context) {
    throw new Error('useStoreSession must be used within StoreSessionProvider');
  }
  return context;
};

export default StoreSessionProvider;
