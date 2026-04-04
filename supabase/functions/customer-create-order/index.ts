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

interface OrderInsertPayload {
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

interface SelectionPayload {
  option_item_id: string | null;
  group_id_snapshot: string;
  group_name_snapshot: string;
  option_name: string;
  price_modifier: number;
}

interface ItemInsertPayload {
  menu_item_id: string | null;
  item_name: string;
  item_category: string;
  unit_price: number;
  quantity: number;
  line_total: number;
  selections?: SelectionPayload[];
}

interface CreateOrderRequest {
  order?: OrderInsertPayload;
  items?: ItemInsertPayload[];
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

serve(async (req: any) => {
  try {
    if (req.method === "OPTIONS") {
      return jsonResponse({ success: true }, 200);
    }

    if (req.method !== "POST") {
      return jsonResponse({ success: false, message: "Method not allowed" }, 405);
    }

    const body = (await req.json()) as CreateOrderRequest;
    const order = body.order;
    const items = body.items ?? [];

    if (!order) {
      return jsonResponse({ success: false, message: "Could not place your order right now. Please try again." }, 400);
    }

    if (!order.order_type || !order.source_channel || !order.order_status || !order.store_id) {
      return jsonResponse({ success: false, message: "Could not place your order right now. Please try again." }, 400);
    }

    if (!order.customer_name || !order.customer_phone) {
      return jsonResponse({ success: false, message: "Could not place your order right now. Please try again." }, 400);
    }

    if (!items.length) {
      return jsonResponse({ success: false, message: "Could not place your order right now. Please try again." }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
    );

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
          payment_method: order.payment_method,
          notes: order.notes,
          subtotal_amount: order.subtotal_amount,
          discount_amount: order.discount_amount,
          tax_amount: order.tax_amount,
          tip_amount: order.tip_amount,
          total_amount: order.total_amount,
          customer_id: order.customer_id,
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
      console.error("[customer-create-order] order insert failed", orderInsertError);
      return jsonResponse({
        success: false,
        message: "Could not place your order right now. Please try again.",
      }, 500);
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
      console.error("[customer-create-order] child insert failed, rolling back", err);

      if (insertedOrderItemIds.length > 0) {
        const { error: selectionDeleteError } = await supabase
          .from("order_item_selections")
          .delete()
          .in("order_item_id", insertedOrderItemIds);

        if (selectionDeleteError) {
          console.error("[customer-create-order] rollback selection delete failed", selectionDeleteError);
        }
      }

      const { error: orderItemsDeleteError } = await supabase
        .from("order_items")
        .delete()
        .eq("order_id", orderId);

      if (orderItemsDeleteError) {
        console.error("[customer-create-order] rollback order_items delete failed", orderItemsDeleteError);
      }

      const { error: orderDeleteError } = await supabase
        .from("orders")
        .delete()
        .eq("order_id", orderId);

      if (orderDeleteError) {
        console.error("[customer-create-order] rollback order delete failed", orderDeleteError);
      }

      return jsonResponse({
        success: false,
        message: "Could not place your order right now. Please try again.",
      }, 500);
    }

    return jsonResponse({
      success: true,
      orderId: orderInsert.order_id,
      orderNumber: orderInsert.order_number,
      orderStatus: orderInsert.order_status,
    }, 201);
  } catch (err) {
    console.error("[customer-create-order] unexpected error", err);
    return jsonResponse({
      success: false,
      message: "Could not place your order right now. Please try again.",
    }, 500);
  }
});
