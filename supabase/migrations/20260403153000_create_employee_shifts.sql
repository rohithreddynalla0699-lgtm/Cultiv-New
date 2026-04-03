create table if not exists public.employee_shifts (
  shift_id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  shift_date date not null,
  clock_in_at timestamp with time zone not null,
  clock_out_at timestamp with time zone,
  total_hours numeric(5,2) not null default 0,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint employee_shifts_total_hours_check check (total_hours >= 0)
);

create unique index if not exists employee_shifts_one_open_shift_per_day_idx
  on public.employee_shifts (employee_id, shift_date)
  where clock_out_at is null;

create index if not exists employee_shifts_store_shift_date_idx
  on public.employee_shifts (store_id, shift_date desc);

create index if not exists employee_shifts_employee_shift_date_idx
  on public.employee_shifts (employee_id, shift_date desc);

grant select, insert, update, delete on table public.employee_shifts to anon;
grant select, insert, update, delete on table public.employee_shifts to authenticated;
grant select, insert, update, delete on table public.employee_shifts to service_role;