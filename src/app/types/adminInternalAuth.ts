export type ServerStatus = 'online' | 'offline' | 'unknown';

export type InternalAuthReason = 'invalid_credentials' | 'validation';

export type InternalAuthRequestPayload =
  | { mode: 'owner'; pin: string }
  | { mode: 'store'; storeId: string; pin: string };

export interface InternalAuthVerificationResult {
  ok: boolean;
  message: string;
  role?: 'admin' | 'store';
  storeId?: string;
  reason?: InternalAuthReason;
}

export interface InternalLoginResult {
  success: boolean;
  message: string;
  reason?: InternalAuthReason;
}
