const SYNC_URL: string | undefined = (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_SYNC_SERVER_URL;

export const ADMIN_INTERNAL_AUTH_SYNC_URL = SYNC_URL;
export const ADMIN_INTERNAL_AUTH_URL = SYNC_URL ? `${SYNC_URL}/api/internal-auth` : null;
export const ADMIN_INTERNAL_AUTH_HEALTH_URL = SYNC_URL ? `${SYNC_URL.replace(/\/$/, '')}/api/health` : null;

export const ADMIN_INTERNAL_AUTH_TIMEOUTS = {
  healthMs: 3000,
  requestMs: 6000,
  healthPollMs: 15000,
} as const;

export const ADMIN_INTERNAL_AUTH_MESSAGES = {
  missingSyncUrl: 'Internal auth server is not configured. Set VITE_SYNC_SERVER_URL and run npm run sync.',
  unreachableServer: 'Unable to reach auth server. Please check the sync server and try again.',
  verificationFailed: 'Unable to verify access.',
  accessGranted: 'Access granted.',
  missingSyncUrlWarning: 'VITE_SYNC_SERVER_URL is not set. Admin/store login will not work without the sync server.',
} as const;
