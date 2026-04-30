insert into public.permissions (
  permission_key,
  permission_name,
  description
)
values (
  'can_manage_rewards',
  'Manage Rewards',
  'Allows owner/admin users to manage reward catalog and reward program settings.'
)
on conflict (permission_key) do update
set permission_name = excluded.permission_name,
    description = excluded.description;

insert into public.role_permissions (
  role_id,
  permission_id
)
select
  r.id,
  p.id
from public.roles r
cross join public.permissions p
where r.role_key in ('owner', 'admin')
  and p.permission_key = 'can_manage_rewards'
on conflict do nothing;

delete from public.role_permissions
using public.roles, public.permissions
where role_permissions.role_id = roles.id
  and role_permissions.permission_id = permissions.id
  and permissions.permission_key = 'can_manage_rewards'
  and roles.role_key = 'store';
