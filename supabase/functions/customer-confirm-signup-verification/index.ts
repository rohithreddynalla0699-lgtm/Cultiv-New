// @ts-nocheck

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createCustomerSession } from '../_shared/customer-session.ts';
import { verifyOtp } from '../_shared/phone-update.ts';
import { notificationChannelPolicy } from '../_shared/notification-policy.ts';
import { createCorsHeaders } from '../_shared/cors.ts';

const jsonResponse = (corsHeaders: Record<string, string>, status: number, payload: Record<string, unknown>) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });

const MAX_OTP_ATTEMPTS = 5;
const LOCKOUT_MS = 30 * 60 * 1000;

Deno.serve(async (req) => {
  const corsHeaders = createCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse(corsHeaders, 405, { success: false, error: 'Method not allowed.' });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(corsHeaders, 500, { success: false, error: 'Server is not configured.' });
  }

  let body: { customerId?: string; requestId?: string; otpCode?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse(corsHeaders, 400, { success: false, error: 'Invalid JSON body.' });
  }

  const customerId = (body.customerId ?? '').trim();
  const requestId = (body.requestId ?? '').trim();
  const otpCode = (body.otpCode ?? '').trim();

  if (!customerId) {
    return jsonResponse(corsHeaders, 400, { success: false, error: 'Customer id is required.' });
  }

  if (!requestId) {
    return jsonResponse(corsHeaders, 400, { success: false, error: 'Request id is required.' });
  }

  if (!otpCode) {
    return jsonResponse(corsHeaders, 400, { success: false, error: 'Verification code is required.' });
  }

  const db = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: customer, error: customerError } = await db
    .from('customers')
    .select('id, full_name, email, phone, reward_points, phone_verified, email_verified, phone_verification_required, is_active')
    .eq('id', customerId)
    .maybeSingle();

  if (customerError) {
    console.error('[customer-confirm-signup-verification] customer lookup failed', customerError);
    return jsonResponse(500, { success: false, error: 'Could not verify your account.' });
  }

  if (!customer?.id || customer.is_active === false) {
    return jsonResponse(404, { success: false, error: 'Customer account not found.' });
  }

  if (customer.phone_verified === true && customer.phone_verification_required !== true) {
    return jsonResponse(409, { success: false, error: 'This phone number is already verified. Please sign in.' });
  }

  if (customer.phone_verification_required !== true) {
    return jsonResponse(400, { success: false, error: 'This account does not require signup verification.' });
  }

  const nowTs = Date.now();
  const nowIso = new Date(nowTs).toISOString();

  const { data: requestRow, error: requestError } = await db
    .from('customer_signup_verification_requests')
    .select('*')
    .eq('id', requestId)
    .eq('customer_id', customerId)
    .eq('status', 'pending')
    .maybeSingle();

  if (requestError) {
    console.error('[customer-confirm-signup-verification] request lookup failed', requestError);
    return jsonResponse(500, { success: false, error: 'Could not verify your request.' });
  }

  if (!requestRow) {
    return jsonResponse(404, { success: false, error: 'Signup verification request not found.' });
  }

  if (requestRow.locked_until) {
    const lockedUntil = new Date(requestRow.locked_until).getTime();
    if (lockedUntil > nowTs) {
      return jsonResponse(429, { success: false, error: 'Too many failed attempts. Please try again later.' });
    }
  }

  const expiresAt = new Date(requestRow.expires_at).getTime();
  if (expiresAt <= nowTs) {
    await db
      .from('customer_signup_verification_requests')
      .update({ status: 'failed', locked_until: null, updated_at: nowIso })
      .eq('id', requestId);
    return jsonResponse(400, { success: false, error: 'This verification code has expired.' });
  }

  // Security/verification channel policy: signup verification is handled over SMS as defined in the shared notification policy.
  const isValidOtp = await verifyOtp(otpCode, requestRow.otp_hash);
  if (!isValidOtp) {
    const nextAttempts = Number(requestRow.otp_attempts ?? 0) + 1;
    const updates: Record<string, unknown> = {
      otp_attempts: nextAttempts,
      updated_at: nowIso,
    };

    if (nextAttempts >= MAX_OTP_ATTEMPTS) {
      updates.status = 'failed';
      updates.locked_until = new Date(nowTs + LOCKOUT_MS).toISOString();
    }

    await db
      .from('customer_signup_verification_requests')
      .update(updates)
      .eq('id', requestId);

    return jsonResponse(400, { success: false, error: 'Invalid verification code.' });
  }

  const { error: customerUpdateError } = await db
    .from('customers')
    .update({
      phone_verified: true,
      phone_verification_required: false,
      updated_at: nowIso,
    })
    .eq('id', customerId);

  if (customerUpdateError) {
    console.error('[customer-confirm-signup-verification] customer update failed', customerUpdateError);
    return jsonResponse(500, { success: false, error: 'Could not verify your phone number.' });
  }

  await db
    .from('customer_signup_verification_requests')
    .update({ status: 'verified', updated_at: nowIso, locked_until: null })
    .eq('id', requestId);

  await db
    .from('customer_signup_verification_requests')
    .update({ status: 'cancelled', updated_at: nowIso })
    .eq('customer_id', customerId)
    .eq('status', 'pending')
    .neq('id', requestId);

  let customerSession;
  try {
    customerSession = await createCustomerSession(db, customerId, req);
  } catch (sessionError) {
    console.error('[customer-confirm-signup-verification] customer session create failed', sessionError);
    return jsonResponse(500, {
      success: false,
      error: 'Your phone was verified, but we could not start your session. Please sign in.',
    });
  }

  return jsonResponse(200, {
    success: true,
    message: 'Your phone number has been verified. Welcome to CULTIV.',
    customer_id: customerId,
    customer_session_token: customerSession.token,
    customer_session_expires_at: customerSession.expiresAtIso,
    customer: {
      id: customer.id,
      full_name: customer.full_name,
      email: customer.email,
      phone: customer.phone,
      reward_points: Number(customer.reward_points ?? 0),
      phone_verified: true,
      email_verified: Boolean(customer.email_verified),
    },
  });
});
