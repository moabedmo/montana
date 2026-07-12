-- Rep monthly schedule: AM/PM field days on crm_day_logs
alter table crm_day_logs
  add column if not exists time_of_day text;

create index if not exists crm_day_logs_rep_month_idx
  on crm_day_logs (rep_id, log_date);
