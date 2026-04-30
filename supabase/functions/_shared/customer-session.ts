// @ts-nocheck

const CUSTOMER_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface CustomerSessionRow {
  id: string;
  session_token: string;
  customer_id: string;
  expires_at: string;
  revoked_at: string | null;
  last_seen_at: string;
  created_at: string;
}

const TOKEN_BYTE_LENGTH = 32;

const toBase64Url = (bytes: Uint8Array): string => {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
};

const isValidIpv4 = (value: string) => {
  const parts = value.split('.');
  if (parts.length !== 4) return false;
  return parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) >= 0 && Number(part) <= 255);
};

const isLikelyIpv6 = (value: string) => value.includes(':') && /^[0-9a-fA-F:]+$/.test(value);

const normalizeIpCandidate = (value: string): string => {
  let normalized = value.trim();

  if (normalized.toLowerCase().startsWith('for=')) {
    normalized = normalized.slice(4).trim();
  }

  normalized = normalized.replace(/^"|"$/g, '');

  if (normalized.includes(',')) {
    normalized = normalized.split(',')[0].trim();
  }

  if (normalized.startsWith('[') && normalized.includes(']')) {
    normalized = normalized.slice(1, normalized.indexOf(']'));
  }

  const ipv4WithPortMatch = normalized.match(/^(\d{1,3}(?:\.\d{1,3}){3}):(\d+)$/);
  if (ipv4WithPortMatch) {
    normalized = ipv4WithPortMatch[1];
  }

  return normalized;
};

export const extractClientIp = (req: Request): string | null => {
  const candidates = [
    req.headers.get('x-forwarded-for'),
    req.headers.get('cf-connecting-ip'),
    req.headers.get('x-real-ip'),
    req.headers.get('forwarded'),
  ];

  for (const rawValue of candidates) {
    if (!rawValue) continue;
    const candidate = normalizeIpCandidate(rawValue);
    if (!candidate) continue;
    if (isValidIpv4(candidate) || isLikelyIpv6(candidate)) {
      return candidate;
    }
  }

  return null;
};

export const extractUserAgent = (req: Request): string | null => {
  const userAgent = req.headers.get('user-agent');
  if (!userAgent) return null;
  const trimmed = userAgent.trim();
  return trimmed.length > 0 ? trimmed.slice(0, 500) : null;
};

const generateSessionToken = (): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(TOKEN_BYTE_LENGTH));
  return toBase64Url(bytes);
};

export const createCustomerSession = async (
  db: any,
  customerId: string,
  req: Request,
): Promise<{ token: string; expiresAtIso: string; sessionId: string }> => {
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const expiresAtIso = new Date(now + CUSTOMER_SESSION_TTL_MS).toISOString();
  const token = generateSessionToken();

  const { data, error } = await db
    .from('customer_sessions')
    .insert({
      session_token: token,
      customer_id: customerId,
      expires_at: expiresAtIso,
      last_seen_at: nowIso,
      created_by_ip: extractClientIp(req),
      created_user_agent: extractUserAgent(req),
      created_at: nowIso,
      updated_at: nowIso,
    })
    .select('id')
    .single();

  if (error || !data?.id) {
    throw new Error(error?.message ?? 'Could not create customer session.');
  }

  return {
    token,
    expiresAtIso,
    sessionId: data.id,
  };
};

export const verifyAndLoadCustomerSession = async (
  db: any,
  token: string,
  options?: { touch?: boolean },
): Promise<
  | { valid: true; session: CustomerSessionRow }
  | { valid: false; error: string }
> => {
  const normalizedToken = String(token ?? '').trim();
  if (!normalizedToken) {
    return { valid: false, error: 'Customer session token is invalid or expired.' };
  }

  const { data, error } = await db
    .from('customer_sessions')
    .select('id, session_token, customer_id, expires_at, revoked_at, last_seen_at, created_at')
    .eq('session_token', normalizedToken)
    .maybeSingle();

  if (error || !data) {
    return { valid: false, error: 'Customer session token is invalid or expired.' };
  }

  if (data.revoked_at !== null) {
    return { valid: false, error: 'Customer session token is invalid or expired.' };
  }

  if (new Date(data.expires_at).getTime() <= Date.now()) {
    return { valid: false, error: 'Customer session token is invalid or expired.' };
  }

  const { data: customer, error: customerError } = await db
    .from('customers')
    .select('id, is_active')
    .eq('id', data.customer_id)
    .maybeSingle();

  if (customerError || !customer?.id || customer.is_active === false) {
    return { valid: false, error: 'Customer session token is invalid or expired.' };
  }

  if (options?.touch !== false) {
    db
      .from('customer_sessions')
      .update({
        last_seen_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', data.id)
      .then(() => {})
      .catch(() => {});
  }

  return { valid: true, session: data as CustomerSessionRow };
};

export const revokeCustomerSessionByToken = async (
  db: any,
  token: string,
): Promise<void> => {
  const normalizedToken = String(token ?? '').trim();
  if (!normalizedToken) return;

  const nowIso = new Date().toISOString();
  await db
    .from('customer_sessions')
    .update({
      revoked_at: nowIso,
      updated_at: nowIso,
    })
    .eq('session_token', normalizedToken)
    .is('revoked_at', null);
};

export const revokeCustomerSessionsForCustomer = async (
  db: any,
  customerId: string,
): Promise<void> => {
  const normalizedCustomerId = String(customerId ?? '').trim();
  if (!normalizedCustomerId) return;

  const nowIso = new Date().toISOString();
  await db
    .from('customer_sessions')
    .update({
      revoked_at: nowIso,
      updated_at: nowIso,
    })
    .eq('customer_id', normalizedCustomerId)
    .is('revoked_at', null);
};
