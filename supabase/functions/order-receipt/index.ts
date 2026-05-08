// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { loadAuthorizedReceipt } from '../_shared/receipt-data.ts';
import { createCorsHeaders } from '../_shared/cors.ts';

interface OrderReceiptRequest {
  orderId?: string;
  customerSessionToken?: string;
  internalSessionToken?: string;
}

const DEBUG_LOGS = Deno.env.get('RECEIPT_DEBUG_LOGS') === 'true';

const json = (corsHeaders: Record<string, string>, status: number, payload: Record<string, unknown>) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });

const serializeError = (error: unknown) => {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack ?? null,
    };
  }

  try {
    return JSON.parse(JSON.stringify(error));
  } catch {
    return { value: String(error) };
  }
};

const log = (event: string, details?: Record<string, unknown>) => {
  if (!DEBUG_LOGS) {
    return;
  }
  console.log(`[order-receipt] ${event}`, details ?? {});
};

const logError = (event: string, details?: Record<string, unknown>) => {
  console.error(`[order-receipt] ${event}`, details ?? {});
};

Deno.serve(async (req) => {
  try {
    const corsHeaders = createCorsHeaders(req);
    log('invoked', {
      method: req.method,
      url: req.url,
    });

    if (req.method === 'OPTIONS') {
      log('cors_preflight');
      return new Response('ok', { headers: corsHeaders });
    }

    if (req.method !== 'POST') {
      log('method_not_allowed', { method: req.method });
      return json(405, { error: 'Method not allowed.' });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) {
      logError('server_misconfigured', {
        hasSupabaseUrl: Boolean(supabaseUrl),
        hasServiceRoleKey: Boolean(serviceRoleKey),
      });
      return json(500, { error: 'Server is not configured for receipts.' });
    }

    let body: OrderReceiptRequest;
    try {
      body = await req.json();
    } catch (error) {
      log('invalid_json_body', { error: serializeError(error) });
      return json(400, { error: 'Invalid JSON body.' });
    }

    const orderId = (body.orderId ?? '').trim();
    const customerSessionToken = (body.customerSessionToken ?? '').trim();
    const internalSessionToken = (body.internalSessionToken ?? '').trim();

    log('request_body_received', {
      orderId,
      hasCustomerSessionToken: Boolean(customerSessionToken),
      hasInternalSessionToken: Boolean(internalSessionToken),
    });

    if (!orderId) {
      log('bad_request_missing_order_id');
      return json(corsHeaders, 400, { error: 'orderId is required.' });
    }
    if (!customerSessionToken && !internalSessionToken) {
      log('bad_request_missing_session_token', { orderId });
      return json(corsHeaders, 400, { error: 'A customer or internal session token is required.' });
    }

    const db = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    let receiptData;
    let authContext: 'customer' | 'internal';
    try {
      const result = await loadAuthorizedReceipt({
        db,
        orderId,
        customerSessionToken,
        internalSessionToken,
      });
      receiptData = result.receipt;
      authContext = result.authContext;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not load order receipt.';
      if (/expired|revoked|not found|required/i.test(message) && /session/i.test(message)) {
        return json(corsHeaders, 401, { error: message });
      }
      if (/does not belong|scope does not allow|permission/i.test(message)) {
        return json(corsHeaders, 403, { error: message });
      }
      if (/Order not found/i.test(message)) {
        return json(corsHeaders, 404, { error: message });
      }
      return json(corsHeaders, 500, { error: message });
    }

    log('receipt_loaded_successfully', {
      orderId,
      authContext,
      storeId: receiptData.meta.storeId ?? null,
      customerIdentifier: receiptData.meta.customerEmail ?? receiptData.meta.customerPhone ?? null,
      hasPayment: Boolean(receiptData.meta.paymentMethod),
      itemCount: receiptData.items.length,
    });

    return json(corsHeaders, 200, {
      success: true,
      receipt: receiptData,
    });
  } catch (error) {
    logError('unhandled_error', { error: serializeError(error) });
    return json(createCorsHeaders(req), 500, { error: 'Unexpected error while loading receipt.' });
  }
});
