-- 078 granted get_customer_points_by_phone to service_role but never
-- revoked the default PUBLIC execute grant Postgres adds to every new
-- function — so it was reachable with the anon key (verified live: an
-- anon-key call succeeded and returned real data). This exposes a
-- monetary points balance by phone number alone; must only be reachable
-- by our own backend, same as get_customer_past_products.
revoke all on function get_customer_points_by_phone(text) from public, anon, authenticated;
grant execute on function get_customer_points_by_phone(text) to service_role;
