create or replace function public.create_internal_pos_order_with_payment(
  p_store_id uuid,
  p_internal_user_id uuid,
  p_customer_id uuid default null,
  p_customer_name text default null,
  p_customer_phone text default null,
  p_customer_email text default null,
  p_payment_method text default null,
  p_payment_reference text default null,
  p_subtotal_amount numeric default 0,
  p_tax_amount numeric default 0,
  p_tip_amount numeric default 0,
  p_total_amount numeric default 0,
  p_items jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_store_exists boolean;
  v_customer_exists boolean;
  v_now timestamptz := now();
  v_order_id uuid;
  v_order_number text;
  v_payment_id uuid;
  v_item jsonb;
  v_selection jsonb;
  v_order_item_id uuid;
  v_item_id text;
  v_item_name text;
  v_item_category text;
  v_item_quantity integer;
  v_item_price numeric;
  v_item_line_total numeric;
  v_selection_section text;
  v_selection_choice text;
  v_sequence integer;
  v_attempt integer;
  v_subtotal numeric := round(coalesce(p_subtotal_amount, 0)::numeric, 2);
  v_tax numeric := round(coalesce(p_tax_amount, 0)::numeric, 2);
  v_tip numeric := round(coalesce(p_tip_amount, 0)::numeric, 2);
  v_total numeric := round(coalesce(p_total_amount, 0)::numeric, 2);
  v_computed_subtotal numeric := 0;
  v_payment_method text := lower(trim(coalesce(p_payment_method, '')));
begin
  if p_store_id is null then
    raise exception 'storeId is required.';
  end if;

  select exists(select 1 from public.stores where id = p_store_id)
    into v_store_exists;
  if not v_store_exists then
    raise exception 'Store was not found.';
  end if;

  if p_internal_user_id is null then
    raise exception 'internal user id is required.';
  end if;

  if p_customer_id is not null then
    select exists(select 1 from public.customers where id = p_customer_id and is_active = true)
      into v_customer_exists;
    if not v_customer_exists then
      raise exception 'Linked customer was not found or is inactive.';
    end if;
  end if;

  if not (v_payment_method = any (array['cash'::text, 'upi'::text, 'card'::text])) then
    raise exception 'paymentMethod must be cash, upi, or card.';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'POS order must include at least one item.';
  end if;

  if v_subtotal < 0 or v_tax < 0 or v_tip < 0 or v_total < 0 then
    raise exception 'POS totals must be non-negative numbers.';
  end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_item_name := nullif(trim(v_item->>'title'), '');
    v_item_category := nullif(trim(v_item->>'category'), '');
    v_item_quantity := coalesce((v_item->>'quantity')::integer, 0);
    v_item_price := round(coalesce((v_item->>'price')::numeric, -1), 2);

    if v_item_name is null or v_item_category is null or v_item_quantity <= 0 or v_item_price < 0 then
      raise exception 'Invalid POS item payload.';
    end if;

    v_computed_subtotal := v_computed_subtotal + round(v_item_price * v_item_quantity, 2);
  end loop;

  if abs(v_computed_subtotal - v_subtotal) > 0.01 then
    raise exception 'POS subtotal does not match item totals.';
  end if;

  if abs((v_subtotal + v_tax + v_tip) - v_total) > 0.01 then
    raise exception 'POS total does not match subtotal, tax, and tip.';
  end if;

  for v_attempt in 1..3 loop
    select count(*) + 1
      into v_sequence
    from public.orders
    where created_at >= date_trunc('day', v_now)
      and created_at < date_trunc('day', v_now) + interval '1 day';

    v_order_number := 'CULTIV'
      || to_char(v_now at time zone 'utc', 'YYMMDD')
      || lpad((v_sequence + v_attempt - 1)::text, 4, '0');

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
        user_id,
        order_number,
        created_at,
        updated_at
      ) values (
        'walk_in',
        'walk_in',
        'completed',
        p_store_id,
        coalesce(nullif(trim(p_customer_name), ''), 'Walk-in Guest'),
        nullif(trim(p_customer_phone), ''),
        nullif(trim(p_customer_email), ''),
        v_payment_method,
        'paid',
        v_now,
        nullif(trim(p_payment_reference), ''),
        null,
        null,
        v_subtotal,
        0,
        v_tax,
        v_tip,
        v_total,
        p_customer_id,
        null,
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

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_item_id := nullif(trim(v_item->>'itemId'), '');
    v_item_name := nullif(trim(v_item->>'title'), '');
    v_item_category := nullif(trim(v_item->>'category'), '');
    v_item_quantity := coalesce((v_item->>'quantity')::integer, 0);
    v_item_price := round(coalesce((v_item->>'price')::numeric, 0), 2);
    v_item_line_total := round(v_item_price * v_item_quantity, 2);

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
      v_item_id,
      v_item_name,
      v_item_category,
      v_item_price,
      v_item_quantity,
      v_item_line_total
    )
    returning order_item_id into v_order_item_id;

    if jsonb_typeof(v_item->'selections') = 'array' then
      for v_selection in select value from jsonb_array_elements(v_item->'selections')
      loop
        v_selection_section := nullif(trim(v_selection->>'section'), '');

        if v_selection_section is not null and jsonb_typeof(v_selection->'choices') = 'array' then
          for v_selection_choice in select jsonb_array_elements_text(v_selection->'choices')
          loop
            if nullif(trim(v_selection_choice), '') is not null then
              insert into public.order_item_selections (
                order_item_id,
                option_item_id,
                group_id_snapshot,
                group_name_snapshot,
                option_name,
                price_modifier
              ) values (
                v_order_item_id,
                null,
                lower(regexp_replace(v_selection_section, '[^a-zA-Z0-9]+', '-', 'g')),
                v_selection_section,
                trim(v_selection_choice),
                0
              );
            end if;
          end loop;
        end if;
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
    p_store_id,
    p_customer_id,
    p_internal_user_id,
    v_payment_method,
    'pos_manual',
    'manual',
    'recorded',
    v_total,
    'INR',
    nullif(trim(p_payment_reference), ''),
    null,
    jsonb_build_object('source', 'counter_billing', 'recorded_via', 'internal-create-pos-order'),
    v_now,
    v_now,
    v_now
  )
  returning payment_id into v_payment_id;

  return jsonb_build_object(
    'orderId', v_order_id,
    'orderNumber', v_order_number,
    'orderStatus', 'completed',
    'storeId', p_store_id,
    'customerId', p_customer_id,
    'customerName', coalesce(nullif(trim(p_customer_name), ''), 'Walk-in Guest'),
    'customerPhone', nullif(trim(p_customer_phone), ''),
    'customerEmail', nullif(trim(p_customer_email), ''),
    'paymentId', v_payment_id,
    'paymentStatus', 'recorded',
    'paymentMethod', v_payment_method,
    'paymentReference', nullif(trim(p_payment_reference), ''),
    'subtotal', v_subtotal,
    'taxAmount', v_tax,
    'tipAmount', v_tip,
    'total', v_total,
    'createdAt', v_now
  );
end;
$$;

revoke all on function public.create_internal_pos_order_with_payment(
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  numeric,
  numeric,
  numeric,
  numeric,
  jsonb
) from public, anon, authenticated;

grant execute on function public.create_internal_pos_order_with_payment(
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  numeric,
  numeric,
  numeric,
  numeric,
  jsonb
) to service_role;