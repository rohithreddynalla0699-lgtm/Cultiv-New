// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.43.0';
import { hash as bcryptHash } from 'https://deno.land/x/bcrypt@v0.4.1/mod.ts';
import { revokeCustomerSessionsForCustomer } from '../_shared/customer-session.ts';
import { createCorsHeaders } from '../_shared/cors.ts';

const json = (corsHeaders: Record<string, string>, status: number, payload: Record<string, unknown>) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });

const COMPLETE_LIMIT = 10;
const COMPLETE_WINDOW_MINUTES = 30;

const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
};

const bytesToBase64Url = (bytes: Uint8Array) => {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
};

const sha256Base64Url = async (value: string) => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return bytesToBase64Url(new Uint8Array(digest));
};

const PBKDF2_ITERATIONS = 100000;
const PBKDF2_SALT_BYTES = 16;
const PBKDF2_HASH_BITS = 256;

const createPbkdf2Hash = async (password: string): Promise<string> => {
  const salt = crypto.getRandomValues(new Uint8Array(PBKDF2_SALT_BYTES));
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    PBKDF2_HASH_BITS
  );
  const hashBytes = new Uint8Array(derivedBits);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${bytesToBase64(salt)}$${bytesToBase64(hashBytes)}`;
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

const extractClientIp = (req: Request): string | null => {
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

const loadAttemptState = async (db: ReturnType<typeof createClient>, attemptKey: string) => {
  const { data } = await db
    .from('customer_password_reset_attempts')
    .select('request_count, locked_until, last_attempted_at')
    .eq('attempt_key', attemptKey)
    .maybeSingle();

  return data ?? null;
};

const registerFailedAttempt = async (db: ReturnType<typeof createClient>, attemptKey: string) => {
  const existing = await loadAttemptState(db, attemptKey);
  const now = Date.now();
  const shouldResetWindow = Boolean(
    existing?.last_attempted_at
      && now - new Date(existing.last_attempted_at).getTime() > COMPLETE_WINDOW_MINUTES * 60 * 1000
  );
  const lockExpired = Boolean(
    existing?.locked_until
      && new Date(existing.locked_until).getTime() <= now
  );
  const baselineCount = (!existing || shouldResetWindow || lockExpired)
    ? 0
    : Number(existing.request_count ?? 0);
  const nextRequestCount = baselineCount + 1;
  const lockedUntil = nextRequestCount >= COMPLETE_LIMIT
    ? new Date(Date.now() + COMPLETE_WINDOW_MINUTES * 60 * 1000).toISOString()
    : null;

  await db
    .from('customer_password_reset_attempts')
    .upsert({
      attempt_key: attemptKey,
      attempt_scope: 'complete_reset',
      request_count: nextRequestCount,
      first_attempted_at: existing ? undefined : new Date().toISOString(),
      last_attempted_at: new Date().toISOString(),
      locked_until: lockedUntil,
      updated_at: new Date().toISOString(),
    });
};

const clearAttempts = async (db: ReturnType<typeof createClient>, attemptKey: string) => {
  await db
    .from('customer_password_reset_attempts')
    .delete()
    .eq('attempt_key', attemptKey);
};

const passwordPolicyError = (password: string) => {
  if (password.length < 8) return 'Password must be at least 8 characters.';
  if (!/[A-Za-z]/.test(password)) return 'Password must include at least one letter.';
  if (!/\d/.test(password)) return 'Password must include at least one number.';
  return '';
};

Deno.serve(async (req) => {
  const corsHeaders = createCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json(corsHeaders, 405, { success: false, message: 'Method not allowed.' });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    return json(corsHeaders, 500, { success: false, message: 'Server is not configured.' });
  }

  let body: { token?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return json(corsHeaders, 400, { success: false, message: 'Invalid JSON body.' });
  }

  const token = String(body.token ?? '').trim();
  const password = String(body.password ?? '');

  if (!token) {
    return json(corsHeaders, 400, { success: false, message: 'Reset token is required.' });
  }

  const policyMessage = passwordPolicyError(password);
  if (policyMessage) {
    return json(corsHeaders, 400, { success: false, message: policyMessage });
  }

  const db = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const clientIp = extractClientIp(req) ?? 'unknown';
  const attemptKey = `complete_reset:${clientIp}`;
  const attemptState = await loadAttemptState(db, attemptKey);
  if (attemptState?.locked_until && new Date(attemptState.locked_until) > new Date()) {
    return json(429, {
      success: false,
      message: 'Too many reset attempts. Please wait before trying again.',
    });
  }

  const tokenHash = await sha256Base64Url(token);
  const nowIso = new Date().toISOString();

  const { data: consumedToken, error: consumeError } = await db
    .from('customer_password_reset_tokens')
    .update({
      consumed_at: nowIso,
      updated_at: nowIso,
    })
    .eq('token_hash', tokenHash)
    .is('consumed_at', null)
    .gt('expires_at', nowIso)
    .select('id, customer_id')
    .maybeSingle();

  if (consumeError) {
    console.error('[customer-reset-password] reset token consume failed', consumeError);
    return json(500, {
      success: false,
      message: 'Could not reset your password right now. Please try again later.',
    });
  }

  if (!consumedToken?.customer_id) {
    await registerFailedAttempt(db, attemptKey);
    return json(400, { success: false, message: 'This reset link is invalid or has expired.' });
  }

  let passwordHash = '';
  try {
    passwordHash = await bcryptHash(password);
  } catch (error) {
    console.error('[customer-reset-password] bcrypt hash failed, falling back to pbkdf2', error);
    try {
      passwordHash = await createPbkdf2Hash(password);
    } catch (fallbackError) {
      console.error('[customer-reset-password] fallback hash failed', fallbackError);
      return json(500, {
        success: false,
        message: 'Could not reset your password right now. Please try again later.',
      });
    }
  }

  const { error: updateError } = await db
    .from('customers')
    .update({
      password_hash: passwordHash,
      updated_at: nowIso,
    })
    .eq('id', consumedToken.customer_id);

  if (updateError) {
    console.error('[customer-reset-password] customer password update failed', updateError);
    return json(500, {
      success: false,
      message: 'Could not reset your password right now. Please try again later.',
    });
  }

  await revokeCustomerSessionsForCustomer(db, consumedToken.customer_id);

  await db
    .from('customer_password_reset_tokens')
    .delete()
    .eq('customer_id', consumedToken.customer_id)
    .is('consumed_at', null);

  await clearAttempts(db, attemptKey);

  return json(200, {
    success: true,
    message: 'Your password has been updated. Please sign in with your new password.',
  });
});
