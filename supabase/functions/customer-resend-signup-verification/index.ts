// @ts-nocheck

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { generateOtpCode, hashOtp, sendSms } from '../_shared/phone-update.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const jsonResponse = (status: number, payload: Record<string, unknown>) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });

const OTP_EXPIRY_MS = 2 * 60 * 1000;
const RESEND_COOLDOWN_MS = 90 * 1000;
const MAX_RESEND_ATTEMPTS = 3;
const MAX_TOTAL_SENDS_PER_WINDOW = 4;
const REQUEST_WINDOW_MS = 30 * 60 * 1000;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse(405, { success: false, error: 'Method not allowed.' });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(500, { success: false, error: 'Server is not configured.' });
  }

  let body: { customerId?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse(400, { success: false, error: 'Invalid JSON body.' });
  }

  const customerId = (body.customerId ?? '').trim();
  if (!customerId) {
    return jsonResponse(400, { success: false, error: 'Customer id is required.' });
  }

  const db = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: customer, error: customerError } = await db
    .from('customers')
    .select('id, phone, phone_verified, phone_verification_required, is_active')
    .eq('id', customerId)
    .maybeSingle();

  if (customerError) {
    console.error('[customer-resend-signup-verification] customer lookup failed', customerError);
    return jsonResponse(500, { success: false, error: 'Could not resend your verification code.' });
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
  const requestWindowStartIso = new Date(nowTs - REQUEST_WINDOW_MS).toISOString();

  const { data: recentRequests, error: recentRequestsError } = await db
    .from('customer_signup_verification_requests')
    .select('id, resend_attempts')
    .eq('customer_id', customerId)
    .gte('requested_at', requestWindowStartIso);

  if (recentRequestsError) {
    console.error('[customer-resend-signup-verification] recent request lookup failed', recentRequestsError);
    return jsonResponse(500, { success: false, error: 'Could not resend your verification code.' });
  }

  const totalRecentSends = (recentRequests ?? []).reduce((sum, row) => (
    sum + 1 + Number(row.resend_attempts ?? 0)
  ), 0);

  if (totalRecentSends >= MAX_TOTAL_SENDS_PER_WINDOW) {
    return jsonResponse(429, {
      success: false,
      error: 'You have reached the maximum number of verification code requests. Please try again later.',
    });
  }

  const { data: existingRequest, error: existingRequestError } = await db
    .from('customer_signup_verification_requests')
    .select('*')
    .eq('customer_id', customerId)
    .eq('status', 'pending')
    .order('requested_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingRequestError) {
    console.error('[customer-resend-signup-verification] pending request lookup failed', existingRequestError);
    return jsonResponse(500, { success: false, error: 'Could not resend your verification code.' });
  }

  if (existingRequest?.locked_until) {
    const lockedUntil = new Date(existingRequest.locked_until).getTime();
    if (lockedUntil > nowTs) {
      return jsonResponse(429, { success: false, error: 'Too many failed attempts. Please try again later.' });
    }
  }

  const isExistingActive = existingRequest
    && existingRequest.status === 'pending'
    && new Date(existingRequest.expires_at).getTime() > nowTs;

  if (isExistingActive && existingRequest) {
    if ((existingRequest.resend_attempts ?? 0) >= MAX_RESEND_ATTEMPTS) {
      return jsonResponse(429, {
        success: false,
        error: 'You have reached the maximum number of resend attempts for this code. Please start again.',
      });
    }

    const lastSentAt = new Date(existingRequest.last_otp_sent_at).getTime();
    if (lastSentAt + RESEND_COOLDOWN_MS > nowTs) {
      return jsonResponse(429, { success: false, error: 'Please wait before requesting a new code.' });
    }
  }

  const otpCode = generateOtpCode();
  const otpHash = await hashOtp(otpCode);
  const expiresAtIso = new Date(nowTs + OTP_EXPIRY_MS).toISOString();

  let requestId: string | null = null;
  if (isExistingActive && existingRequest) {
    const { data: updatedRequest, error: updateError } = await db
      .from('customer_signup_verification_requests')
      .update({
        otp_hash: otpHash,
        expires_at: expiresAtIso,
        last_otp_sent_at: nowIso,
        resend_attempts: Number(existingRequest.resend_attempts ?? 0) + 1,
        updated_at: nowIso,
      })
      .eq('id', existingRequest.id)
      .select('id')
      .maybeSingle();

    if (updateError || !updatedRequest?.id) {
      console.error('[customer-resend-signup-verification] request update failed', updateError);
      return jsonResponse(500, { success: false, error: 'Could not resend your verification code.' });
    }
    requestId = updatedRequest.id;
  } else {
    if (existingRequest?.id) {
      await db
        .from('customer_signup_verification_requests')
        .update({ status: 'failed', updated_at: nowIso })
        .eq('id', existingRequest.id);
    }

    const { data: insertedRequest, error: insertError } = await db
      .from('customer_signup_verification_requests')
      .insert({
        customer_id: customerId,
        phone_normalized: customer.phone,
        otp_hash: otpHash,
        status: 'pending',
        requested_at: nowIso,
        expires_at: expiresAtIso,
        last_otp_sent_at: nowIso,
        otp_attempts: 0,
        resend_attempts: 0,
        created_at: nowIso,
        updated_at: nowIso,
      })
      .select('id')
      .maybeSingle();

    if (insertError || !insertedRequest?.id) {
      console.error('[customer-resend-signup-verification] request insert failed', insertError);
      return jsonResponse(500, { success: false, error: 'Could not resend your verification code.' });
    }
    requestId = insertedRequest.id;
  }

  try {
    await sendSms(customer.phone, `Your CULTIV verification code is ${otpCode}`);
  } catch (error) {
    console.error('[customer-resend-signup-verification] SMS send failed', error);
    return jsonResponse(500, { success: false, error: 'Could not send verification code.' });
  }

  return jsonResponse(200, {
    success: true,
    message: 'A new verification code has been sent to your phone number.',
    requestId,
    expiresAt: expiresAtIso,
  });
});
