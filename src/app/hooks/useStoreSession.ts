import { useCallback } from 'react';
import { useStoreSession as useStoreSessionContext } from '../contexts/StoreSessionContext';

export interface UseStoreSessionResult {
  session: ReturnType<typeof useStoreSessionContext>['session'];
  startSession: ReturnType<typeof useStoreSessionContext>['createSession'];
  endSession: ReturnType<typeof useStoreSessionContext>['endSession'];
  touchActivity: () => Promise<void>;
  isSessionActive: boolean;
  requiresShift: boolean;
  isSessionLoading: boolean;
  isExpiringSoon: boolean;
  sessionError: string | null;
}

export function useStoreSession(): UseStoreSessionResult {
  const context = useStoreSessionContext();

  const touchActivity = useCallback(async () => {
    if (!context.hasActiveSession) {
      return;
    }
    await context.touchSession();
  }, [context]);

  return {
    session: context.session,
    startSession: context.createSession,
    endSession: context.endSession,
    touchActivity,
    isSessionActive: context.hasActiveSession,
    requiresShift: !context.hasActiveSession,
    isSessionLoading: context.isSessionLoading,
    isExpiringSoon: context.isExpiringSoon,
    sessionError: context.sessionError,
  };
}

export function useRequireSessionInStore(requiredStoreId?: string) {
  const storeSession = useStoreSession();

  if (!storeSession.isSessionActive || !storeSession.session) {
    return null;
  }

  if (requiredStoreId && storeSession.session.store_id !== requiredStoreId) {
    return null;
  }

  return storeSession.session;
}

export function useOperatingEmployeeId(requiredStoreId?: string): string | null {
  const session = useRequireSessionInStore(requiredStoreId);
  return session?.employee_id ?? null;
}
