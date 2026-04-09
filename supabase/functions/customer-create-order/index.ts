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
  customer_phone: string | null;
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

const normalizePhone = (value: string | null | undefined) =>
  String(value ?? "").replace(/\D/g, "").slice(-10);

const normalizeEmail = (value: string | null | undefined) =>
  String(value ?? "").trim().toLowerCase();

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

const resolveCanonicalCustomerId = async (
  supabase: any,
  order: OrderInsertPayload,
  isWalkInOrder: boolean,
): Promise<string | null> => {
  const providedCustomerId = typeof order.customer_id === "string" && order.customer_id.trim()
    ? order.customer_id.trim()
    : null;

  if (providedCustomerId) {
    return providedCustomerId;
  }

  const hasExplicitLinkedCustomerSignal = isWalkInOrder
    && typeof order.user_id === "string"
    && order.user_id.trim().length > 0;

  if (!hasExplicitLinkedCustomerSignal) {
    return null;
  }

  const normalizedPhone = normalizePhone(order.customer_phone);
  if (normalizedPhone) {
    const { data, error } = await supabase
      .from("customers")
      .select("id")
      .eq("phone", normalizedPhone)
      .maybeSingle();

    if (error) {
      throw new Error(`Could not verify linked customer by phone: ${error.message}`);
    }

    if (data?.id) {
      return data.id as string;
    }
  }

  const normalizedEmail = normalizeEmail(order.customer_email);
  if (normalizedEmail) {
    const { data, error } = await supabase
      .from("customers")
      .select("id")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (error) {
      throw new Error(`Could not verify linked customer by email: ${error.message}`);
    }

    if (data?.id) {
      return data.id as string;
    }
  }

  return null;
};

const awardCompletedOrderLoyalty = async (
  supabase: any,
  input: {
    customerId: string | null;
    orderId: string;
    orderStatus: string;
    totalAmount: number;
  },
) => {
  const pointsToAward = Math.floor(Number(input.totalAmount) / 10);

  console.info("[customer-create-order] loyalty award evaluation", {
    orderId: input.orderId,
    customerId: input.customerId,
    orderStatus: input.orderStatus,
    pointsToAward,
  });

  if (input.orderStatus !== "completed" || !input.customerId) {
    console.info("[customer-create-order] loyalty award skipped", {
      orderId: input.orderId,
      customerId: input.customerId,
      orderStatus: input.orderStatus,
      reason: input.orderStatus !== "completed" ? "not_completed" : "missing_customer_id",
    });
    return;
  }

  if (pointsToAward <= 0) {
    console.info("[customer-create-order] loyalty award skipped", {
      orderId: input.orderId,
      customerId: input.customerId,
      orderStatus: input.orderStatus,
      reason: "non_positive_points",
      pointsToAward,
    });
    return;
  }

  const { data: existingAwards, error: existingAwardsError } = await supabase
    .from("loyalty_points_ledger")
    .select("order_id")
    .eq("order_id", input.orderId)
    .eq("entry_type", "earn")
    .limit(1);

  if (existingAwardsError) {
    console.error("[customer-create-order] failed to verify existing loyalty award", {
      orderId: input.orderId,
      customerId: input.customerId,
      orderStatus: input.orderStatus,
      pointsToAward,
      error: existingAwardsError,
    });
    return;
  }

  if (Array.isArray(existingAwards) && existingAwards.length > 0) {
    console.info("[customer-create-order] loyalty award skipped", {
      orderId: input.orderId,
      customerId: input.customerId,
      orderStatus: input.orderStatus,
      reason: "already_awarded",
      pointsToAward,
    });
    return;
  }

  const earnedAt = new Date();
  const expiresAt = new Date(earnedAt.getTime() + 90 * 24 * 60 * 60 * 1000);

  const { error } = await supabase
    .from("loyalty_points_ledger")
    .insert({
      user_id: input.customerId,
      order_id: input.orderId,
      entry_type: "earn",
      points: pointsToAward,
      points_remaining: pointsToAward,
      earned_at: earnedAt.toISOString(),
      expires_at: expiresAt.toISOString(),
      metadata: {
        source: "order_completion",
        total_amount: input.totalAmount,
      },
    });

  if (!error) {
    console.info("[customer-create-order] loyalty award inserted", {
      orderId: input.orderId,
      customerId: input.customerId,
      orderStatus: input.orderStatus,
      pointsToAward,
    });
    return;
  }

  if (error.code === "23505") {
    console.info("[customer-create-order] loyalty award skipped", {
      orderId: input.orderId,
      customerId: input.customerId,
      orderStatus: input.orderStatus,
      reason: "duplicate_key",
      pointsToAward,
      error,
    });
    return;
  }

  console.error("[customer-create-order] failed to insert loyalty ledger row", {
    orderId: input.orderId,
    customerId: input.customerId,
    orderStatus: input.orderStatus,
    pointsToAward,
    error,
  });
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

    // Log incoming payload shape (no secrets)
    console.error('[customer-create-order] incoming payload', {
      hasOrder: !!order,
      hasItems: Array.isArray(items),
      itemsCount: items.length,
      orderKeys: order ? Object.keys(order) : null,
    });

    if (!order) {
      console.error('[customer-create-order] validation', {
        branch: 'missing_order',
        order_type: undefined,
        source_channel: undefined,
        order_status: undefined,
        store_id: undefined,
        customer_name: undefined,
        customer_phone: undefined,
        items_count: items.length,
        order_payload: null,
      });
      return jsonResponse({ success: false, message: "Could not place your order right now. Please try again." }, 400);
    }

    if (!order.order_type || !order.source_channel || !order.order_status || !order.store_id) {
      console.error('[customer-create-order] validation', {
        branch: 'missing_required_order_fields',
        order_type: order.order_type,
        source_channel: order.source_channel,
        order_status: order.order_status,
        store_id: order.store_id,
        customer_name: order.customer_name,
        customer_phone: order.customer_phone,
        items_count: items.length,
        order_payload: {
          order_type: order.order_type,
          source_channel: order.source_channel,
          order_status: order.order_status,
          store_id: order.store_id,
          customer_name: order.customer_name,
          customer_phone: order.customer_phone,
        },
      });
      return jsonResponse({ success: false, message: "Could not place your order right now. Please try again." }, 400);
    }

    const isWalkInOrder =
      order.order_type === "walk_in"
      || order.source_channel === "walk_in"
      || order.source_channel === "walk-in";

    if (!order.customer_name) {
      console.error('[customer-create-order] validation', {
        branch: 'missing_customer_name',
        order_type: order.order_type,
        source_channel: order.source_channel,
        order_status: order.order_status,
        store_id: order.store_id,
        customer_name: order.customer_name,
        customer_phone: order.customer_phone,
        items_count: items.length,
        order_payload: {
          order_type: order.order_type,
          source_channel: order.source_channel,
          order_status: order.order_status,
          store_id: order.store_id,
          customer_name: order.customer_name,
          customer_phone: order.customer_phone,
        },
      });
      return jsonResponse({ success: false, message: "Could not place your order right now. Please try again." }, 400);
    }

    if (!isWalkInOrder && !order.customer_phone) {
      console.error('[customer-create-order] validation', {
        branch: 'missing_customer_phone_non_walkin',
        order_type: order.order_type,
        source_channel: order.source_channel,
        order_status: order.order_status,
        store_id: order.store_id,
        customer_name: order.customer_name,
        customer_phone: order.customer_phone,
        items_count: items.length,
        order_payload: {
          order_type: order.order_type,
          source_channel: order.source_channel,
          order_status: order.order_status,
          store_id: order.store_id,
          customer_name: order.customer_name,
          customer_phone: order.customer_phone,
        },
      });
      return jsonResponse({ success: false, message: "Could not place your order right now. Please try again." }, 400);
    }

    if (!items.length) {
      console.error('[customer-create-order] validation', {
        branch: 'missing_items',
        order_type: order.order_type,
        source_channel: order.source_channel,
        order_status: order.order_status,
        store_id: order.store_id,
        customer_name: order.customer_name,
        customer_phone: order.customer_phone,
        items_count: items.length,
        order_payload: {
          order_type: order.order_type,
          source_channel: order.source_channel,
          order_status: order.order_status,
          store_id: order.store_id,
          customer_name: order.customer_name,
          customer_phone: order.customer_phone,
        },
      });
      return jsonResponse({ success: false, message: "Could not place your order right now. Please try again." }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
    );

    const resolvedCustomerId = await resolveCanonicalCustomerId(supabase, order, isWalkInOrder);
    console.info("[customer-create-order] resolved customer context", {
      orderType: order.order_type,
      sourceChannel: order.source_channel,
      inputCustomerId: order.customer_id,
      inputUserId: order.user_id ?? null,
      resolvedCustomerId,
      customerPhone: order.customer_phone,
      customerEmail: order.customer_email,
    });

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
          customer_id: resolvedCustomerId,
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
        message: orderInsertError?.message || "Could not place your order right now. Please try again.",
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
        message: err instanceof Error ? err.message : "Could not place your order right now. Please try again.",
      }, 500);
    }

    await awardCompletedOrderLoyalty(supabase, {
      customerId: resolvedCustomerId,
      orderId: orderInsert.order_id,
      orderStatus: orderInsert.order_status,
      totalAmount: order.total_amount,
    });

    return jsonResponse({
      success: true,
      orderId: orderInsert.order_id,
      orderNumber: orderInsert.order_number,
      orderStatus: orderInsert.order_status,
      customerId: resolvedCustomerId,
    }, 201);
  } catch (err) {
    console.error("[customer-create-order] unexpected error", err);
    return jsonResponse({
      success: false,
      message: err instanceof Error ? err.message : "Could not place your order right now. Please try again.",
    }, 500);
  }
});
