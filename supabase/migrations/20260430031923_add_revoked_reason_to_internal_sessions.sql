alter table public.internal_access_sessions
add column if not exists revoked_reason text;