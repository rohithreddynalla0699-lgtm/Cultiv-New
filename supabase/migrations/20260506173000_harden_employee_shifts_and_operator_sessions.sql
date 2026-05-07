update public.store_operator_sessions sos
set
  ended_at = coalesce(sos.ended_at, now()),
  ended_reason = coalesce(sos.ended_reason, 'clock_out'),
  updated_at = now()
from public.employee_shifts es
where sos.shift_id = es.shift_id
  and sos.ended_at is null
  and es.clock_out_at is not null;

with open_shifts as (
  select
    es.shift_id,
    es.employee_id,
    es.store_id,
    es.clock_in_at,
    first_value(es.clock_in_at) over (
      partition by es.employee_id, es.store_id
      order by es.clock_in_at desc, es.created_at desc, es.shift_id desc
    ) as latest_open_clock_in_at,
    row_number() over (
      partition by es.employee_id, es.store_id
      order by es.clock_in_at desc, es.created_at desc, es.shift_id desc
    ) as rn
  from public.employee_shifts es
  where es.clock_out_at is null
),
shifts_to_close as (
  select
    shift_id,
    greatest(clock_in_at, latest_open_clock_in_at) as close_at
  from open_shifts
  where rn > 1
)
update public.employee_shifts es
set
  clock_out_at = stc.close_at,
  total_hours = round(greatest(extract(epoch from (stc.close_at - es.clock_in_at)) / 3600.0, 0)::numeric, 2),
  updated_at = now()
from shifts_to_close stc
where es.shift_id = stc.shift_id;

update public.store_operator_sessions sos
set
  ended_at = coalesce(sos.ended_at, now()),
  ended_reason = coalesce(sos.ended_reason, 'clock_out'),
  updated_at = now()
from public.employee_shifts es
where sos.shift_id = es.shift_id
  and sos.ended_at is null
  and es.clock_out_at is not null;

update public.employees e
set
  shift_status = case
    when exists (
      select 1
      from public.employee_shifts es
      where es.employee_id = e.id
        and es.store_id = e.store_id
        and es.clock_out_at is null
    ) then 'on_shift'
    else 'off_shift'
  end,
  updated_at = now()
where e.is_deleted = false;

create unique index if not exists employee_shifts_one_active_shift_per_employee_store_idx
  on public.employee_shifts (employee_id, store_id)
  where clock_out_at is null;
