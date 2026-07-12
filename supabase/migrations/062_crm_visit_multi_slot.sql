-- Allow AM + PM schedule for same doctor on same day; multiple visits per month.

alter table crm_visit_schedule
  drop constraint if exists crm_visit_schedule_plan_item_id_scheduled_date_key;

drop index if exists crm_visit_schedule_plan_item_id_scheduled_date_key;

create unique index if not exists crm_visit_schedule_item_date_slot_key
  on crm_visit_schedule (plan_item_id, scheduled_date, time_of_day);
