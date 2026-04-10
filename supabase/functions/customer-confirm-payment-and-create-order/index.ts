// @ts-ignore: Deno remote imports
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore: Deno remote imports
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.0";

declare const Deno: any;

const ORDER_NUMBER_PREFIX = "CULTIV";
const ORDER_NUMBER_SEQUENCE_LENGTH = 4;

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

interface StoredOrderPayload {
  order_type: string;
  source_channel: string;
  order_status: string;
  store_id: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  payment_method: string | null;
  notes: string | null;
  subtotal_amount: number;
  discount_amount: number;
  tax_amount: number;
  tip_amount: number;
  total_amount: number;
  customer_id: string | null;
  user_id?: string | null;
  order_number?: string | null;
}

interface StoredSelectionPayload {
  option_item_id: string | null;
  group_id_snapshot: string;
  group_name_snapshot: string;
  option_name: string;
  price_modifier: number;
}

interface StoredItemPayload {
  menu_item_id: string | null;
  item_name: string;
  item_category: string;
  unit_price: number;
  quantity: number;
  line_total: number;
  selections?: StoredSelectionPayload[];
}

const formatOrderNumberDate = (date: Date) => {
  const yy = String(date.getUTCFullYear()).slice(-2);
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  return `${yy}${mm}${dd}`;
};

const getUtcDayRange = (date: Date) => {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));
  const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1, 0, 0, 0, 0));
  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  };
};

const generateOrderNumber = async (supabase: any): Promise<string> => {
  const now = new Date();
  const dateToken = formatOrderNumberDate(now);
  const { startIso, endIso } = getUtcDayRange(now);

  const { count, error } = await supabase
    .from("orders")
    .select("order_id", { count: "exact", head: true })
    .gte("created_at", startIso)
    .lt("created_at", endIso);

  if (error) {
    throw new Error(`Could not generate order number: ${error.message}`);
  }

  const sequence = (count ?? 0) + 1;
  const paddedSequence = String(sequence).padStart(ORDER_NUMBER_SEQUENCE_LENGTH, "0");
  return `${ORDER_NUMBER_PREFIX}${dateToken}${paddedSequence}`;
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
    if (gateway !== "razorpay") {
      return jsonResponse({ success: false, message: "Online payment gateway is not configured for live confirmation." }, 400);
    }

    let gatewayOrderId = body.gatewayOrderId?.trim() || paymentRow.gateway_order_id || undefined;
    let gatewayPaymentId = body.gatewayPaymentId?.trim() || undefined;
    let gatewaySignature = body.gatewaySignature?.trim() || undefined;

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

    if (gateway === "razorpay") {
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
    }

    const order = paymentRow.order_payload as StoredOrderPayload;
    const items = (paymentRow.items_payload as StoredItemPayload[]) ?? [];
    const canonicalCustomerId = (
      typeof paymentRow.customer_id === "string" && paymentRow.customer_id.trim()
        ? paymentRow.customer_id.trim()
        : (typeof order?.customer_id === "string" && order.customer_id.trim() ? order.customer_id.trim() : null)
    );

    if (!order || !order.store_id || !items.length) {
      await supabase
        .from("customer_payments")
        .update({
          status: "orphaned",
          failure_message: "Stored order payload is invalid.",
          updated_at: new Date().toISOString(),
        })
        .eq("payment_id", paymentId);

      return jsonResponse({ success: false, message: "Payment succeeded but order payload is invalid." }, 500);
    }

    let orderInsert: { order_id: string; order_number: string | null; order_status: string } | null = null;
    let orderInsertError: { code?: string; message?: string } | null = null;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const generatedOrderNumber = order.order_number?.trim() || await generateOrderNumber(supabase);

      const { data, error } = await supabase
        .from("orders")
        .insert({
          order_type: order.order_type,
          source_channel: order.source_channel,
          order_status: order.order_status,
          store_id: order.store_id,
          customer_name: order.customer_name,
          customer_phone: order.customer_phone,
          customer_email: order.customer_email,
          payment_method: paymentRow.payment_method,
          payment_status: "paid",
          paid_at: new Date().toISOString(),
          payment_reference: gatewayPaymentId,
          payment_gateway: gateway,
          notes: order.notes,
          subtotal_amount: order.subtotal_amount,
          discount_amount: order.discount_amount,
          tax_amount: order.tax_amount,
          tip_amount: order.tip_amount,
          total_amount: order.total_amount,
          customer_id: canonicalCustomerId,
          user_id: null,
          order_number: generatedOrderNumber,
        })
        .select("order_id, order_number, order_status")
        .single();

      if (!error && data?.order_id) {
        orderInsert = data as { order_id: string; order_number: string | null; order_status: string };
        orderInsertError = null;
        break;
      }

      orderInsertError = error ? { code: error.code, message: error.message } : { message: "Could not create orders row." };

      if (error?.code !== "23505") {
        break;
      }
    }

    if (!orderInsert?.order_id) {
      console.error("[customer-confirm-payment-and-create-order] order insert failed", orderInsertError);
      await supabase
        .from("customer_payments")
        .update({
          status: "orphaned",
          failure_message: "Payment captured but order creation failed.",
          gateway_payment_id: gatewayPaymentId,
          gateway_signature: gatewaySignature,
          updated_at: new Date().toISOString(),
        })
        .eq("payment_id", paymentId);

      return jsonResponse({ success: false, message: "Payment captured but order could not be created." }, 500);
    }

    const orderId = orderInsert.order_id;
    const insertedOrderItemIds: string[] = [];

    try {
      for (const item of items) {
        const { data: itemInsert, error: itemError } = await supabase
          .from("order_items")
          .insert({
            order_id: orderId,
            menu_item_id: item.menu_item_id,
            item_name: item.item_name,
            item_category: item.item_category,
            unit_price: item.unit_price,
            quantity: item.quantity,
            line_total: item.line_total,
          })
          .select("order_item_id")
          .single();

        if (itemError || !itemInsert?.order_item_id) {
          throw new Error(itemError?.message ?? "Could not create order_items row.");
        }

        const orderItemId = itemInsert.order_item_id as string;
        insertedOrderItemIds.push(orderItemId);

        const selections = item.selections ?? [];
        if (selections.length > 0) {
          const selectionRows = selections.map((selection) => ({
            order_item_id: orderItemId,
            option_item_id: selection.option_item_id,
            group_id_snapshot: selection.group_id_snapshot,
            group_name_snapshot: selection.group_name_snapshot,
            option_name: selection.option_name,
            price_modifier: selection.price_modifier,
          }));

          const { error: selectionError } = await supabase
            .from("order_item_selections")
            .insert(selectionRows);

          if (selectionError) {
            throw new Error(selectionError.message);
          }
        }
      }
    } catch (err) {
      console.error("[customer-confirm-payment-and-create-order] child insert failed, rolling back", err);

      if (insertedOrderItemIds.length > 0) {
        await supabase
          .from("order_item_selections")
          .delete()
          .in("order_item_id", insertedOrderItemIds);
      }

      await supabase
        .from("order_items")
        .delete()
        .eq("order_id", orderId);

      await supabase
        .from("orders")
        .delete()
        .eq("order_id", orderId);

      await supabase
        .from("customer_payments")
        .update({
          status: "orphaned",
          failure_message: "Payment captured but order item creation failed.",
          gateway_payment_id: gatewayPaymentId,
          gateway_signature: gatewaySignature,
          updated_at: new Date().toISOString(),
        })
        .eq("payment_id", paymentId);

      return jsonResponse({ success: false, message: "Payment captured but order could not be finalized." }, 500);
    }

    const paymentRecordedAt = new Date().toISOString();
    const { error: paymentInsertError } = await supabase
      .from("order_payments")
      .upsert({
        order_id: orderId,
        store_id: order.store_id,
        customer_id: canonicalCustomerId,
        recorded_by_internal_user_id: null,
        payment_method: paymentRow.payment_method,
        payment_source: "customer_checkout",
        provider_type: "gateway",
        status: "recorded",
        amount: order.total_amount,
        currency: paymentRow.currency ?? "INR",
        reference: gatewayPaymentId,
        provider_reference: gatewayOrderId,
        recorded_at: paymentRecordedAt,
        metadata: {
          customer_payment_id: paymentId,
          gateway,
        },
      }, {
        onConflict: "order_id",
      });

    if (paymentInsertError) {
      console.error("[customer-confirm-payment-and-create-order] order payment insert failed", paymentInsertError);

      await supabase
        .from("order_item_selections")
        .delete()
        .in("order_item_id", insertedOrderItemIds);

      await supabase
        .from("order_items")
        .delete()
        .eq("order_id", orderId);

      await supabase
        .from("orders")
        .delete()
        .eq("order_id", orderId);

      await supabase
        .from("customer_payments")
        .update({
          status: "orphaned",
          failure_message: "Payment captured but payment ledger write failed.",
          gateway_payment_id: gatewayPaymentId,
          gateway_signature: gatewaySignature,
          updated_at: paymentRecordedAt,
        })
        .eq("payment_id", paymentId);

      return jsonResponse({ success: false, message: "Payment captured but order payment record could not be finalized." }, 500);
    }

    const nowIso = paymentRecordedAt;
    await supabase
      .from("customer_payments")
      .update({
        status: "succeeded",
        order_id: orderId,
        gateway_order_id: gatewayOrderId,
        gateway_payment_id: gatewayPaymentId,
        gateway_signature: gatewaySignature,
        confirmed_at: nowIso,
        paid_at: nowIso,
        updated_at: nowIso,
        failure_message: null,
      })
      .eq("payment_id", paymentId);

    return jsonResponse({
      success: true,
      orderId: orderInsert.order_id,
      orderNumber: orderInsert.order_number,
      orderStatus: orderInsert.order_status,
    }, 200);
  } catch (err) {
    console.error("[customer-confirm-payment-and-create-order] unexpected error", err);
    return jsonResponse({ success: false, message: "Could not confirm payment and place order." }, 500);
  }
});
