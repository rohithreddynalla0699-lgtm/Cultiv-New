select r.role_key, p.permission_key
from role_permissions rp
join roles r on r.id = rp.role_id
join permissions p on p.id = rp.permission_id
where r.role_key = 'store'
  and p.permission_key = 'can_manage_rewards';

  Success. No rows returned