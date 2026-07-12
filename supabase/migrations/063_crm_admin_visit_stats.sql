-- Admin visit dashboard: counts by client (pharmacy/doctor), rep, and type.

create or replace function get_admin_visit_stats(
  p_year int default null,
  p_month int default null
)
returns json
language plpgsql security definer set search_path = public as $$
declare
  v_start timestamptz;
  v_end timestamptz;
  v_today date := current_date;
begin
  if not is_crm_admin() and not is_invoice_admin() then
    raise exception 'Admin only';
  end if;

  v_start := make_date(
    coalesce(p_year, extract(year from current_date)::int),
    coalesce(p_month, extract(month from current_date)::int),
    1
  )::timestamptz;
  v_end := (v_start + interval '1 month');

  return json_build_object(
    'month', to_char(v_start, 'YYYY-MM'),
    'totals', (
      select json_build_object(
        'total', count(*)::int,
        'today', count(*) filter (where v.visited_at::date = v_today)::int,
        'actual', count(*) filter (where coalesce(v.visit_type, 'regular') = 'actual')::int,
        'no_show', count(*) filter (where v.visit_type = 'no_show')::int,
        'pharmacy', count(*) filter (where coalesce(d.doctor_type, 'doctor') = 'pharmacy')::int,
        'doctor', count(*) filter (where coalesce(d.doctor_type, 'doctor') in ('doctor', 'polyclinic', 'hospital'))::int,
        'other', count(*) filter (where coalesce(d.doctor_type, 'doctor') not in ('pharmacy', 'doctor', 'polyclinic', 'hospital'))::int,
        'gps_flagged', count(*) filter (where v.gps_verified = false)::int,
        'unique_clients', count(distinct v.doctor_id)::int
      )
      from crm_visits v
      left join crm_doctors d on d.id = v.doctor_id
      where v.visited_at >= v_start and v.visited_at < v_end
    ),
    'by_client', coalesce((
      select json_agg(row_to_json(t) order by t.visit_count desc, t.client_name)
      from (
        select
          d.id as doctor_id,
          d.name as client_name,
          coalesce(d.doctor_type, 'doctor') as client_type,
          d.class,
          b.name as brick_name,
          count(v.id)::int as visit_count,
          count(v.id) filter (where coalesce(v.visit_type, 'regular') = 'actual')::int as actual_count,
          max(v.visited_at) as last_visit,
          string_agg(distinct r.name, ', ' order by r.name) as rep_names
        from crm_visits v
        join crm_doctors d on d.id = v.doctor_id
        left join crm_bricks b on b.id = d.brick_id
        left join crm_reps r on r.id = v.rep_id
        where v.visited_at >= v_start and v.visited_at < v_end
        group by d.id, d.name, d.doctor_type, d.class, b.name
        order by count(v.id) desc, d.name
        limit 200
      ) t
    ), '[]'::json),
    'by_rep', coalesce((
      select json_agg(row_to_json(t) order by t.visit_count desc)
      from (
        select
          r.id as rep_id,
          r.name as rep_name,
          count(v.id)::int as visit_count,
          count(v.id) filter (where coalesce(d.doctor_type, 'doctor') = 'pharmacy')::int as pharmacy_visits,
          count(v.id) filter (where coalesce(d.doctor_type, 'doctor') in ('doctor', 'polyclinic', 'hospital'))::int as doctor_visits,
          count(v.id) filter (where coalesce(v.visit_type, 'regular') = 'actual')::int as actual_count
        from crm_visits v
        join crm_reps r on r.id = v.rep_id
        left join crm_doctors d on d.id = v.doctor_id
        where v.visited_at >= v_start and v.visited_at < v_end
        group by r.id, r.name
        order by count(v.id) desc
      ) t
    ), '[]'::json)
  );
end $$;
grant execute on function get_admin_visit_stats(int, int) to authenticated;
