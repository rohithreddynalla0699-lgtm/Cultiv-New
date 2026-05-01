alter table public.stores
  add column if not exists latitude numeric,
  add column if not exists longitude numeric;

alter table public.stores
  drop constraint if exists stores_latitude_range_check;

alter table public.stores
  add constraint stores_latitude_range_check
  check (latitude is null or (latitude >= -90 and latitude <= 90));

alter table public.stores
  drop constraint if exists stores_longitude_range_check;

alter table public.stores
  add constraint stores_longitude_range_check
  check (longitude is null or (longitude >= -180 and longitude <= 180));
