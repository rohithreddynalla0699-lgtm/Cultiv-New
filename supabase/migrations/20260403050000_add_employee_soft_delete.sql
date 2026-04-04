-- Add soft delete columns to employees table
alter table "public"."employees"
  add column if not exists "is_deleted" boolean not null default false;

alter table "public"."employees"
  add column if not exists "deleted_at" timestamp with time zone;

-- Create index for faster filtering
create index if not exists "employees_is_deleted_idx"
  on "public"."employees"("is_deleted");

create index if not exists "employees_deleted_at_idx"
  on "public"."employees"("deleted_at");