// @ts-ignore: Deno remote imports
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore: Deno remote imports
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.0";

declare const Deno: any;

const NON_PRODUCTION_ENV_VALUES = new Set(["development", "dev", "staging", "stage", "test", "local"]);

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

interface ConfirmPaymentRequest {
  paymentId?: string;
  outcome?: "succeeded" | "failed" | "cancelled";
  gatewayOrderId?: string;
  gatewayPaymentId?: string;
  gatewaySignature?: string;
  failureReason?: string;
}

interface FinalizePaymentResult {
  orderId?: string | null;
  orderNumber?: string | null;
  orderStatus?: string | null;
}

const getRuntimeEnvironment = (): string => (
  Deno.env.get("APP_ENV")
  || Deno.env.get("ENVIRONMENT")
  || Deno.env.get("NODE_ENV")
  || Deno.env.get("VERCEL_ENV")
  || "development"
).trim().toLowerCase();

const ensureMockProviderAllowed = () => {
  const runtimeEnvironment = getRuntimeEnvironment();
  if (runtimeEnvironment === "production" || !NON_PRODUCTION_ENV_VALUES.has(runtimeEnvironment)) {
    throw new Error("Mock payment provider is not allowed in production.");
  }
};

const toHex = (bytes: Uint8Array) => Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");

const verifyRazorpaySignature = async (
  orderId: string,
  paymentId: string,
  signature: string,
  secret: string,
): Promise<boolean> => {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signed = await crypto.subtle.sign("HMAC", key, encoder.encode(`${orderId}|${paymentId}`));
  const expected = toHex(new Uint8Array(signed));
  return expected === signature;
};

serve(async (req: any) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    if (req.method !== "POST") {
      return jsonResponse({ success: false, message: "Method not allowed" }, 405);
    }

    const body = (await req.json()) as ConfirmPaymentRequest;
    const paymentId = body.paymentId?.trim();
    const outcome = body.outcome;

    if (!paymentId || !outcome) {
      return jsonResponse({ success: false, message: "Missing payment confirmation payload." }, 400);
    }

    if (!["succeeded", "failed", "cancelled"].includes(outcome)) {
      return jsonResponse({ success: false, message: "Invalid payment outcome." }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
    );

    const { data: paymentRow, error: paymentLookupError } = await supabase
      .from("customer_payments")
      .select("*")
      .eq("payment_id", paymentId)
      .maybeSingle();

    if (paymentLookupError) {
      console.error("[customer-confirm-payment-and-create-order] lookup failed", paymentLookupError);
      return jsonResponse({ success: false, message: "Could not verify payment." }, 500);
    }

    if (!paymentRow) {
      return jsonResponse({ success: false, message: "Payment attempt not found." }, 404);
    }

    if (paymentRow.status === "succeeded" && paymentRow.order_id) {
      const { data: existingOrder } = await supabase
        .from("orders")
        .select("order_id, order_number, order_status")
        .eq("order_id", paymentRow.order_id)
        .maybeSingle();

      return jsonResponse({
        success: true,
        orderId: existingOrder?.order_id ?? paymentRow.order_id,
        orderNumber: existingOrder?.order_number ?? null,
        orderStatus: existingOrder?.order_status ?? "placed",
        message: "Order already confirmed for this payment.",
      }, 200);
    }

    if (outcome === "failed" || outcome === "cancelled") {
      await supabase
        .from("customer_payments")
        .update({
          status: outcome,
          failure_message: body.failureReason || (outcome === "cancelled" ? "Customer cancelled checkout." : "Payment failed."),
          gateway_order_id: body.gatewayOrderId || paymentRow.gateway_order_id,
          gateway_payment_id: body.gatewayPaymentId || paymentRow.gateway_payment_id,
          updated_at: new Date().toISOString(),
        })
        .eq("payment_id", paymentId);

      return jsonResponse({
        success: false,
        message: outcome === "cancelled" ? "Payment was cancelled. No order was created." : "Payment failed. No order was created.",
      }, 400);
    }

    const gateway = String(paymentRow.gateway || "").trim().toLowerCase();
    let gatewayOrderId = body.gatewayOrderId?.trim() || paymentRow.gateway_order_id || undefined;
    let gatewayPaymentId = body.gatewayPaymentId?.trim() || paymentRow.gateway_payment_id || undefined;
    let gatewaySignature = body.gatewaySignature?.trim() || paymentRow.gateway_signature || undefined;

    if (gateway === "mock") {
      try {
        ensureMockProviderAllowed();
      } catch (error) {
        console.error("[customer-confirm-payment-and-create-order] mock provider not allowed", error);
        return jsonResponse({ success: false, message: "Mock payment provider is not allowed in production." }, 400);
      }

      if (!gatewayOrderId) {
        gatewayOrderId = `mock_order_${paymentId.replace(/[^a-z0-9]/gi, "").slice(0, 12)}`;
      }
      if (!gatewayPaymentId) {
        gatewayPaymentId = `mock_payment_${paymentId.replace(/[^a-z0-9]/gi, "").slice(0, 12)}`;
      }
      gatewaySignature = undefined;
    } else if (gateway === "razorpay") {
      if (!gatewayOrderId) {
        await supabase
          .from("customer_payments")
          .update({
            status: "failed",
            failure_message: "Missing gateway order id.",
            updated_at: new Date().toISOString(),
          })
          .eq("payment_id", paymentId);

        return jsonResponse({ success: false, message: "Payment verification failed." }, 400);
      }

      if (paymentRow.gateway_order_id && paymentRow.gateway_order_id !== gatewayOrderId) {
        return jsonResponse({ success: false, message: "Gateway order mismatch." }, 400);
      }

      const razorpaySecret = Deno.env.get("RAZORPAY_KEY_SECRET") || "";
      if (!gatewayPaymentId || !gatewaySignature || !razorpaySecret) {
        await supabase
          .from("customer_payments")
          .update({
            status: "failed",
            failure_message: "Missing payment verification fields.",
            updated_at: new Date().toISOString(),
          })
          .eq("payment_id", paymentId);

        return jsonResponse({ success: false, message: "Payment verification failed." }, 400);
      }

      const signatureValid = await verifyRazorpaySignature(gatewayOrderId, gatewayPaymentId, gatewaySignature, razorpaySecret);
      if (!signatureValid) {
        await supabase
          .from("customer_payments")
          .update({
            status: "failed",
            failure_message: "Invalid payment signature.",
            gateway_payment_id: gatewayPaymentId,
            gateway_signature: gatewaySignature,
            updated_at: new Date().toISOString(),
          })
          .eq("payment_id", paymentId);

        return jsonResponse({ success: false, message: "Payment signature verification failed." }, 400);
      }
    } else {
      return jsonResponse({ success: false, message: "Online payment gateway is not configured for live confirmation." }, 400);
    }

    const confirmedAtIso = new Date().toISOString();
    const { data: finalizeResult, error: finalizeError } = await supabase
      .rpc("finalize_customer_payment_and_create_order", {
        p_payment_id: paymentId,
        p_gateway_order_id: gatewayOrderId ?? null,
        p_gateway_payment_id: gatewayPaymentId ?? null,
        p_gateway_signature: gatewaySignature ?? null,
        p_paid_at: confirmedAtIso,
      });

    if (finalizeError) {
      console.error("[customer-confirm-payment-and-create-order] transactional finalize failed", finalizeError);
      return jsonResponse({
        success: false,
        message: "Payment captured but order could not be finalized.",
      }, 500);
    }

    const result = (finalizeResult ?? {}) as FinalizePaymentResult;
    if (!result.orderId) {
      console.error("[customer-confirm-payment-and-create-order] finalize returned incomplete result", finalizeResult);
      return jsonResponse({
        success: false,
        message: "Payment captured but order could not be finalized.",
      }, 500);
    }

    return jsonResponse({
      success: true,
      orderId: result.orderId,
      orderNumber: result.orderNumber ?? null,
      orderStatus: result.orderStatus ?? "placed",
    }, 200);
  } catch (err) {
    console.error("[customer-confirm-payment-and-create-order] unexpected error", err);
    return jsonResponse({ success: false, message: "Could not confirm payment and place order." }, 500);
  }
});
