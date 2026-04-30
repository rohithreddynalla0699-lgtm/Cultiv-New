create or replace function public.admin_adjust_customer_reward_points(
  p_customer_id uuid,
  p_points_delta integer,
  p_reason text,
  p_actor_internal_user_id uuid,
  p_actor_role_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer public.customers%rowtype;
  v_settings public.reward_program_settings%rowtype;
  v_now timestamptz := now();
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
  v_points_delta integer := coalesce(p_points_delta, 0);
  v_points_to_remove integer := 0;
  v_available_points integer := 0;
  v_adjustment_entry_id uuid;
  v_batch record;
begin
  if p_customer_id is null then
    raise exception 'customer_id is required.';
  end if;

  if v_points_delta = 0 then
    raise exception 'points_delta must not be zero.';
  end if;

  if v_reason is null then
    raise exception 'A reason is required for manual point adjustments.';
  end if;

  if nullif(trim(coalesce(p_actor_role_key, '')), '') is null
    or trim(p_actor_role_key) not in ('owner', 'admin') then
    raise exception 'actor_role_key must be owner or admin.';
  end if;

  select *
    into v_customer
  from public.customers
  where id = p_customer_id
  for update;

  if not found or v_customer.is_active = false then
    raise exception 'Customer account is unavailable.';
  end if;

  select *
    into v_settings
  from public.reward_program_settings
  order by created_at asc
  limit 1;

  if not found then
    raise exception 'Reward program settings are unavailable.';
  end if;

  if v_points_delta > 0 then
    insert into public.loyalty_points_ledger (
      user_id,
      order_id,
      entry_type,
      points,
      points_remaining,
      earned_at,
      expires_at,
      metadata,
      created_at,
      updated_at
    ) values (
      p_customer_id,
      null,
      'earn',
      v_points_delta,
      v_points_delta,
      v_now,
      v_now + make_interval(days => v_settings.points_expiry_days),
      jsonb_build_object(
        'source', 'admin_manual_adjustment',
        'adjustment_direction', 'add',
        'reason', v_reason,
        'actor_internal_user_id', p_actor_internal_user_id,
        'actor_role_key', trim(p_actor_role_key)
      ),
      v_now,
      v_now
    )
    returning loyalty_entry_id into v_adjustment_entry_id;
  else
    v_points_to_remove := abs(v_points_delta);

    select coalesce(sum(points_remaining), 0)::integer
      into v_available_points
    from public.loyalty_points_ledger
    where user_id = p_customer_id
      and entry_type = 'earn'
      and points_remaining > 0
      and (expires_at is null or expires_at > v_now);

    if v_available_points < v_points_to_remove then
      raise exception 'Cannot remove more points than the customer currently has available.';
    end if;

    for v_batch in
      select loyalty_entry_id, points_remaining
      from public.loyalty_points_ledger
      where user_id = p_customer_id
        and entry_type = 'earn'
        and points_remaining > 0
        and (expires_at is null or expires_at > v_now)
      order by expires_at asc nulls last, earned_at asc, created_at asc
      for update
    loop
      exit when v_points_to_remove <= 0;

      if v_batch.points_remaining <= v_points_to_remove then
        update public.loyalty_points_ledger
          set points_remaining = 0,
              updated_at = v_now
        where loyalty_entry_id = v_batch.loyalty_entry_id;
        v_points_to_remove := v_points_to_remove - v_batch.points_remaining;
      else
        update public.loyalty_points_ledger
          set points_remaining = points_remaining - v_points_to_remove,
              updated_at = v_now
        where loyalty_entry_id = v_batch.loyalty_entry_id;
        v_points_to_remove := 0;
      end if;
    end loop;

    if v_points_to_remove <> 0 then
      raise exception 'Unable to remove points right now. Please try again.';
    end if;

    insert into public.loyalty_points_ledger (
      user_id,
      order_id,
      entry_type,
      points,
      points_remaining,
      earned_at,
      expires_at,
      metadata,
      created_at,
      updated_at
    ) values (
      p_customer_id,
      null,
      'adjustment',
      abs(v_points_delta),
      0,
      v_now,
      null,
      jsonb_build_object(
        'source', 'admin_manual_adjustment',
        'adjustment_direction', 'remove',
        'reason', v_reason,
        'actor_internal_user_id', p_actor_internal_user_id,
        'actor_role_key', trim(p_actor_role_key)
      ),
      v_now,
      v_now
    )
    returning loyalty_entry_id into v_adjustment_entry_id;
  end if;

  v_available_points := public.sync_customer_reward_points(p_customer_id);

  return jsonb_build_object(
    'success', true,
    'adjustmentEntryId', v_adjustment_entry_id,
    'customerId', p_customer_id,
    'availablePoints', v_available_points
  );
end;
$$;

revoke all on function public.admin_adjust_customer_reward_points(uuid, integer, text, uuid, text) from public, anon, authenticated;
grant execute on function public.admin_adjust_customer_reward_points(uuid, integer, text, uuid, text) to service_role;
