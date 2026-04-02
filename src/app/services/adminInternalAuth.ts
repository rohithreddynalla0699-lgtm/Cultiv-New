import type { InternalAuthRequestPayload, InternalAuthVerificationResult } from '../types/adminInternalAuth';

export async function requestInternalAuth(
  internalAuthUrl: string,
  payload: InternalAuthRequestPayload,
  timeoutMs: number,
  fallbackMessages: { accessGranted: string; verificationFailed: string },
): Promise<InternalAuthVerificationResult> {
  const response = await fetch(internalAuthUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(timeoutMs),
  });

  let data: { ok?: boolean; message?: string; role?: 'admin' | 'store'; storeId?: string } = {};
  try {
    data = await response.json() as { ok?: boolean; message?: string; role?: 'admin' | 'store'; storeId?: string };
  } catch {
    // Keep network/server availability classification separate from invalid responses.
  }

  return {
    ok: Boolean(response.ok && data.ok),
    message: data.message ?? (response.ok ? fallbackMessages.accessGranted : fallbackMessages.verificationFailed),
    role: data.role,
    storeId: data.storeId,
    reason: response.ok ? undefined : 'invalid_credentials',
  };
}
