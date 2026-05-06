// @ts-nocheck

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { verifyAndLoadCustomerSession } from '../_shared/customer-session.ts';
import { normalizePhone, generateOtpCode, hashOtp, sendSms } from '../_shared/phone-update.ts';

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
    },
  });

const OTP_EXPIRY_MS = 2 * 60 * 1000;
const RESEND_COOLDOWN_MS = 90 * 1000;

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

  let body: { customerSessionToken?: string; newPhone?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse(400, { success: false, error: 'Invalid JSON body.' });
  }

  const customerSessionToken = (body.customerSessionToken ?? '').trim();
  const newPhone = (body.newPhone ?? '').trim();

  if (!customerSessionToken) {
    return jsonResponse(400, { success: false, error: 'Customer session token is required.' });
  }

  if (!newPhone) {
    return jsonResponse(400, { success: false, error: 'A new phone number is required.' });
  }

  const normalizedNewPhone = normalizePhone(newPhone);
  if (normalizedNewPhone.length !== 10) {
    return jsonResponse(400, { success: false, error: 'Phone number must be 10 digits.' });
  }

  const db = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const verifiedSession = await verifyAndLoadCustomerSession(db, customerSessionToken);
  if (!verifiedSession.valid) {
    return jsonResponse(401, { success: false, error: verifiedSession.error });
  }

  const customerId = verifiedSession.session.customer_id;

  const { data: customer, error: customerError } = await db
    .from('customers')
    .select('phone')
    .eq('id', customerId)
    .maybeSingle();

  if (customerError || !customer) {
    console.error('[customer-request-phone-update] customer lookup failed', customerError);
    return jsonResponse(500, { success: false, error: 'Could not verify customer profile.' });
  }

  if (customer.phone === normalizedNewPhone) {
    return jsonResponse(400, { success: false, error: 'This phone number is already on your account.' });
  }

  const { data: existingPhoneMatch, error: existingPhoneError } = await db
    .from('customers')
    .select('id')
    .eq('phone', normalizedNewPhone)
    .maybeSingle();

  if (existingPhoneError) {
    console.error('[customer-request-phone-update] phone uniqueness lookup failed', existingPhoneError);
    return jsonResponse(500, { success: false, error: 'Could not verify phone availability.' });
  }

  if (existingPhoneMatch?.id) {
    return jsonResponse(409, { success: false, error: 'This phone number is already in use.' });
  }

  const nowIso = new Date().toISOString();
  const nowTs = Date.now();
  const { data: existingRequest, error: existingRequestError } = await db
    .from('customer_phone_update_requests')
    .select('*')
    .eq('customer_id', customerId)
    .eq('status', 'pending')
    .order('requested_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingRequestError) {
    console.error('[customer-request-phone-update] pending request lookup failed', existingRequestError);
    return jsonResponse(500, { success: false, error: 'Could not process your request.' });
  }

  if (existingRequest && existingRequest.locked_until) {
    const lockedUntil = new Date(existingRequest.locked_until).getTime();
    if (lockedUntil > nowTs) {
      return jsonResponse(429, { success: false, error: 'Too many failed attempts. Please try again later.' });
    }
  }

  const isExistingActive = existingRequest && existingRequest.status === 'pending' && new Date(existingRequest.expires_at).getTime() > nowTs;
  if (isExistingActive && existingRequest && existingRequest.new_phone_normalized !== normalizedNewPhone) {
    return jsonResponse(400, {
      success: false,
      error: 'You already have a pending phone update request. Complete it before requesting a different number.',
    });
  }

  if (isExistingActive && existingRequest) {
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
      .from('customer_phone_update_requests')
      .update({
        otp_hash: otpHash,
        expires_at: expiresAtIso,
        last_otp_sent_at: nowIso,
        resend_attempts: (existingRequest.resend_attempts ?? 0) + 1,
      })
      .eq('id', existingRequest.id)
      .select('id')
      .maybeSingle();

    if (updateError || !updatedRequest?.id) {
      console.error('[customer-request-phone-update] request update failed', updateError);
      return jsonResponse(500, { success: false, error: 'Could not create phone update request.' });
    }
    requestId = updatedRequest.id;
  } else {
    const { data: inserted, error: insertError } = await db
      .from('customer_phone_update_requests')
      .insert({
        customer_id: customerId,
        new_phone: newPhone,
        new_phone_normalized: normalizedNewPhone,
        otp_hash: otpHash,
        status: 'pending',
        requested_at: nowIso,
        expires_at: expiresAtIso,
        last_otp_sent_at: nowIso,
        otp_attempts: 0,
        resend_attempts: 0,
      })
      .select('id')
      .maybeSingle();

    if (insertError || !inserted?.id) {
      console.error('[customer-request-phone-update] request insert failed', insertError);
      return jsonResponse(500, { success: false, error: 'Could not create phone update request.' });
    }
    requestId = inserted.id;
  }

  try {
    await sendSms(normalizedNewPhone, `Your CULTIV verification code is ${otpCode}`);
  } catch (error) {
    console.error('[customer-request-phone-update] SMS send failed', error);
    return jsonResponse(500, { success: false, error: 'Could not send verification code.' });
  }

  return jsonResponse(200, {
    success: true,
    message: 'A verification code has been sent to your new phone number.',
    requestId,
    expiresAt: expiresAtIso,
  });
});
