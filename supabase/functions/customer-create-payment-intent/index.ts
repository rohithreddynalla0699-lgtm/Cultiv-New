// @ts-ignore: Deno remote imports
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore: Deno remote imports
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.0";
import { canonicalizeOrderPricing } from "../_shared/canonical-pricing.ts";
import { verifyAndLoadCustomerSession } from "../_shared/customer-session.ts";

declare const Deno: any;

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonResponse = (body: Record<string, unknown>, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });

interface CreatePaymentIntentRequest {
  idempotencyKey?: string;
  customerSessionToken?: string;
  order?: {
    customer_id?: string | null;
    user_id?: string | null;
    store_id?: string;
    payment_method?: string | null;
    total_amount?: number;
  } & Record<string, unknown>;
  items?: Array<Record<string, unknown>>;
}

type CheckoutGateway = "razorpay" | "mock";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const DEBUG_LOGS = Deno.env.get("CHECKOUT_DEBUG_LOGS") === "true";
const NON_PRODUCTION_ENV_VALUES = new Set(["development", "dev", "staging", "stage", "test", "local"]);

const logStage = (stage: string, details?: Record<string, unknown>) => {
  if (!DEBUG_LOGS) {
    return;
  }
  if (details) {
    console.log(`[customer-create-payment-intent] ${stage}`, details);
    return;
  }
  console.log(`[customer-create-payment-intent] ${stage}`);
};

const errorResponse = (
  status: number,
  code: string,
  message: string,
  details?: Record<string, unknown>,
) => jsonResponse({
  success: false,
  code,
  message,
  ...(details ? { details } : {}),
}, status);

const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
};

const createBasicAuthHeader = (username: string, password: string): string => {
  const utf8Bytes = new TextEncoder().encode(`${username}:${password}`);
  const encoded = bytesToBase64(utf8Bytes);
  return `Basic ${encoded}`;
};

const toPaiseAmount = (rupeeAmount: unknown): number => {
  const parsed = typeof rupeeAmount === "number"
    ? rupeeAmount
    : Number(String(rupeeAmount ?? "").trim());

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return Number.NaN;
  }

  // Razorpay requires integer paise.
  return Math.round((parsed + Number.EPSILON) * 100);
};

const createSafeReceipt = (idempotencyKey: string): string => {
  const cleaned = idempotencyKey.toLowerCase().replace(/[^a-z0-9_-]/g, "");
  const suffix = cleaned.length > 0 ? cleaned.slice(0, 24) : String(Date.now());
  const receipt = `cultiv_${suffix}`;
  return receipt.slice(0, 40);
};

const getRuntimeEnvironment = (): string => (
  Deno.env.get("APP_ENV")
  || Deno.env.get("ENVIRONMENT")
  || Deno.env.get("NODE_ENV")
  || Deno.env.get("VERCEL_ENV")
  || "development"
).trim().toLowerCase();

const ensureMockProviderAllowed = () => {
  if (getRuntimeEnvironment() === "production" || !NON_PRODUCTION_ENV_VALUES.has(getRuntimeEnvironment())) {
    throw new Error("Mock payment provider is not allowed in production.");
  }
};

const createRazorpayOrder = async (
  keyId: string,
  keySecret: string,
  amountPaise: number,
  receipt: string,
): Promise<{ orderId: string; currency: string; amountPaise: number }> => {
  const requestPayload = {
    amount: amountPaise,
    currency: "INR",
    receipt,
    payment_capture: 1,
  };

  logStage("before_razorpay_order_call", {
    amountPaise,
    currency: "INR",
    receipt,
    receiptLength: receipt.length,
    payloadShape: {
      amountType: typeof requestPayload.amount,
      currencyType: typeof requestPayload.currency,
      receiptType: typeof requestPayload.receipt,
      paymentCaptureType: typeof requestPayload.payment_capture,
    },
    authHeaderPrepared: Boolean(keyId && keySecret),
  });

  const authorizationHeader = createBasicAuthHeader(keyId, keySecret);
  const response = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: authorizationHeader,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestPayload),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.id) {
    const gatewayError = payload?.error?.description || payload?.error?.reason || payload?.error?.code;
    const message = typeof gatewayError === "string" && gatewayError.trim()
      ? gatewayError
      : "Could not create gateway payment order.";
    throw new Error(`Razorpay order create failed (${response.status}): ${message}`);
  }

  logStage("after_razorpay_order_call", {
    gatewayOrderId: payload?.id,
    amount: payload?.amount,
    currency: payload?.currency,
  });

  return {
    orderId: String(payload.id),
    currency: String(payload.currency || "INR"),
    amountPaise: Number(payload.amount || amountPaise),
  };
};

const createMockGatewayOrder = (amountPaise: number, receipt: string): { orderId: string; currency: string; amountPaise: number } => {
  ensureMockProviderAllowed();
  return {
    orderId: `mock_order_${receipt.slice(-8)}_${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`,
    currency: "INR",
    amountPaise,
  };
};

const resolveCheckoutGateway = (): CheckoutGateway => {
  const configured = (Deno.env.get("PAYMENT_PROVIDER") || "").trim().toLowerCase();
  if (configured === "razorpay") {
    return "razorpay";
  }
  if (configured === "mock") {
    ensureMockProviderAllowed();
    return "mock";
  }
  throw new Error("PAYMENT_PROVIDER must be set to razorpay or mock.");
};

serve(async (req: any) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    logStage("function_start", {
      method: req.method,
      hasAuthorizationHeader: Boolean(req.headers?.get("authorization")),
      authPathUsed: "custom_session",
      paymentProvider: (() => {
        try {
          return resolveCheckoutGateway();
        } catch {
          return "unconfigured";
        }
      })(),
      runtimeEnvironment: getRuntimeEnvironment(),
      hasSupabaseUrl: Boolean(Deno.env.get("SUPABASE_URL")),
      hasServiceRoleKey: Boolean(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")),
      hasRazorpayKeyId: Boolean(Deno.env.get("RAZORPAY_KEY_ID")),
      hasRazorpayKeySecret: Boolean(Deno.env.get("RAZORPAY_KEY_SECRET")),
    });

    if (req.method !== "POST") {
      return jsonResponse({ success: false, message: "Method not allowed" }, 405);
    }

    const body = (await req.json()) as CreatePaymentIntentRequest;
    const idempotencyKey = body.idempotencyKey?.trim();
    const customerSessionToken = body.customerSessionToken?.trim();
    const order = body.order;
    const items = Array.isArray(body.items) ? body.items : [];

    logStage("custom_session_presence", {
      customerSessionTokenPresent: Boolean(customerSessionToken),
    });

    if (!customerSessionToken) {
      return errorResponse(401, "customer_session_missing", "Customer session is required for checkout.");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
    );

    const verifiedSession = await verifyAndLoadCustomerSession(supabase, customerSessionToken);
    if (!verifiedSession.valid) {
      return errorResponse(401, "customer_session_invalid", verifiedSession.error);
    }

    const resolvedCustomerIdFromSession = verifiedSession.session.customer_id;
    logStage("customer_session_verified", {
      customerIdResolved: Boolean(resolvedCustomerIdFromSession),
      customerIdPrefix: resolvedCustomerIdFromSession.slice(0, 8),
    });

    if (!idempotencyKey) {
      return errorResponse(400, "invalid_payload", "Missing checkout idempotency key.");
    }

    if (!order || !order.store_id || !items.length) {
      return errorResponse(400, "invalid_payload", "Invalid checkout payload.", {
        hasOrder: Boolean(order),
        hasStoreId: Boolean(order?.store_id),
        itemCount: items.length,
      });
    }

    const paymentMethod = (order.payment_method || "").toString().trim().toLowerCase();
    logStage("validated_payment_method", { paymentMethod });
    if (paymentMethod !== "upi" && paymentMethod !== "card") {
      return errorResponse(400, "invalid_payload", "Only UPI and Card are allowed for website checkout.", {
        paymentMethod,
      });
    }

    let checkoutGateway: CheckoutGateway;
    try {
      checkoutGateway = resolveCheckoutGateway();
    } catch (error) {
      return errorResponse(503, "payment_gateway_unavailable", error instanceof Error ? error.message : "Online payment gateway is not configured.");
    }
    const razorpayKeyId = Deno.env.get("RAZORPAY_KEY_ID") || "";
    const razorpayKeySecret = Deno.env.get("RAZORPAY_KEY_SECRET") || "";

    if (checkoutGateway === "razorpay" && !razorpayKeyId) {
      return errorResponse(500, "missing_rzp_env", "RAZORPAY_KEY_ID is missing in Edge Function environment.");
    }

    if (checkoutGateway === "razorpay" && !razorpayKeySecret) {
      return errorResponse(500, "missing_rzp_env", "RAZORPAY_KEY_SECRET is missing in Edge Function environment.");
    }

    const storeIdRaw = String(order.store_id).trim();
    let resolvedStoreId = storeIdRaw;
    let storeIdSource: "uuid" | "slug-city" | "invalid" = "uuid";

    if (!UUID_PATTERN.test(storeIdRaw)) {
      const citySlug = storeIdRaw.startsWith("store-") ? storeIdRaw.slice("store-".length).trim().toLowerCase() : "";

      if (!citySlug) {
        storeIdSource = "invalid";
      } else {
        const cityCandidate = citySlug.replace(/-/g, " ");
        const { data: matchedStore, error: storeLookupError } = await supabase
          .from("stores")
          .select("id, city")
          .ilike("city", cityCandidate)
          .maybeSingle();

        if (storeLookupError) {
          logStage("store_lookup_error", {
            storeIdRaw,
            cityCandidate,
            code: storeLookupError.code,
            message: storeLookupError.message,
          });
          if (storeLookupError.code === "42P01") {
            return errorResponse(500, "db_dependency_missing", "Missing required stores table. Apply database migrations.", {
              table: "stores",
            });
          }

          return errorResponse(500, "db_lookup_failed", "Could not validate store id.", {
            code: storeLookupError.code,
          });
        }

        if (matchedStore?.id) {
          resolvedStoreId = matchedStore.id;
          storeIdSource = "slug-city";
        } else {
          storeIdSource = "invalid";
        }
      }
    }

    if (!UUID_PATTERN.test(resolvedStoreId)) {
      return errorResponse(400, "invalid_payload", "store_id must be a valid store UUID.", {
        receivedStoreId: storeIdRaw,
      });
    }

    const customerIdFromPayload = typeof order.customer_id === "string" && order.customer_id.trim()
      ? order.customer_id.trim()
      : null;

    if (customerIdFromPayload && !UUID_PATTERN.test(customerIdFromPayload)) {
      return errorResponse(400, "invalid_payload", "customer_id must be a valid UUID when provided.");
    }

    if (customerIdFromPayload && customerIdFromPayload !== resolvedCustomerIdFromSession) {
      return errorResponse(403, "unauthorized_customer_checkout", "Payload customer does not match authenticated customer session.");
    }

    const customerId = resolvedCustomerIdFromSession;

    logStage("validated_identifiers", {
      customerIdPresent: Boolean(customerId),
      storeId: resolvedStoreId,
      storeIdSource,
      idempotencyKeyPrefix: idempotencyKey.slice(0, 12),
    });

    const { data: customerRow, error: customerLookupError } = await supabase
      .from("customers")
      .select("id, is_active")
      .eq("id", customerId)
      .maybeSingle();

    if (customerLookupError) {
      if (customerLookupError.code === "42P01") {
        return errorResponse(500, "db_dependency_missing", "Missing required customers table. Apply database migrations.", {
          table: "customers",
        });
      }

      return errorResponse(500, "db_lookup_failed", "Could not validate customer id.", {
        code: customerLookupError.code,
      });
    }

    if (!customerRow?.id) {
      return errorResponse(404, "customer_not_found", "Customer was not found for authenticated customer session.");
    }

    if (customerRow.is_active === false) {
      return errorResponse(403, "unauthorized_customer_checkout", "Customer account is inactive for checkout.");
    }

    let canonicalPricing;
    try {
      canonicalPricing = await canonicalizeOrderPricing(supabase, {
        items,
        requestedSubtotal: order.subtotal_amount,
        requestedDiscount: order.discount_amount,
        requestedTaxAmount: order.tax_amount,
        requestedTipAmount: order.tip_amount,
        requestedTipPercentage: order.tip_percentage,
        requestedTotal: order.total_amount,
      });
    } catch (error) {
      return errorResponse(400, "invalid_payload", error instanceof Error ? error.message : "Invalid checkout totals.");
    }

    const amount = canonicalPricing.total;
    logStage("validated_amount", { amount });
    if (!Number.isFinite(amount) || amount <= 0) {
      return errorResponse(400, "invalid_payload", "Invalid payable amount.", {
        amount,
      });
    }

    const ordersDependencyProbe = await supabase
      .from("orders")
      .select("payment_status, paid_at, payment_reference, payment_gateway")
      .limit(1);

    if (ordersDependencyProbe.error) {
      logStage("orders_dependency_warning", {
        code: ordersDependencyProbe.error.code,
        message: ordersDependencyProbe.error.message,
      });
    }

    logStage("before_idempotency_lookup", {
      idempotencyKeyPrefix: idempotencyKey.slice(0, 12),
    });
    const { data: existing, error: existingError } = await supabase
      .from("customer_payments")
      .select("payment_id, status, order_id, gateway, gateway_order_id, amount")
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();

    if (existingError) {
      console.error("[customer-create-payment-intent] idempotency lookup failed", existingError);
      if (existingError.code === "42P01") {
        return errorResponse(500, "db_dependency_missing", "Missing required customer_payments table. Apply checkout migration.", {
          table: "customer_payments",
        });
      }

      return errorResponse(500, "db_lookup_failed", "Could not start payment. Idempotency lookup failed.", {
        code: existingError.code,
      });
    }

    if (existing?.payment_id) {
      if (existing.gateway !== 'razorpay' && existing.gateway !== 'mock') {
        return errorResponse(503, "payment_gateway_unavailable", "Online payment gateway is not configured.");
      }

      if (existing.status === "succeeded" && existing.order_id) {
        return jsonResponse({
          success: true,
          paymentId: existing.payment_id,
          status: existing.status,
          orderId: existing.order_id,
          message: "Payment already completed for this checkout attempt.",
        }, 200);
      }

      return jsonResponse({
        success: true,
        paymentId: existing.payment_id,
        status: existing.status,
        gateway: existing.gateway,
        gatewayOrderId: existing.gateway_order_id,
        gatewayKeyId: existing.gateway === "razorpay" ? razorpayKeyId : undefined,
        amount: Number(existing.amount ?? amount),
        amountPaise: toPaiseAmount(existing.amount ?? amount),
        currency: "INR",
      }, 200);
    }

    const amountPaise = toPaiseAmount(amount);
    if (!Number.isFinite(amountPaise) || amountPaise <= 0) {
      return errorResponse(400, "invalid_payload", "Amount is invalid after currency conversion.", {
        amount,
        amountPaise,
      });
    }

    const canonicalOrderPayload = {
      ...order,
      customer_id: customerId,
      user_id: null,
      store_id: resolvedStoreId,
      subtotal_amount: canonicalPricing.subtotal,
      discount_amount: canonicalPricing.discount,
      tax_amount: canonicalPricing.taxAmount,
      tip_amount: canonicalPricing.tipAmount,
      tip_percentage: canonicalPricing.tipPercentage,
      total_amount: canonicalPricing.total,
    };

    const receipt = createSafeReceipt(idempotencyKey);
    let gatewayOrder: { orderId: string; currency: string; amountPaise: number };

    try {
      gatewayOrder = checkoutGateway === "razorpay"
        ? await createRazorpayOrder(razorpayKeyId, razorpayKeySecret, amountPaise, receipt)
        : createMockGatewayOrder(amountPaise, receipt);
    } catch (error) {
      logStage("gateway_order_create_failed", {
        message: error instanceof Error ? error.message : String(error),
        gateway: checkoutGateway,
      });
      return errorResponse(502, "gateway_order_create_failed", "Could not create payment order with gateway.", {
        reason: error instanceof Error ? error.message : "unknown_gateway_error",
      });
    }

    logStage("before_db_insert", {
      paymentMethod,
      amount,
      amountPaise,
      customerIdPresent: Boolean(customerId),
      storeId: resolvedStoreId,
      gatewayOrderId: gatewayOrder.orderId,
    });
    const { data: inserted, error: insertError } = await supabase
      .from("customer_payments")
      .insert({
        idempotency_key: idempotencyKey,
        customer_id: customerId,
        user_id: order.user_id ?? null,
        store_id: resolvedStoreId,
        amount,
        currency: gatewayOrder.currency,
        payment_method: paymentMethod,
        gateway: checkoutGateway,
        gateway_order_id: gatewayOrder.orderId,
        status: "initiated",
        order_payload: canonicalOrderPayload,
        items_payload: canonicalPricing.items,
        metadata: {
          provider: checkoutGateway,
          taxable_subtotal: canonicalPricing.taxableSubtotal,
        },
      })
      .select("payment_id")
      .single();

    if (insertError || !inserted?.payment_id) {
      console.error("[customer-create-payment-intent] insert failed", insertError);
      return errorResponse(500, "db_insert_failed", "Could not create payment intent record.", {
        code: insertError?.code,
        message: insertError?.message,
      });
    }

    logStage("before_final_response", {
      paymentId: inserted.payment_id,
      gatewayOrderId: gatewayOrder.orderId,
      amount,
      amountPaise: gatewayOrder.amountPaise,
    });

    return jsonResponse({
      success: true,
      paymentId: inserted.payment_id,
      status: "initiated",
      gateway: checkoutGateway,
      gatewayOrderId: gatewayOrder.orderId,
      gatewayKeyId: checkoutGateway === "razorpay" ? razorpayKeyId : undefined,
      amount,
      amountPaise: gatewayOrder.amountPaise,
      currency: gatewayOrder.currency,
    }, 201);
  } catch (err) {
    const error = err as { message?: string; stack?: string } | null;
    console.error("[customer-create-payment-intent] unexpected error", {
      message: error?.message ?? String(err),
      stack: error?.stack,
      raw: err,
    });
    return errorResponse(500, "unexpected_error", "Could not start prepaid checkout. Please try again.", {
      reason: error?.message ?? "unknown_error",
    });
  }
});
