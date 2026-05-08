create or replace function public.set_store_operator_session_inactivity_expiry()
returns trigger
language plpgsql
as $$
declare
  base_activity_at timestamptz;
begin
  if new.started_at is null then
    new.started_at := now();
  end if;

  if new.last_activity_at is null then
    new.last_activity_at := new.started_at;
  end if;

  if new.ended_at is null then
    base_activity_at := greatest(new.started_at, new.last_activity_at);
    new.expires_at := base_activity_at + interval '30 minutes';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_store_operator_session_inactivity_expiry on public.store_operator_sessions;

create trigger trg_store_operator_session_inactivity_expiry
before insert or update on public.store_operator_sessions
for each row
execute function public.set_store_operator_session_inactivity_expiry();

update public.store_operator_sessions
set
  expires_at = greatest(started_at, last_activity_at) + interval '30 minutes',
  updated_at = now()
where ended_at is null
  and expires_at is distinct from (greatest(started_at, last_activity_at) + interval '30 minutes');
