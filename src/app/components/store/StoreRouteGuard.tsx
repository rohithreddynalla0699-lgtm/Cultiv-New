import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useStoreSession } from '../../hooks/useStoreSession';
import { useAdminDashboard } from '../../contexts/AdminDashboardContext';

interface StoreRouteGuardProps {
  children: ReactNode;
}

function SessionExpiringSoonModal() {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center pointer-events-none">
      <div className="relative w-full max-w-sm rounded-2xl border border-amber-300 bg-amber-50 p-4 shadow-lg">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-700">Session expiring soon</p>
        <p className="mt-1 text-sm text-amber-900">Session expiring soon. Continue activity to stay signed in.</p>
      </div>
    </div>
  );
}

export function StoreRouteGuard({ children }: StoreRouteGuardProps) {
  const { session: internalSession, activeStoreScope } = useAdminDashboard();
  const { session, isSessionActive, isExpiringSoon } = useStoreSession();

  const hasStoreLogin = Boolean(internalSession && internalSession.scopeType === 'store' && internalSession.scopeStoreId);
  const hasShiftSession = Boolean(isSessionActive && session);

  if (internalSession && internalSession.scopeType === 'global') {
    return <Navigate to="/operations/summary" replace />;
  }

  if (!hasStoreLogin && !hasShiftSession) {
    return <Navigate to="/operations/access" replace />;
  }

  if (activeStoreScope !== 'all' && session && activeStoreScope !== session.store_id) {
    return <Navigate to="/shift" replace />;
  }

  return (
    <>
      {children}
      {isExpiringSoon ? <SessionExpiringSoonModal /> : null}
    </>
  );
}
