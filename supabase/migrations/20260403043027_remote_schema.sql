drop extension if exists "pg_net";


  create table "public"."customers" (
    "id" uuid not null default gen_random_uuid(),
    "full_name" text not null,
    "email" text,
    "phone" text,
    "password_hash" text not null,
    "is_active" boolean not null default true,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );



  create table "public"."employees" (
    "id" uuid not null default gen_random_uuid(),
    "employee_code" text not null,
    "full_name" text not null,
    "employee_role" text not null,
    "store_id" uuid not null,
    "pin_hash" text not null,
    "phone" text,
    "shift_status" text not null default 'off_shift'::text,
    "is_active" boolean not null default true,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );



  create table "public"."internal_users" (
    "id" uuid not null default gen_random_uuid(),
    "role_id" uuid not null,
    "full_name" text not null,
    "pin_hash" text not null,
    "store_id" uuid,
    "is_active" boolean not null default true,
    "last_login_at" timestamp with time zone,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );



  create table "public"."item_option_group_map" (
    "menu_item_id" text not null,
    "group_id" text not null,
    "sort_order" integer not null default 0
      );



  create table "public"."menu_items" (
    "menu_item_id" text not null,
    "category_slug" text not null,
    "subcategory_slug" text,
    "name" text not null,
    "base_price" integer not null,
    "is_available" boolean not null default true,
    "sort_order" integer not null default 0,
    "created_at" timestamp with time zone not null default now()
      );



  create table "public"."option_groups" (
    "group_id" text not null,
    "name" text not null,
    "selection_type" text not null,
    "is_required" boolean not null default false,
    "min_select" integer not null default 0,
    "max_select" integer,
    "sort_order" integer not null default 0
      );



  create table "public"."option_items" (
    "option_item_id" text not null,
    "group_id" text not null,
    "name" text not null,
    "price_modifier" integer not null default 0,
    "is_available" boolean not null default true,
    "sort_order" integer not null default 0
      );



  create table "public"."order_item_selections" (
    "order_item_selection_id" uuid not null default gen_random_uuid(),
    "order_item_id" uuid not null,
    "option_item_id" text,
    "group_id_snapshot" text not null,
    "group_name_snapshot" text not null,
    "option_name" text not null,
    "price_modifier" integer not null default 0
      );



  create table "public"."order_items" (
    "order_item_id" uuid not null default gen_random_uuid(),
    "order_id" uuid not null,
    "menu_item_id" text,
    "item_name" text not null,
    "item_category" text not null,
    "unit_price" integer not null,
    "quantity" integer not null,
    "line_total" integer not null
      );



  create table "public"."orders" (
    "order_id" uuid not null default gen_random_uuid(),
    "order_type" text not null,
    "source_channel" text not null,
    "order_status" text not null,
    "store_id" text not null,
    "customer_name" text not null,
    "customer_phone" text not null,
    "customer_email" text,
    "payment_method" text,
    "notes" text,
    "subtotal_amount" integer not null,
    "discount_amount" integer not null default 0,
    "total_amount" integer not null,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "order_number" text
      );



  create table "public"."permissions" (
    "id" uuid not null default gen_random_uuid(),
    "permission_key" text not null,
    "permission_name" text not null,
    "description" text,
    "created_at" timestamp with time zone not null default now()
      );



  create table "public"."role_permissions" (
    "role_id" uuid not null,
    "permission_id" uuid not null,
    "is_allowed" boolean not null default true,
    "granted_at" timestamp with time zone not null default now()
      );



  create table "public"."roles" (
    "id" uuid not null default gen_random_uuid(),
    "role_key" text not null,
    "role_name" text not null,
    "scope_type" text not null,
    "is_active" boolean not null default true,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );



  create table "public"."stores" (
    "id" uuid not null default gen_random_uuid(),
    "code" text not null,
    "name" text not null,
    "phone" text,
    "email" text,
    "address_line_1" text,
    "address_line_2" text,
    "city" text,
    "state" text,
    "postal_code" text,
    "country" text default 'India'::text,
    "is_active" boolean not null default true,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


CREATE UNIQUE INDEX customers_email_key ON public.customers USING btree (email);

CREATE UNIQUE INDEX customers_phone_key ON public.customers USING btree (phone);

CREATE UNIQUE INDEX customers_pkey ON public.customers USING btree (id);

CREATE UNIQUE INDEX employees_employee_code_key ON public.employees USING btree (employee_code);

CREATE UNIQUE INDEX employees_pkey ON public.employees USING btree (id);

CREATE UNIQUE INDEX internal_users_pkey ON public.internal_users USING btree (id);

CREATE UNIQUE INDEX item_option_group_map_pkey ON public.item_option_group_map USING btree (menu_item_id, group_id);

CREATE UNIQUE INDEX menu_items_pkey ON public.menu_items USING btree (menu_item_id);

CREATE UNIQUE INDEX option_groups_pkey ON public.option_groups USING btree (group_id);

CREATE UNIQUE INDEX option_items_pkey ON public.option_items USING btree (option_item_id);

CREATE UNIQUE INDEX order_item_selections_pkey ON public.order_item_selections USING btree (order_item_selection_id);

CREATE UNIQUE INDEX order_items_pkey ON public.order_items USING btree (order_item_id);

CREATE UNIQUE INDEX orders_pkey ON public.orders USING btree (order_id);

CREATE UNIQUE INDEX permissions_permission_key_key ON public.permissions USING btree (permission_key);

CREATE UNIQUE INDEX permissions_pkey ON public.permissions USING btree (id);

CREATE UNIQUE INDEX role_permissions_pkey ON public.role_permissions USING btree (role_id, permission_id);

CREATE UNIQUE INDEX roles_pkey ON public.roles USING btree (id);

CREATE UNIQUE INDEX roles_role_key_key ON public.roles USING btree (role_key);

CREATE UNIQUE INDEX stores_code_key ON public.stores USING btree (code);

CREATE UNIQUE INDEX stores_pkey ON public.stores USING btree (id);

CREATE UNIQUE INDEX uq_orders_order_number ON public.orders USING btree (order_number);

alter table "public"."customers" add constraint "customers_pkey" PRIMARY KEY using index "customers_pkey";

alter table "public"."employees" add constraint "employees_pkey" PRIMARY KEY using index "employees_pkey";

alter table "public"."internal_users" add constraint "internal_users_pkey" PRIMARY KEY using index "internal_users_pkey";

alter table "public"."item_option_group_map" add constraint "item_option_group_map_pkey" PRIMARY KEY using index "item_option_group_map_pkey";

alter table "public"."menu_items" add constraint "menu_items_pkey" PRIMARY KEY using index "menu_items_pkey";

alter table "public"."option_groups" add constraint "option_groups_pkey" PRIMARY KEY using index "option_groups_pkey";

alter table "public"."option_items" add constraint "option_items_pkey" PRIMARY KEY using index "option_items_pkey";

alter table "public"."order_item_selections" add constraint "order_item_selections_pkey" PRIMARY KEY using index "order_item_selections_pkey";

alter table "public"."order_items" add constraint "order_items_pkey" PRIMARY KEY using index "order_items_pkey";

alter table "public"."orders" add constraint "orders_pkey" PRIMARY KEY using index "orders_pkey";

alter table "public"."permissions" add constraint "permissions_pkey" PRIMARY KEY using index "permissions_pkey";

alter table "public"."role_permissions" add constraint "role_permissions_pkey" PRIMARY KEY using index "role_permissions_pkey";

alter table "public"."roles" add constraint "roles_pkey" PRIMARY KEY using index "roles_pkey";

alter table "public"."stores" add constraint "stores_pkey" PRIMARY KEY using index "stores_pkey";

alter table "public"."customers" add constraint "customers_email_key" UNIQUE using index "customers_email_key";

alter table "public"."customers" add constraint "customers_phone_key" UNIQUE using index "customers_phone_key";

alter table "public"."employees" add constraint "employees_employee_code_key" UNIQUE using index "employees_employee_code_key";

alter table "public"."employees" add constraint "employees_employee_role_check" CHECK ((employee_role = ANY (ARRAY['manager'::text, 'kitchen'::text, 'counter'::text]))) not valid;

alter table "public"."employees" validate constraint "employees_employee_role_check";

alter table "public"."employees" add constraint "employees_shift_status_check" CHECK ((shift_status = ANY (ARRAY['on_shift'::text, 'off_shift'::text]))) not valid;

alter table "public"."employees" validate constraint "employees_shift_status_check";

alter table "public"."employees" add constraint "employees_store_id_fkey" FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE not valid;

alter table "public"."employees" validate constraint "employees_store_id_fkey";

alter table "public"."internal_users" add constraint "internal_users_role_id_fkey" FOREIGN KEY (role_id) REFERENCES public.roles(id) not valid;

alter table "public"."internal_users" validate constraint "internal_users_role_id_fkey";

alter table "public"."internal_users" add constraint "internal_users_store_id_fkey" FOREIGN KEY (store_id) REFERENCES public.stores(id) not valid;

alter table "public"."internal_users" validate constraint "internal_users_store_id_fkey";

alter table "public"."item_option_group_map" add constraint "item_option_group_map_group_id_fkey" FOREIGN KEY (group_id) REFERENCES public.option_groups(group_id) ON DELETE CASCADE not valid;

alter table "public"."item_option_group_map" validate constraint "item_option_group_map_group_id_fkey";

alter table "public"."item_option_group_map" add constraint "item_option_group_map_item_id_fkey" FOREIGN KEY (menu_item_id) REFERENCES public.menu_items(menu_item_id) ON DELETE CASCADE not valid;

alter table "public"."item_option_group_map" validate constraint "item_option_group_map_item_id_fkey";

alter table "public"."menu_items" add constraint "menu_items_base_price_check" CHECK ((base_price >= 0)) not valid;

alter table "public"."menu_items" validate constraint "menu_items_base_price_check";

alter table "public"."option_groups" add constraint "option_groups_max_select_check" CHECK (((max_select IS NULL) OR (max_select >= 0))) not valid;

alter table "public"."option_groups" validate constraint "option_groups_max_select_check";

alter table "public"."option_groups" add constraint "option_groups_min_select_check" CHECK ((min_select >= 0)) not valid;

alter table "public"."option_groups" validate constraint "option_groups_min_select_check";

alter table "public"."option_groups" add constraint "option_groups_selection_type_check" CHECK ((selection_type = ANY (ARRAY['single'::text, 'multiple'::text]))) not valid;

alter table "public"."option_groups" validate constraint "option_groups_selection_type_check";

alter table "public"."option_items" add constraint "option_items_group_id_fkey" FOREIGN KEY (group_id) REFERENCES public.option_groups(group_id) ON DELETE CASCADE not valid;

alter table "public"."option_items" validate constraint "option_items_group_id_fkey";

alter table "public"."order_item_selections" add constraint "order_item_selections_option_item_id_fkey" FOREIGN KEY (option_item_id) REFERENCES public.option_items(option_item_id) ON DELETE SET NULL not valid;

alter table "public"."order_item_selections" validate constraint "order_item_selections_option_item_id_fkey";

alter table "public"."order_item_selections" add constraint "order_item_selections_order_item_id_fkey" FOREIGN KEY (order_item_id) REFERENCES public.order_items(order_item_id) ON DELETE CASCADE not valid;

alter table "public"."order_item_selections" validate constraint "order_item_selections_order_item_id_fkey";

alter table "public"."order_items" add constraint "order_items_line_total_check" CHECK ((line_total >= 0)) not valid;

alter table "public"."order_items" validate constraint "order_items_line_total_check";

alter table "public"."order_items" add constraint "order_items_menu_item_id_fkey" FOREIGN KEY (menu_item_id) REFERENCES public.menu_items(menu_item_id) ON DELETE SET NULL not valid;

alter table "public"."order_items" validate constraint "order_items_menu_item_id_fkey";

alter table "public"."order_items" add constraint "order_items_order_id_fkey" FOREIGN KEY (order_id) REFERENCES public.orders(order_id) ON DELETE CASCADE not valid;

alter table "public"."order_items" validate constraint "order_items_order_id_fkey";

alter table "public"."order_items" add constraint "order_items_quantity_check" CHECK ((quantity > 0)) not valid;

alter table "public"."order_items" validate constraint "order_items_quantity_check";

alter table "public"."order_items" add constraint "order_items_unit_price_snapshot_check" CHECK ((unit_price >= 0)) not valid;

alter table "public"."order_items" validate constraint "order_items_unit_price_snapshot_check";

alter table "public"."orders" add constraint "orders_discount_amount_check" CHECK ((discount_amount >= 0)) not valid;

alter table "public"."orders" validate constraint "orders_discount_amount_check";

alter table "public"."orders" add constraint "orders_order_type_check" CHECK ((order_type = ANY (ARRAY['online'::text, 'walk_in'::text, 'phone'::text]))) not valid;

alter table "public"."orders" validate constraint "orders_order_type_check";

alter table "public"."orders" add constraint "orders_payment_method_check" CHECK ((payment_method = ANY (ARRAY['cash'::text, 'upi'::text, 'card'::text]))) not valid;

alter table "public"."orders" validate constraint "orders_payment_method_check";

alter table "public"."orders" add constraint "orders_source_channel_check" CHECK ((source_channel = ANY (ARRAY['app'::text, 'walk-in'::text, 'phone'::text]))) not valid;

alter table "public"."orders" validate constraint "orders_source_channel_check";

alter table "public"."orders" add constraint "orders_status_check" CHECK ((order_status = ANY (ARRAY['placed'::text, 'preparing'::text, 'ready_for_pickup'::text, 'completed'::text]))) not valid;

alter table "public"."orders" validate constraint "orders_status_check";

alter table "public"."orders" add constraint "orders_subtotal_check" CHECK ((subtotal_amount >= 0)) not valid;

alter table "public"."orders" validate constraint "orders_subtotal_check";

alter table "public"."orders" add constraint "orders_total_check" CHECK ((total_amount >= 0)) not valid;

alter table "public"."orders" validate constraint "orders_total_check";

alter table "public"."permissions" add constraint "permissions_permission_key_key" UNIQUE using index "permissions_permission_key_key";

alter table "public"."role_permissions" add constraint "role_permissions_permission_id_fkey" FOREIGN KEY (permission_id) REFERENCES public.permissions(id) ON DELETE CASCADE not valid;

alter table "public"."role_permissions" validate constraint "role_permissions_permission_id_fkey";

alter table "public"."role_permissions" add constraint "role_permissions_role_id_fkey" FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE not valid;

alter table "public"."role_permissions" validate constraint "role_permissions_role_id_fkey";

alter table "public"."roles" add constraint "roles_role_key_check" CHECK ((role_key = ANY (ARRAY['owner'::text, 'admin'::text, 'store'::text]))) not valid;

alter table "public"."roles" validate constraint "roles_role_key_check";

alter table "public"."roles" add constraint "roles_role_key_key" UNIQUE using index "roles_role_key_key";

alter table "public"."roles" add constraint "roles_scope_type_check" CHECK ((scope_type = ANY (ARRAY['global'::text, 'store'::text]))) not valid;

alter table "public"."roles" validate constraint "roles_scope_type_check";

alter table "public"."stores" add constraint "stores_code_key" UNIQUE using index "stores_code_key";

grant delete on table "public"."customers" to "anon";

grant insert on table "public"."customers" to "anon";

grant references on table "public"."customers" to "anon";

grant select on table "public"."customers" to "anon";

grant trigger on table "public"."customers" to "anon";

grant truncate on table "public"."customers" to "anon";

grant update on table "public"."customers" to "anon";

grant delete on table "public"."customers" to "authenticated";

grant insert on table "public"."customers" to "authenticated";

grant references on table "public"."customers" to "authenticated";

grant select on table "public"."customers" to "authenticated";

grant trigger on table "public"."customers" to "authenticated";

grant truncate on table "public"."customers" to "authenticated";

grant update on table "public"."customers" to "authenticated";

grant delete on table "public"."customers" to "service_role";

grant insert on table "public"."customers" to "service_role";

grant references on table "public"."customers" to "service_role";

grant select on table "public"."customers" to "service_role";

grant trigger on table "public"."customers" to "service_role";

grant truncate on table "public"."customers" to "service_role";

grant update on table "public"."customers" to "service_role";

grant delete on table "public"."employees" to "anon";

grant insert on table "public"."employees" to "anon";

grant references on table "public"."employees" to "anon";

grant select on table "public"."employees" to "anon";

grant trigger on table "public"."employees" to "anon";

grant truncate on table "public"."employees" to "anon";

grant update on table "public"."employees" to "anon";

grant delete on table "public"."employees" to "authenticated";

grant insert on table "public"."employees" to "authenticated";

grant references on table "public"."employees" to "authenticated";

grant select on table "public"."employees" to "authenticated";

grant trigger on table "public"."employees" to "authenticated";

grant truncate on table "public"."employees" to "authenticated";

grant update on table "public"."employees" to "authenticated";

grant delete on table "public"."employees" to "service_role";

grant insert on table "public"."employees" to "service_role";

grant references on table "public"."employees" to "service_role";

grant select on table "public"."employees" to "service_role";

grant trigger on table "public"."employees" to "service_role";

grant truncate on table "public"."employees" to "service_role";

grant update on table "public"."employees" to "service_role";

grant delete on table "public"."internal_users" to "anon";

grant insert on table "public"."internal_users" to "anon";

grant references on table "public"."internal_users" to "anon";

grant select on table "public"."internal_users" to "anon";

grant trigger on table "public"."internal_users" to "anon";

grant truncate on table "public"."internal_users" to "anon";

grant update on table "public"."internal_users" to "anon";

grant delete on table "public"."internal_users" to "authenticated";

grant insert on table "public"."internal_users" to "authenticated";

grant references on table "public"."internal_users" to "authenticated";

grant select on table "public"."internal_users" to "authenticated";

grant trigger on table "public"."internal_users" to "authenticated";

grant truncate on table "public"."internal_users" to "authenticated";

grant update on table "public"."internal_users" to "authenticated";

grant delete on table "public"."internal_users" to "service_role";

grant insert on table "public"."internal_users" to "service_role";

grant references on table "public"."internal_users" to "service_role";

grant select on table "public"."internal_users" to "service_role";

grant trigger on table "public"."internal_users" to "service_role";

grant truncate on table "public"."internal_users" to "service_role";

grant update on table "public"."internal_users" to "service_role";

grant delete on table "public"."item_option_group_map" to "anon";

grant insert on table "public"."item_option_group_map" to "anon";

grant references on table "public"."item_option_group_map" to "anon";

grant select on table "public"."item_option_group_map" to "anon";

grant trigger on table "public"."item_option_group_map" to "anon";

grant truncate on table "public"."item_option_group_map" to "anon";

grant update on table "public"."item_option_group_map" to "anon";

grant delete on table "public"."item_option_group_map" to "authenticated";

grant insert on table "public"."item_option_group_map" to "authenticated";

grant references on table "public"."item_option_group_map" to "authenticated";

grant select on table "public"."item_option_group_map" to "authenticated";

grant trigger on table "public"."item_option_group_map" to "authenticated";

grant truncate on table "public"."item_option_group_map" to "authenticated";

grant update on table "public"."item_option_group_map" to "authenticated";

grant delete on table "public"."item_option_group_map" to "service_role";

grant insert on table "public"."item_option_group_map" to "service_role";

grant references on table "public"."item_option_group_map" to "service_role";

grant select on table "public"."item_option_group_map" to "service_role";

grant trigger on table "public"."item_option_group_map" to "service_role";

grant truncate on table "public"."item_option_group_map" to "service_role";

grant update on table "public"."item_option_group_map" to "service_role";

grant delete on table "public"."menu_items" to "anon";

grant insert on table "public"."menu_items" to "anon";

grant references on table "public"."menu_items" to "anon";

grant select on table "public"."menu_items" to "anon";

grant trigger on table "public"."menu_items" to "anon";

grant truncate on table "public"."menu_items" to "anon";

grant update on table "public"."menu_items" to "anon";

grant delete on table "public"."menu_items" to "authenticated";

grant insert on table "public"."menu_items" to "authenticated";

grant references on table "public"."menu_items" to "authenticated";

grant select on table "public"."menu_items" to "authenticated";

grant trigger on table "public"."menu_items" to "authenticated";

grant truncate on table "public"."menu_items" to "authenticated";

grant update on table "public"."menu_items" to "authenticated";

grant delete on table "public"."menu_items" to "service_role";

grant insert on table "public"."menu_items" to "service_role";

grant references on table "public"."menu_items" to "service_role";

grant select on table "public"."menu_items" to "service_role";

grant trigger on table "public"."menu_items" to "service_role";

grant truncate on table "public"."menu_items" to "service_role";

grant update on table "public"."menu_items" to "service_role";

grant delete on table "public"."option_groups" to "anon";

grant insert on table "public"."option_groups" to "anon";

grant references on table "public"."option_groups" to "anon";

grant select on table "public"."option_groups" to "anon";

grant trigger on table "public"."option_groups" to "anon";

grant truncate on table "public"."option_groups" to "anon";

grant update on table "public"."option_groups" to "anon";

grant delete on table "public"."option_groups" to "authenticated";

grant insert on table "public"."option_groups" to "authenticated";

grant references on table "public"."option_groups" to "authenticated";

grant select on table "public"."option_groups" to "authenticated";

grant trigger on table "public"."option_groups" to "authenticated";

grant truncate on table "public"."option_groups" to "authenticated";

grant update on table "public"."option_groups" to "authenticated";

grant delete on table "public"."option_groups" to "service_role";

grant insert on table "public"."option_groups" to "service_role";

grant references on table "public"."option_groups" to "service_role";

grant select on table "public"."option_groups" to "service_role";

grant trigger on table "public"."option_groups" to "service_role";

grant truncate on table "public"."option_groups" to "service_role";

grant update on table "public"."option_groups" to "service_role";

grant delete on table "public"."option_items" to "anon";

grant insert on table "public"."option_items" to "anon";

grant references on table "public"."option_items" to "anon";

grant select on table "public"."option_items" to "anon";

grant trigger on table "public"."option_items" to "anon";

grant truncate on table "public"."option_items" to "anon";

grant update on table "public"."option_items" to "anon";

grant delete on table "public"."option_items" to "authenticated";

grant insert on table "public"."option_items" to "authenticated";

grant references on table "public"."option_items" to "authenticated";

grant select on table "public"."option_items" to "authenticated";

grant trigger on table "public"."option_items" to "authenticated";

grant truncate on table "public"."option_items" to "authenticated";

grant update on table "public"."option_items" to "authenticated";

grant delete on table "public"."option_items" to "service_role";

grant insert on table "public"."option_items" to "service_role";

grant references on table "public"."option_items" to "service_role";

grant select on table "public"."option_items" to "service_role";

grant trigger on table "public"."option_items" to "service_role";

grant truncate on table "public"."option_items" to "service_role";

grant update on table "public"."option_items" to "service_role";

grant delete on table "public"."order_item_selections" to "anon";

grant insert on table "public"."order_item_selections" to "anon";

grant references on table "public"."order_item_selections" to "anon";

grant select on table "public"."order_item_selections" to "anon";

grant trigger on table "public"."order_item_selections" to "anon";

grant truncate on table "public"."order_item_selections" to "anon";

grant update on table "public"."order_item_selections" to "anon";

grant delete on table "public"."order_item_selections" to "authenticated";

grant insert on table "public"."order_item_selections" to "authenticated";

grant references on table "public"."order_item_selections" to "authenticated";

grant select on table "public"."order_item_selections" to "authenticated";

grant trigger on table "public"."order_item_selections" to "authenticated";

grant truncate on table "public"."order_item_selections" to "authenticated";

grant update on table "public"."order_item_selections" to "authenticated";

grant delete on table "public"."order_item_selections" to "service_role";

grant insert on table "public"."order_item_selections" to "service_role";

grant references on table "public"."order_item_selections" to "service_role";

grant select on table "public"."order_item_selections" to "service_role";

grant trigger on table "public"."order_item_selections" to "service_role";

grant truncate on table "public"."order_item_selections" to "service_role";

grant update on table "public"."order_item_selections" to "service_role";

grant delete on table "public"."order_items" to "anon";

grant insert on table "public"."order_items" to "anon";

grant references on table "public"."order_items" to "anon";

grant select on table "public"."order_items" to "anon";

grant trigger on table "public"."order_items" to "anon";

grant truncate on table "public"."order_items" to "anon";

grant update on table "public"."order_items" to "anon";

grant delete on table "public"."order_items" to "authenticated";

grant insert on table "public"."order_items" to "authenticated";

grant references on table "public"."order_items" to "authenticated";

grant select on table "public"."order_items" to "authenticated";

grant trigger on table "public"."order_items" to "authenticated";

grant truncate on table "public"."order_items" to "authenticated";

grant update on table "public"."order_items" to "authenticated";

grant delete on table "public"."order_items" to "service_role";

grant insert on table "public"."order_items" to "service_role";

grant references on table "public"."order_items" to "service_role";

grant select on table "public"."order_items" to "service_role";

grant trigger on table "public"."order_items" to "service_role";

grant truncate on table "public"."order_items" to "service_role";

grant update on table "public"."order_items" to "service_role";

grant delete on table "public"."orders" to "anon";

grant insert on table "public"."orders" to "anon";

grant references on table "public"."orders" to "anon";

grant select on table "public"."orders" to "anon";

grant trigger on table "public"."orders" to "anon";

grant truncate on table "public"."orders" to "anon";

grant update on table "public"."orders" to "anon";

grant delete on table "public"."orders" to "authenticated";

grant insert on table "public"."orders" to "authenticated";

grant references on table "public"."orders" to "authenticated";

grant select on table "public"."orders" to "authenticated";

grant trigger on table "public"."orders" to "authenticated";

grant truncate on table "public"."orders" to "authenticated";

grant update on table "public"."orders" to "authenticated";

grant delete on table "public"."orders" to "service_role";

grant insert on table "public"."orders" to "service_role";

grant references on table "public"."orders" to "service_role";

grant select on table "public"."orders" to "service_role";

grant trigger on table "public"."orders" to "service_role";

grant truncate on table "public"."orders" to "service_role";

grant update on table "public"."orders" to "service_role";

grant delete on table "public"."permissions" to "anon";

grant insert on table "public"."permissions" to "anon";

grant references on table "public"."permissions" to "anon";

grant select on table "public"."permissions" to "anon";

grant trigger on table "public"."permissions" to "anon";

grant truncate on table "public"."permissions" to "anon";

grant update on table "public"."permissions" to "anon";

grant delete on table "public"."permissions" to "authenticated";

grant insert on table "public"."permissions" to "authenticated";

grant references on table "public"."permissions" to "authenticated";

grant select on table "public"."permissions" to "authenticated";

grant trigger on table "public"."permissions" to "authenticated";

grant truncate on table "public"."permissions" to "authenticated";

grant update on table "public"."permissions" to "authenticated";

grant delete on table "public"."permissions" to "service_role";

grant insert on table "public"."permissions" to "service_role";

grant references on table "public"."permissions" to "service_role";

grant select on table "public"."permissions" to "service_role";

grant trigger on table "public"."permissions" to "service_role";

grant truncate on table "public"."permissions" to "service_role";

grant update on table "public"."permissions" to "service_role";

grant delete on table "public"."role_permissions" to "anon";

grant insert on table "public"."role_permissions" to "anon";

grant references on table "public"."role_permissions" to "anon";

grant select on table "public"."role_permissions" to "anon";

grant trigger on table "public"."role_permissions" to "anon";

grant truncate on table "public"."role_permissions" to "anon";

grant update on table "public"."role_permissions" to "anon";

grant delete on table "public"."role_permissions" to "authenticated";

grant insert on table "public"."role_permissions" to "authenticated";

grant references on table "public"."role_permissions" to "authenticated";

grant select on table "public"."role_permissions" to "authenticated";

grant trigger on table "public"."role_permissions" to "authenticated";

grant truncate on table "public"."role_permissions" to "authenticated";

grant update on table "public"."role_permissions" to "authenticated";

grant delete on table "public"."role_permissions" to "service_role";

grant insert on table "public"."role_permissions" to "service_role";

grant references on table "public"."role_permissions" to "service_role";

grant select on table "public"."role_permissions" to "service_role";

grant trigger on table "public"."role_permissions" to "service_role";

grant truncate on table "public"."role_permissions" to "service_role";

grant update on table "public"."role_permissions" to "service_role";

grant delete on table "public"."roles" to "anon";

grant insert on table "public"."roles" to "anon";

grant references on table "public"."roles" to "anon";

grant select on table "public"."roles" to "anon";

grant trigger on table "public"."roles" to "anon";

grant truncate on table "public"."roles" to "anon";

grant update on table "public"."roles" to "anon";

grant delete on table "public"."roles" to "authenticated";

grant insert on table "public"."roles" to "authenticated";

grant references on table "public"."roles" to "authenticated";

grant select on table "public"."roles" to "authenticated";

grant trigger on table "public"."roles" to "authenticated";

grant truncate on table "public"."roles" to "authenticated";

grant update on table "public"."roles" to "authenticated";

grant delete on table "public"."roles" to "service_role";

grant insert on table "public"."roles" to "service_role";

grant references on table "public"."roles" to "service_role";

grant select on table "public"."roles" to "service_role";

grant trigger on table "public"."roles" to "service_role";

grant truncate on table "public"."roles" to "service_role";

grant update on table "public"."roles" to "service_role";

grant delete on table "public"."stores" to "anon";

grant insert on table "public"."stores" to "anon";

grant references on table "public"."stores" to "anon";

grant select on table "public"."stores" to "anon";

grant trigger on table "public"."stores" to "anon";

grant truncate on table "public"."stores" to "anon";

grant update on table "public"."stores" to "anon";

grant delete on table "public"."stores" to "authenticated";

grant insert on table "public"."stores" to "authenticated";

grant references on table "public"."stores" to "authenticated";

grant select on table "public"."stores" to "authenticated";

grant trigger on table "public"."stores" to "authenticated";

grant truncate on table "public"."stores" to "authenticated";

grant update on table "public"."stores" to "authenticated";

grant delete on table "public"."stores" to "service_role";

grant insert on table "public"."stores" to "service_role";

grant references on table "public"."stores" to "service_role";

grant select on table "public"."stores" to "service_role";

grant trigger on table "public"."stores" to "service_role";

grant truncate on table "public"."stores" to "service_role";

grant update on table "public"."stores" to "service_role";


