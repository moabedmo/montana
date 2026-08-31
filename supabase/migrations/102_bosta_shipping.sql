-- Bosta courier integration fields on store orders
alter table orders add column if not exists bosta_delivery_id text;
alter table orders add column if not exists bosta_tracking_number text;
alter table orders add column if not exists bosta_status text;
alter table orders add column if not exists bosta_sent_at timestamptz;

create index if not exists idx_orders_bosta_delivery on orders(bosta_delivery_id) where bosta_delivery_id is not null;
create index if not exists idx_orders_bosta_tracking on orders(bosta_tracking_number) where bosta_tracking_number is not null;
