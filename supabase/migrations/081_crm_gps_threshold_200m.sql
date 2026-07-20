-- GPS visit threshold: allow verified visits within 200m of doctor location.
-- Farther visits still insert but with gps_verified = false (admin warning).
create or replace function crm_visits_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  doc record;
  my_rep uuid;
begin
  my_rep := current_rep_id();
  if not is_crm_admin() then
    if my_rep is null then
      raise exception 'No active CRM account for this user';
    end if;
    new.rep_id := my_rep;
  end if;

  new.gps_verified := false;
  new.distance_from_doctor := null;

  select lat, lng into doc from crm_doctors where id = new.doctor_id;

  if new.lat is not null and new.lng is not null then
    if doc.lat is not null and doc.lng is not null then
      new.distance_from_doctor := round(
        2 * 6371000 * asin( sqrt(
          power(sin(radians(new.lat - doc.lat) / 2), 2) +
          cos(radians(doc.lat)) * cos(radians(new.lat)) *
          power(sin(radians(new.lng - doc.lng) / 2), 2)
        ))
      )::int;
      new.gps_verified := new.distance_from_doctor <= 200;
    else
      -- first ever visit to this doctor: location gets recorded (after insert)
      new.gps_verified := true;
    end if;
  end if;

  return new;
end;
$$;
