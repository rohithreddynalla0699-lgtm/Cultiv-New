// @ts-nocheck

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { verifyAndLoadCustomerSession } from '../_shared/customer-session.ts';
import { verifyOtp } from '../_shared/phone-update.ts';

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

const MAX_OTP_ATTEMPTS = 5;
const LOCKOUT_MS = 30 * 60 * 1000;

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

  let body: { customerSessionToken?: string; requestId?: string; otpCode?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse(400, { success: false, error: 'Invalid JSON body.' });
  }

  const customerSessionToken = (body.customerSessionToken ?? '').trim();
  const requestId = (body.requestId ?? '').trim();
  const otpCode = (body.otpCode ?? '').trim();

  if (!customerSessionToken) {
    return jsonResponse(400, { success: false, error: 'Customer session token is required.' });
  }

  if (!requestId) {
    return jsonResponse(400, { success: false, error: 'Request ID is required.' });
  }

  if (!otpCode) {
    return jsonResponse(400, { success: false, error: 'Verification code is required.' });
  }

  const db = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const verifiedSession = await verifyAndLoadCustomerSession(db, customerSessionToken);
  if (!verifiedSession.valid) {
    return jsonResponse(401, { success: false, error: verifiedSession.error });
  }

  const customerId = verifiedSession.session.customer_id;
  const nowTs = Date.now();
  const nowIso = new Date(nowTs).toISOString();

  const { data: requestRow, error: requestError } = await db
    .from('customer_phone_update_requests')
    .select('*')
    .eq('id', requestId)
    .eq('customer_id', customerId)
    .eq('status', 'pending')
    .maybeSingle();

  if (requestError) {
    console.error('[customer-confirm-phone-update] request lookup failed', requestError);
    return jsonResponse(500, { success: false, error: 'Could not verify your request.' });
  }

  if (!requestRow) {
    return jsonResponse(404, { success: false, error: 'Phone update request not found.' });
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
      .from('customer_phone_update_requests')
      .update({ status: 'failed', locked_until: null })
      .eq('id', requestId);
    return jsonResponse(400, { success: false, error: 'This verification code has expired.' });
  }

  const isValidOtp = await verifyOtp(otpCode, requestRow.otp_hash);
  if (!isValidOtp) {
    const nextAttempts = (requestRow.otp_attempts ?? 0) + 1;
    const updates: Record<string, unknown> = { otp_attempts: nextAttempts };

    if (nextAttempts >= MAX_OTP_ATTEMPTS) {
      updates.status = 'failed';
      updates.locked_until = new Date(nowTs + LOCKOUT_MS).toISOString();
    }

    await db
      .from('customer_phone_update_requests')
      .update(updates)
      .eq('id', requestId);

    return jsonResponse(400, { success: false, error: 'Invalid verification code.' });
  }

  const { data: phoneConflict, error: conflictError } = await db
    .from('customers')
    .select('id')
    .eq('phone', requestRow.new_phone_normalized)
    .neq('id', customerId)
    .maybeSingle();

  if (conflictError) {
    console.error('[customer-confirm-phone-update] phone conflict check failed', conflictError);
    return jsonResponse(500, { success: false, error: 'Could not confirm your phone update.' });
  }

  if (phoneConflict?.id) {
    await db
      .from('customer_phone_update_requests')
      .update({ status: 'failed', locked_until: new Date(nowTs + LOCKOUT_MS).toISOString() })
      .eq('id', requestId);
    return jsonResponse(409, { success: false, error: 'This phone number is no longer available.' });
  }

  const { error: updateError } = await db
    .from('customers')
    .update({ phone: requestRow.new_phone_normalized, phone_verified: true })
    .eq('id', customerId);

  if (updateError) {
    console.error('[customer-confirm-phone-update] phone update failed', updateError);
    await db
      .from('customer_phone_update_requests')
      .update({ status: 'failed', locked_until: new Date(nowTs + LOCKOUT_MS).toISOString() })
      .eq('id', requestId);
    return jsonResponse(500, { success: false, error: 'Could not update your phone number.' });
  }

  await db
    .from('customer_phone_update_requests')
    .update({ status: 'verified' })
    .eq('id', requestId);

  return jsonResponse(200, {
    success: true,
    message: 'Your phone number has been updated successfully.',
  });
});
