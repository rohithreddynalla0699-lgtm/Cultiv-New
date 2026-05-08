// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { notificationChannelPolicy } from '../_shared/notification-policy.ts';
import { logNotificationEvent } from '../_shared/notification-events.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (status: number, payload: Record<string, unknown>) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });

const GENERIC_SUCCESS_MESSAGE =
  'If an account matches that phone or email, a password reset link will be prepared for you.';

const REQUEST_LIMIT = 5;
const REQUEST_WINDOW_MINUTES = 15;
const RESET_TOKEN_TTL_MINUTES = 30;

const normalizePhone = (phone: string) => phone.replace(/\D/g, '').slice(-10);
const normalizeEmail = (email: string) => email.trim().toLowerCase();
const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const bytesToBase64Url = (bytes: Uint8Array) => {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
};

const createResetToken = () => bytesToBase64Url(crypto.getRandomValues(new Uint8Array(32)));

const sha256Base64Url = async (value: string) => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return bytesToBase64Url(new Uint8Array(digest));
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

const extractUserAgent = (req: Request): string | null => {
  const userAgent = req.headers.get('user-agent')?.trim() ?? '';
  if (!userAgent) return null;
  return userAgent.slice(0, 1024);
};

const loadAttemptState = async (db: ReturnType<typeof createClient>, attemptKey: string) => {
  const { data } = await db
    .from('customer_password_reset_attempts')
    .select('request_count, locked_until, last_attempted_at')
    .eq('attempt_key', attemptKey)
    .maybeSingle();

  return data ?? null;
};

const registerAttempt = async (db: ReturnType<typeof createClient>, attemptKey: string) => {
  const existing = await loadAttemptState(db, attemptKey);
  const now = Date.now();
  const shouldResetWindow = Boolean(
    existing?.last_attempted_at
      && now - new Date(existing.last_attempted_at).getTime() > REQUEST_WINDOW_MINUTES * 60 * 1000
  );
  const lockExpired = Boolean(
    existing?.locked_until
      && new Date(existing.locked_until).getTime() <= now
  );
  const baselineCount = (!existing || shouldResetWindow || lockExpired)
    ? 0
    : Number(existing.request_count ?? 0);
  const nextRequestCount = baselineCount + 1;
  const lockedUntil = nextRequestCount >= REQUEST_LIMIT
    ? new Date(Date.now() + REQUEST_WINDOW_MINUTES * 60 * 1000).toISOString()
    : null;

  await db
    .from('customer_password_reset_attempts')
    .upsert({
      attempt_key: attemptKey,
      attempt_scope: 'request_reset',
      request_count: nextRequestCount,
      first_attempted_at: existing ? undefined : new Date().toISOString(),
      last_attempted_at: new Date().toISOString(),
      locked_until: lockedUntil,
      updated_at: new Date().toISOString(),
    });

  return { nextRequestCount, lockedUntil };
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json(405, { success: false, message: 'Method not allowed.' });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    return json(500, { success: false, message: 'Server is not configured.' });
  }

  let body: { identifier?: string };
  try {
    body = await req.json();
  } catch {
    return json(400, { success: false, message: 'Invalid JSON body.' });
  }

  const rawIdentifier = String(body.identifier ?? '').trim();
  if (!rawIdentifier) {
    return json(400, { success: false, message: 'Email or phone number is required.' });
  }

  const normalizedPhone = normalizePhone(rawIdentifier);
  const normalizedEmail = normalizeEmail(rawIdentifier);
  const isPhoneIdentifier = normalizedPhone.length === 10;
  const isEmailIdentifier = isValidEmail(normalizedEmail);

  if (!isPhoneIdentifier && !isEmailIdentifier) {
    return json(400, { success: false, message: 'Enter a valid 10-digit phone number or email address.' });
  }

  const db = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const clientIp = extractClientIp(req) ?? 'unknown';
  const userAgent = extractUserAgent(req);
  const attemptKey = `request_reset:${clientIp}`;
  const attemptState = await loadAttemptState(db, attemptKey);

  if (attemptState?.locked_until && new Date(attemptState.locked_until) > new Date()) {
    return json(429, {
      success: false,
      message: 'Too many reset requests. Please wait before trying again.',
    });
  }

  await registerAttempt(db, attemptKey);

  let customer = null;

  if (isPhoneIdentifier) {
    const { data, error } = await db
      .from('customers')
      .select('id, email, phone, is_active')
      .eq('phone', normalizedPhone)
      .maybeSingle();

    if (error) {
      console.error('[customer-request-password-reset] phone lookup failed', error);
    } else {
      customer = data;
    }
  }

  if (!customer && isEmailIdentifier) {
    const { data, error } = await db
      .from('customers')
      .select('id, email, phone, is_active')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (error) {
      console.error('[customer-request-password-reset] email lookup failed', error);
    } else {
      customer = data;
    }
  }

  let debugResetToken: string | undefined;
  const allowDebugTokenResponse = (Deno.env.get('PASSWORD_RESET_DEBUG_TOKEN_RESPONSE') ?? '').toLowerCase() === 'true';

  // Security recovery channel policy: password reset tokens are part of account security flows; SMS remains the default security channel for verification.
  const receiptChannelPolicy = notificationChannelPolicy.security;
  if (customer?.id && customer.is_active !== false) {
    const rawResetToken = createResetToken();
    const tokenHash = await sha256Base64Url(rawResetToken);
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000).toISOString();

    const { error: revokeError } = await db
      .from('customer_password_reset_tokens')
      .delete()
      .eq('customer_id', customer.id)
      .is('consumed_at', null);

    if (revokeError) {
      console.error('[customer-request-password-reset] could not clear old reset tokens', revokeError);
    }

    const { error: insertError } = await db
      .from('customer_password_reset_tokens')
      .insert({
        customer_id: customer.id,
        token_hash: tokenHash,
        expires_at: expiresAt,
        request_ip: clientIp,
        request_user_agent: userAgent,
      });

    if (insertError) {
      console.error('[customer-request-password-reset] reset token insert failed', insertError);
      return json(500, {
        success: false,
        message: 'Could not start password reset right now. Please try again later.',
      });
    }

    if (allowDebugTokenResponse) {
      debugResetToken = rawResetToken;
    }

    await logNotificationEvent(db, {
      channel: 'sms',
      purpose: 'password_reset',
      status: 'not_delivered',
      provider: null,
      recipient: customer.phone ? String(customer.phone) : null,
      customerId: customer.id,
      errorCode: 'DELIVERY_NOT_IMPLEMENTED',
      errorMessage: 'Password reset token was prepared, but provider-backed delivery is not implemented in this environment.',
      metadata: {
        securityPreferredChannel: receiptChannelPolicy.preferred,
        debugTokenResponseEnabled: allowDebugTokenResponse,
        identifierType: isPhoneIdentifier ? 'phone' : 'email',
      },
    });
  }

  return json(200, {
    success: true,
    message: GENERIC_SUCCESS_MESSAGE,
    ...(debugResetToken ? { debug_reset_token: debugResetToken } : {}),
  });
});
