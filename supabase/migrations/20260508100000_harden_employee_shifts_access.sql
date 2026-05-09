revoke all on table public.employee_shifts from anon;
revoke all on table public.employee_shifts from authenticated;
grant select, insert, update, delete on table public.employee_shifts to service_role;

alter table public.employee_shifts enable row level security;

drop policy if exists employee_shifts_service_role_all on public.employee_shifts;

create policy employee_shifts_service_role_all
on public.employee_shifts
for all
to service_role
using (true)
with check (true);
