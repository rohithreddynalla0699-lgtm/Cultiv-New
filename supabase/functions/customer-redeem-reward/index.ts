// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { verifyAndLoadCustomerSession } from '../_shared/customer-session.ts';
import { buildRewardSummary } from '../_shared/rewards-summary.ts';
import { expireAvailableRewardEntitlements } from '../_shared/reward-entitlement-reconciliation.ts';

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json(405, { success: false, error: 'Method not allowed.' });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return json(500, { success: false, error: 'Server is not configured.' });
  }

  let body: { customerSessionToken?: string; rewardId?: string; rewardCode?: string };
  try {
    body = await req.json();
  } catch {
    return json(400, { success: false, error: 'Invalid JSON body.' });
  }

  const customerSessionToken = (body.customerSessionToken ?? '').trim();
  const rewardId = (body.rewardId ?? '').trim() || null;
  const rewardCode = (body.rewardCode ?? '').trim() || null;

  if (!customerSessionToken) {
    return json(400, { success: false, error: 'customerSessionToken is required.' });
  }

  if (!rewardId && !rewardCode) {
    return json(400, { success: false, error: 'rewardId or rewardCode is required.' });
  }

  const db = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const verifiedSession = await verifyAndLoadCustomerSession(db, customerSessionToken);
  if (!verifiedSession.valid) {
    return json(401, { success: false, error: verifiedSession.error });
  }

  try {
    await expireAvailableRewardEntitlements(db, verifiedSession.session.customer_id);

    const { data, error } = await db.rpc('redeem_customer_reward', {
      p_customer_id: verifiedSession.session.customer_id,
      p_reward_id: rewardId,
      p_reward_code: rewardCode,
    });

    if (error || !data?.success) {
      const message = error?.message || data?.message || 'Could not redeem reward right now.';
      return json(400, { success: false, error: message });
    }

    const summary = await buildRewardSummary(db, verifiedSession.session.customer_id);

    return json(200, {
      success: true,
      message: `${data.rewardTitle ?? 'Reward'} is now saved to your CULTIV profile.`,
      reward: {
        entitlementId: data.entitlementId,
        rewardId: data.rewardId,
        rewardCode: data.rewardCode,
        rewardTitle: data.rewardTitle,
      },
      summary,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not redeem reward right now.';
    return json(400, { success: false, error: message });
  }
});
