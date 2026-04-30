do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'loyalty_points_ledger'
      and column_name = 'loyalty_entry_id'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'loyalty_points_ledger'
      and column_name = 'id'
  ) then
    alter table public.loyalty_points_ledger
      rename column loyalty_entry_id to id;
  end if;
end
$$;

create table if not exists public.reward_catalog (
  id uuid primary key default gen_random_uuid(),
  reward_code text not null unique,
  title text not null,
  description text not null default '',
  reward_type text not null check (reward_type = any (array['discount'::text, 'free_item'::text])),
  point_cost integer not null check (point_cost > 0),
  discount_amount numeric(10,2),
  free_item_title text,
  free_item_category text,
  free_item_food_value numeric(10,2),
  badge text,
  eligibility_rule text not null default 'Redeem with points anytime before expiry.',
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reward_catalog_discount_shape_check check (
    (reward_type = 'discount' and discount_amount is not null and discount_amount >= 0 and free_item_title is null and free_item_category is null and free_item_food_value is null)
    or (reward_type = 'free_item' and discount_amount is null and free_item_title is not null and free_item_category is not null and free_item_food_value is not null and free_item_food_value >= 0)
  )
);

create index if not exists idx_reward_catalog_active_sort
  on public.reward_catalog(is_active, sort_order, created_at);

create table if not exists public.reward_program_settings (
  id uuid primary key default gen_random_uuid(),
  earn_rate_rupees_per_point integer not null check (earn_rate_rupees_per_point > 0),
  points_expiry_days integer not null check (points_expiry_days > 0),
  min_order_subtotal numeric(10,2) not null check (min_order_subtotal >= 0),
  max_discount_ratio numeric(6,4) not null check (max_discount_ratio >= 0 and max_discount_ratio <= 1),
  allow_reward_redemption boolean not null default true,
  allow_checkout_reward_use boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.customer_reward_entitlements (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  reward_id uuid not null references public.reward_catalog(id) on delete cascade,
  source_loyalty_entry_id uuid references public.loyalty_points_ledger(id) on delete set null,
  status text not null check (status = any (array['available'::text, 'used'::text, 'expired'::text, 'revoked'::text])),
  redeemed_at timestamptz not null default now(),
  used_at timestamptz,
  expires_at timestamptz,
  order_id uuid references public.orders(order_id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_reward_entitlements_usage_check check (
    (status = 'used' and used_at is not null)
    or (status <> 'used')
  )
);

create index if not exists idx_customer_reward_entitlements_customer_status
  on public.customer_reward_entitlements(customer_id, status, redeemed_at desc);

create unique index if not exists uq_customer_reward_entitlements_available_reward
  on public.customer_reward_entitlements(customer_id, reward_id)
  where status = 'available';

revoke all on table public.reward_catalog from public;
revoke all on table public.reward_catalog from anon, authenticated;
grant select, insert, update, delete on table public.reward_catalog to service_role;

revoke all on table public.reward_program_settings from public;
revoke all on table public.reward_program_settings from anon, authenticated;
grant select, insert, update, delete on table public.reward_program_settings to service_role;

revoke all on table public.customer_reward_entitlements from public;
revoke all on table public.customer_reward_entitlements from anon, authenticated;
grant select, insert, update, delete on table public.customer_reward_entitlements to service_role;

alter table public.reward_catalog enable row level security;
alter table public.reward_program_settings enable row level security;
alter table public.customer_reward_entitlements enable row level security;

drop policy if exists reward_catalog_service_role_all on public.reward_catalog;
create policy reward_catalog_service_role_all
on public.reward_catalog
for all
to service_role
using (true)
with check (true);

drop policy if exists reward_program_settings_service_role_all on public.reward_program_settings;
create policy reward_program_settings_service_role_all
on public.reward_program_settings
for all
to service_role
using (true)
with check (true);

drop policy if exists customer_reward_entitlements_service_role_all on public.customer_reward_entitlements;
create policy customer_reward_entitlements_service_role_all
on public.customer_reward_entitlements
for all
to service_role
using (true)
with check (true);

insert into public.reward_catalog (
  reward_code,
  title,
  description,
  reward_type,
  point_cost,
  discount_amount,
  free_item_title,
  free_item_category,
  free_item_food_value,
  badge,
  sort_order
)
values
  ('water', 'Free Water Bottle', 'Redeem points for a complimentary water bottle.', 'free_item', 50, null, 'Complimentary Water Bottle', 'Rewards', 25, '50 pts', 10),
  ('drink', 'Free Drink', 'Redeem points for a complimentary drink.', 'free_item', 100, null, 'Complimentary Drink', 'Rewards', 79, '100 pts', 20),
  ('30off', '₹30 Off', 'Redeem points for ₹30 off your order.', 'discount', 150, 30, null, null, null, '150 pts', 30),
  ('50off', '₹50 Off', 'Redeem points for ₹50 off your order.', 'discount', 220, 50, null, null, null, '220 pts', 40),
  ('100off', '₹100 Off', 'Redeem points for ₹100 off your order.', 'discount', 320, 100, null, null, null, '320 pts', 50),
  ('kids', 'Free Kids Meal', 'Redeem points for a complimentary kids meal.', 'free_item', 450, null, 'Complimentary Kids Meal', 'Rewards', 129, '450 pts', 60),
  ('family200', '₹200 Off Family Order', 'Redeem points for ₹200 off your order.', 'discount', 650, 200, null, null, null, '650 pts', 70)
on conflict (reward_code) do update
set title = excluded.title,
    description = excluded.description,
    reward_type = excluded.reward_type,
    point_cost = excluded.point_cost,
    discount_amount = excluded.discount_amount,
    free_item_title = excluded.free_item_title,
    free_item_category = excluded.free_item_category,
    free_item_food_value = excluded.free_item_food_value,
    badge = excluded.badge,
    sort_order = excluded.sort_order,
    is_active = true,
    updated_at = now();

insert into public.reward_program_settings (
  earn_rate_rupees_per_point,
  points_expiry_days,
  min_order_subtotal,
  max_discount_ratio,
  allow_reward_redemption,
  allow_checkout_reward_use
)
select
  10,
  90,
  99,
  0.30,
  true,
  true
where not exists (
  select 1 from public.reward_program_settings
);

create or replace function public.sync_customer_reward_points(
  p_customer_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_available_points integer := 0;
begin
  if p_customer_id is null then
    raise exception 'customer_id is required.';
  end if;

  select coalesce(sum(points_remaining), 0)::integer
    into v_available_points
  from public.loyalty_points_ledger
  where user_id = p_customer_id
    and entry_type = 'earn'
    and points_remaining > 0
    and (expires_at is null or expires_at > now());

  update public.customers
    set reward_points = v_available_points,
        updated_at = now()
  where id = p_customer_id;

  return v_available_points;
end;
$$;

create or replace function public.redeem_customer_reward(
  p_customer_id uuid,
  p_reward_id uuid default null,
  p_reward_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer public.customers%rowtype;
  v_reward public.reward_catalog%rowtype;
  v_settings public.reward_program_settings%rowtype;
  v_available_points integer := 0;
  v_remaining_to_deduct integer := 0;
  v_batch record;
  v_redeem_entry_id uuid;
  v_entitlement_id uuid;
  v_now timestamptz := now();
begin
  if p_customer_id is null then
    raise exception 'customer_id is required.';
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

  if v_settings.allow_reward_redemption = false then
    raise exception 'Reward redemption is not available right now.';
  end if;

  if p_reward_id is not null then
    select *
      into v_reward
    from public.reward_catalog
    where id = p_reward_id
      and is_active = true;
  elsif nullif(trim(coalesce(p_reward_code, '')), '') is not null then
    select *
      into v_reward
    from public.reward_catalog
    where reward_code = trim(p_reward_code)
      and is_active = true;
  else
    raise exception 'A valid reward identifier is required.';
  end if;

  if not found then
    raise exception 'This reward is not available right now.';
  end if;

  if exists (
    select 1
    from public.customer_reward_entitlements
    where customer_id = p_customer_id
      and reward_id = v_reward.id
      and status = 'available'
  ) then
    raise exception '% is already in your account. Use it at checkout.', v_reward.title;
  end if;

  select coalesce(sum(points_remaining), 0)::integer
    into v_available_points
  from public.loyalty_points_ledger
  where user_id = p_customer_id
    and entry_type = 'earn'
    and points_remaining > 0
    and (expires_at is null or expires_at > v_now);

  if v_available_points < v_reward.point_cost then
    raise exception 'You need more non-expired points to redeem this reward.';
  end if;

  v_remaining_to_deduct := v_reward.point_cost;

  for v_batch in
    select id, points_remaining
    from public.loyalty_points_ledger
    where user_id = p_customer_id
      and entry_type = 'earn'
      and points_remaining > 0
      and (expires_at is null or expires_at > v_now)
    order by expires_at asc nulls last, earned_at asc, created_at asc
    for update
  loop
    exit when v_remaining_to_deduct <= 0;

    if v_batch.points_remaining <= v_remaining_to_deduct then
      update public.loyalty_points_ledger
        set points_remaining = 0,
            updated_at = v_now
      where id = v_batch.id;
      v_remaining_to_deduct := v_remaining_to_deduct - v_batch.points_remaining;
    else
      update public.loyalty_points_ledger
        set points_remaining = points_remaining - v_remaining_to_deduct,
            updated_at = v_now
      where id = v_batch.id;
      v_remaining_to_deduct := 0;
    end if;
  end loop;

  if v_remaining_to_deduct <> 0 then
    raise exception 'Unable to redeem right now. Please try again.';
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
    'redeem',
    v_reward.point_cost,
    0,
    v_now,
    null,
    jsonb_build_object(
      'reward_id', v_reward.id,
      'reward_code', v_reward.reward_code,
      'reward_title', v_reward.title
    ),
    v_now,
    v_now
  )
  returning id into v_redeem_entry_id;

  insert into public.customer_reward_entitlements (
    customer_id,
    reward_id,
    source_loyalty_entry_id,
    status,
    redeemed_at,
    used_at,
    expires_at,
    order_id,
    metadata,
    created_at,
    updated_at
  ) values (
    p_customer_id,
    v_reward.id,
    v_redeem_entry_id,
    'available',
    v_now,
    null,
    null,
    null,
    jsonb_build_object(
      'reward_code', v_reward.reward_code,
      'reward_title', v_reward.title
    ),
    v_now,
    v_now
  )
  returning id into v_entitlement_id;

  v_available_points := public.sync_customer_reward_points(p_customer_id);

  return jsonb_build_object(
    'success', true,
    'entitlementId', v_entitlement_id,
    'rewardId', v_reward.id,
    'rewardCode', v_reward.reward_code,
    'rewardTitle', v_reward.title,
    'availablePoints', v_available_points
  );
exception
  when unique_violation then
    raise exception '% is already in your account. Use it at checkout.', coalesce(v_reward.title, 'This reward');
end;
$$;

revoke all on function public.sync_customer_reward_points(uuid) from public, anon, authenticated;
grant execute on function public.sync_customer_reward_points(uuid) to service_role;

revoke all on function public.redeem_customer_reward(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.redeem_customer_reward(uuid, uuid, text) to service_role;

comment on table public.reward_catalog is
  'Backend-authoritative customer rewards catalog seeded from the app reward definitions.';

comment on table public.reward_program_settings is
  'Single-row rewards program settings used by the customer rewards summary and redemption flows.';

comment on table public.customer_reward_entitlements is
  'Customer-owned redeemed rewards that remain available until checkout usage or manual action.';
