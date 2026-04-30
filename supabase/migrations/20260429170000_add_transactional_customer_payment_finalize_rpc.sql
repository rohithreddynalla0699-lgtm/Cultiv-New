create or replace function public.finalize_customer_payment_and_create_order(
  p_payment_id uuid,
  p_gateway_order_id text default null,
  p_gateway_payment_id text default null,
  p_gateway_signature text default null,
  p_paid_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.customer_payments%rowtype;
  v_now timestamptz := coalesce(p_paid_at, now());
  v_order_id uuid;
  v_order_number text;
  v_item jsonb;
  v_selection jsonb;
  v_order_item_id uuid;
  v_sequence integer;
  v_attempt integer;
  v_order jsonb;
  v_items jsonb;
  v_store_id uuid;
  v_source_channel text;
  v_item_menu_item_id text;
  v_item_name text;
  v_item_category text;
  v_item_quantity integer;
  v_item_unit_price numeric;
  v_item_line_total numeric;
  v_result jsonb;
begin
  if p_payment_id is null then
    raise exception 'paymentId is required.';
  end if;

  select *
    into v_payment
  from public.customer_payments
  where payment_id = p_payment_id
  for update;

  if not found then
    raise exception 'Payment attempt not found.';
  end if;

  if v_payment.status = 'succeeded' and v_payment.order_id is not null then
    select jsonb_build_object(
      'orderId', o.order_id,
      'orderNumber', o.order_number,
      'orderStatus', o.order_status
    )
      into v_result
    from public.orders o
    where o.order_id = v_payment.order_id;

    return coalesce(v_result, jsonb_build_object(
      'orderId', v_payment.order_id,
      'orderNumber', null,
      'orderStatus', 'placed'
    ));
  end if;

  if v_payment.status = 'failed' or v_payment.status = 'cancelled' then
    raise exception 'Payment is not in a capturable state.';
  end if;

  v_order := v_payment.order_payload;
  v_items := v_payment.items_payload;

  if v_order is null or jsonb_typeof(v_order) <> 'object' then
    update public.customer_payments
      set status = 'orphaned',
          failure_message = 'Stored order payload is invalid.',
          updated_at = now()
    where payment_id = p_payment_id;
    raise exception 'Stored order payload is invalid.';
  end if;

  if v_items is null or jsonb_typeof(v_items) <> 'array' or jsonb_array_length(v_items) = 0 then
    update public.customer_payments
      set status = 'orphaned',
          failure_message = 'Stored order items payload is invalid.',
          updated_at = now()
    where payment_id = p_payment_id;
    raise exception 'Stored order items payload is invalid.';
  end if;

  begin
    v_store_id := nullif(trim(v_order->>'store_id'), '')::uuid;
  exception
    when invalid_text_representation then
      update public.customer_payments
        set status = 'orphaned',
            failure_message = 'Stored order store_id is invalid.',
            updated_at = now()
      where payment_id = p_payment_id;
      raise exception 'Stored order store_id is invalid.';
  end;

  if v_store_id is null then
    update public.customer_payments
      set status = 'orphaned',
          failure_message = 'Stored order store_id is invalid.',
          updated_at = now()
    where payment_id = p_payment_id;
    raise exception 'Stored order store_id is invalid.';
  end if;

  v_source_channel := lower(trim(coalesce(v_order->>'source_channel', '')));
  v_source_channel := case
    when v_source_channel in ('app', 'online') then 'online'
    when v_source_channel in ('walk-in', 'walk_in', 'in-store', 'in_store', 'phone') then 'walk_in'
    else v_source_channel
  end;

  if not (v_source_channel = any (array['online'::text, 'walk_in'::text])) then
    update public.customer_payments
      set status = 'orphaned',
          failure_message = 'Stored order source_channel is invalid.',
          updated_at = now()
    where payment_id = p_payment_id;
    raise exception 'Stored order source_channel is invalid.';
  end if;

  for v_attempt in 1..3 loop
    select count(*) + 1
      into v_sequence
    from public.orders
    where created_at >= date_trunc('day', v_now)
      and created_at < date_trunc('day', v_now) + interval '1 day';

    v_order_number := coalesce(nullif(trim(v_order->>'order_number'), ''), 'CULTIV' || to_char(v_now at time zone 'utc', 'YYMMDD') || lpad((v_sequence + v_attempt - 1)::text, 4, '0'));

    begin
      insert into public.orders (
        order_type,
        source_channel,
        order_status,
        store_id,
        customer_name,
        customer_phone,
        customer_email,
        payment_method,
        payment_status,
        paid_at,
        payment_reference,
        payment_gateway,
        notes,
        subtotal_amount,
        discount_amount,
        tax_amount,
        tip_amount,
        total_amount,
        customer_id,
        order_number,
        created_at,
        updated_at
      ) values (
        v_order->>'order_type',
        v_source_channel,
        v_order->>'order_status',
        v_store_id,
        v_order->>'customer_name',
        v_order->>'customer_phone',
        nullif(v_order->>'customer_email', ''),
        v_payment.payment_method,
        'paid',
        v_now,
        coalesce(nullif(p_gateway_payment_id, ''), nullif(v_payment.gateway_payment_id, '')),
        v_payment.gateway,
        nullif(v_order->>'notes', ''),
        round(coalesce((v_order->>'subtotal_amount')::numeric, 0), 2),
        round(coalesce((v_order->>'discount_amount')::numeric, 0), 2),
        round(coalesce((v_order->>'tax_amount')::numeric, 0), 2),
        round(coalesce((v_order->>'tip_amount')::numeric, 0), 2),
        round(coalesce((v_order->>'total_amount')::numeric, 0), 2),
        coalesce(nullif(v_order->>'customer_id', ''), v_payment.customer_id::text)::uuid,
        v_order_number,
        v_now,
        v_now
      )
      returning order_id into v_order_id;

      exit;
    exception
      when unique_violation then
        if v_attempt = 3 then
          raise;
        end if;
    end;
  end loop;

  if v_order_id is null then
    update public.customer_payments
      set status = 'orphaned',
          failure_message = 'Payment captured but order creation failed.',
          gateway_order_id = coalesce(nullif(p_gateway_order_id, ''), gateway_order_id),
          gateway_payment_id = coalesce(nullif(p_gateway_payment_id, ''), gateway_payment_id),
          gateway_signature = coalesce(nullif(p_gateway_signature, ''), gateway_signature),
          updated_at = now()
    where payment_id = p_payment_id;
    raise exception 'Payment captured but order creation failed.';
  end if;

  for v_item in select value from jsonb_array_elements(v_items)
  loop
    v_item_menu_item_id := nullif(trim(coalesce(v_item->>'menu_item_id', '')), '');
    v_item_name := coalesce(nullif(trim(v_item->>'item_name'), ''), 'Item');
    v_item_category := coalesce(nullif(trim(v_item->>'item_category'), ''), 'Menu');
    v_item_quantity := coalesce((v_item->>'quantity')::integer, 0);
    v_item_unit_price := round(coalesce((v_item->>'unit_price')::numeric, 0), 2);
    v_item_line_total := round(coalesce((v_item->>'line_total')::numeric, 0), 2);

    if v_item_quantity <= 0 then
      raise exception 'Invalid order item quantity.';
    end if;

    insert into public.order_items (
      order_id,
      menu_item_id,
      item_name,
      item_category,
      unit_price,
      quantity,
      line_total
    ) values (
      v_order_id,
      v_item_menu_item_id,
      v_item_name,
      v_item_category,
      v_item_unit_price,
      v_item_quantity,
      v_item_line_total
    )
    returning order_item_id into v_order_item_id;

    if jsonb_typeof(v_item->'selections') = 'array' then
      for v_selection in select value from jsonb_array_elements(v_item->'selections')
      loop
        insert into public.order_item_selections (
          order_item_id,
          option_item_id,
          group_id_snapshot,
          group_name_snapshot,
          option_name,
          price_modifier
        ) values (
          v_order_item_id,
          nullif(trim(coalesce(v_selection->>'option_item_id', '')), ''),
          coalesce(nullif(trim(v_selection->>'group_id_snapshot'), ''), 'selection'),
          coalesce(nullif(trim(v_selection->>'group_name_snapshot'), ''), 'Selection'),
          coalesce(nullif(trim(v_selection->>'option_name'), ''), 'Choice'),
          round(coalesce((v_selection->>'price_modifier')::numeric, 0), 2)
        );
      end loop;
    end if;
  end loop;

  insert into public.order_payments (
    order_id,
    store_id,
    customer_id,
    recorded_by_internal_user_id,
    payment_method,
    payment_source,
    provider_type,
    status,
    amount,
    currency,
    reference,
    provider_reference,
    metadata,
    recorded_at,
    created_at,
    updated_at
  ) values (
    v_order_id,
    v_payment.store_id,
    v_payment.customer_id,
    null,
    v_payment.payment_method,
    'customer_checkout',
    'gateway',
    'recorded',
    v_payment.amount,
    coalesce(v_payment.currency, 'INR'),
    coalesce(nullif(p_gateway_payment_id, ''), nullif(v_payment.gateway_payment_id, '')),
    coalesce(nullif(p_gateway_order_id, ''), nullif(v_payment.gateway_order_id, '')),
    jsonb_build_object(
      'customer_payment_id', v_payment.payment_id,
      'gateway', v_payment.gateway
    ),
    v_now,
    v_now,
    v_now
  )
  on conflict (order_id) do update
    set reference = excluded.reference,
        provider_reference = excluded.provider_reference,
        metadata = excluded.metadata,
        recorded_at = excluded.recorded_at,
        updated_at = excluded.updated_at;

  update public.customer_payments
    set status = 'succeeded',
        order_id = v_order_id,
        gateway_order_id = coalesce(nullif(p_gateway_order_id, ''), gateway_order_id),
        gateway_payment_id = coalesce(nullif(p_gateway_payment_id, ''), gateway_payment_id),
        gateway_signature = coalesce(nullif(p_gateway_signature, ''), gateway_signature),
        confirmed_at = v_now,
        paid_at = v_now,
        updated_at = v_now,
        failure_message = null
  where payment_id = p_payment_id;

  return jsonb_build_object(
    'orderId', v_order_id,
    'orderNumber', v_order_number,
    'orderStatus', v_order->>'order_status'
  );

exception
  when others then
    update public.customer_payments
      set status = 'orphaned',
          failure_message = left(sqlerrm, 500),
          gateway_order_id = coalesce(nullif(p_gateway_order_id, ''), gateway_order_id),
          gateway_payment_id = coalesce(nullif(p_gateway_payment_id, ''), gateway_payment_id),
          gateway_signature = coalesce(nullif(p_gateway_signature, ''), gateway_signature),
          updated_at = now()
    where payment_id = p_payment_id
      and status <> 'succeeded';
    raise;
end;
$$;

revoke all on function public.finalize_customer_payment_and_create_order(
  uuid,
  text,
  text,
  text,
  timestamptz
) from public, anon, authenticated;

grant execute on function public.finalize_customer_payment_and_create_order(
  uuid,
  text,
  text,
  text,
  timestamptz
) to service_role;
