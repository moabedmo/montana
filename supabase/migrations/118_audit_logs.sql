-- Montana Naturals — Activity & Audit Log (سجل النشاطات والتغييرات)
-- Records all deletions, status updates, and critical modifications across:
-- 1. Orders (web / facebook / instagram / manual)
-- 2. Pharmacy Invoices (trade sales & collections)
-- 3. CRM Doctors & Pharmacies
-- 4. Store Invoices

create table if not exists audit_logs (
  id bigserial primary key,
  action_type text not null check (action_type in ('DELETE', 'UPDATE', 'CREATE')),
  entity_type text not null check (entity_type in ('order', 'pharmacy_invoice', 'doctor', 'invoice', 'stock', 'other')),
  entity_ref text,
  summary text not null,
  actor_name text default 'مسؤول النظام',
  actor_email text,
  details jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_created_idx on audit_logs (created_at desc);
create index if not exists audit_logs_entity_idx on audit_logs (entity_type, created_at desc);
create index if not exists audit_logs_action_idx on audit_logs (action_type, created_at desc);

alter table audit_logs enable row level security;

-- Only owner and store admin can view audit logs
drop policy if exists audit_logs_read on audit_logs;
create policy audit_logs_read on audit_logs
  for select to authenticated
  using (is_owner() or is_store_admin());

-- Insert allowed for authenticated operations and service role
drop policy if exists audit_logs_insert on audit_logs;
create policy audit_logs_insert on audit_logs
  for insert to authenticated
  with check (true);

-- Immutable: NO ONE can delete or update audit logs (prevents tampering)
drop policy if exists audit_logs_no_update on audit_logs;
drop policy if exists audit_logs_no_delete on audit_logs;


-- 1. TRIGGER: Orders (deletions and status/total changes)
create or replace function trg_audit_orders()
returns trigger
language plpgsql security definer as $$
declare
  v_user_email text := coalesce(auth.jwt() ->> 'email', 'admin/system');
begin
  if (TG_OP = 'DELETE') then
    insert into audit_logs (action_type, entity_type, entity_ref, summary, actor_name, actor_email, details)
    values (
      'DELETE',
      'order',
      OLD.order_number,
      'تم حذف الطلب ' || coalesce(OLD.order_number, '#' || OLD.id::text) || ' للعميل (' || coalesce(OLD.customer_name, 'بدون اسم') || ') بمبلغ ' || coalesce(OLD.total, 0)::text || ' ج.م',
      coalesce(auth.jwt() ->> 'name', v_user_email),
      v_user_email,
      jsonb_build_object('order', to_jsonb(OLD))
    );
    return OLD;
  elsif (TG_OP = 'UPDATE') then
    if (OLD.status is distinct from NEW.status) then
      insert into audit_logs (action_type, entity_type, entity_ref, summary, actor_name, actor_email, details)
      values (
        'UPDATE',
        'order',
        NEW.order_number,
        'تعديل حالة الطلب ' || coalesce(NEW.order_number, '#' || NEW.id::text) || ' من [' || coalesce(OLD.status, '—') || '] إلى [' || coalesce(NEW.status, '—') || ']',
        coalesce(auth.jwt() ->> 'name', v_user_email),
        v_user_email,
        jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status, 'total', NEW.total, 'customer', NEW.customer_name)
      );
    elsif (OLD.total is distinct from NEW.total) then
      insert into audit_logs (action_type, entity_type, entity_ref, summary, actor_name, actor_email, details)
      values (
        'UPDATE',
        'order',
        NEW.order_number,
        'تعديل إجمالي الطلب ' || coalesce(NEW.order_number, '#' || NEW.id::text) || ' من ' || coalesce(OLD.total, 0)::text || ' إلى ' || coalesce(NEW.total, 0)::text || ' ج.م',
        coalesce(auth.jwt() ->> 'name', v_user_email),
        v_user_email,
        jsonb_build_object('old_total', OLD.total, 'new_total', NEW.total)
      );
    end if;
    return NEW;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_audit_orders_change on orders;
create trigger trg_audit_orders_change
  before delete or after update on orders
  for each row execute function trg_audit_orders();


-- 2. TRIGGER: Pharmacy Invoices (deletions, payments collected, status changes)
create or replace function trg_audit_pharmacy_invoices()
returns trigger
language plpgsql security definer as $$
declare
  v_user_email text := coalesce(auth.jwt() ->> 'email', 'admin/system');
begin
  if (TG_OP = 'DELETE') then
    insert into audit_logs (action_type, entity_type, entity_ref, summary, actor_name, actor_email, details)
    values (
      'DELETE',
      'pharmacy_invoice',
      OLD.invoice_number,
      'تم حذف فاتورة صيدلية ' || coalesce(OLD.invoice_number, '') || ' الخاصة بـ (' || coalesce(OLD.pharmacy_name, 'صيدلية') || ') بمبلغ ' || coalesce(OLD.total, 0)::text || ' ج.م',
      coalesce(auth.jwt() ->> 'name', v_user_email),
      v_user_email,
      jsonb_build_object('invoice', to_jsonb(OLD))
    );
    return OLD;
  elsif (TG_OP = 'UPDATE') then
    if (OLD.amount_paid is distinct from NEW.amount_paid) then
      insert into audit_logs (action_type, entity_type, entity_ref, summary, actor_name, actor_email, details)
      values (
        'UPDATE',
        'pharmacy_invoice',
        NEW.invoice_number,
        'تعديل التحصيل في فاتورة ' || coalesce(NEW.invoice_number, '') || ' (' || coalesce(NEW.pharmacy_name, '') || '): المدفوع من ' || coalesce(OLD.amount_paid, 0)::text || ' إلى ' || coalesce(NEW.amount_paid, 0)::text || ' ج.م (المتبقي: ' || (coalesce(NEW.total, 0) - coalesce(NEW.amount_paid, 0))::text || ' ج.م)',
        coalesce(auth.jwt() ->> 'name', v_user_email),
        v_user_email,
        jsonb_build_object('old_paid', OLD.amount_paid, 'new_paid', NEW.amount_paid, 'total', NEW.total, 'status', NEW.status)
      );
    elsif (OLD.status is distinct from NEW.status) then
      insert into audit_logs (action_type, entity_type, entity_ref, summary, actor_name, actor_email, details)
      values (
        'UPDATE',
        'pharmacy_invoice',
        NEW.invoice_number,
        'تغيير حالة فاتورة ' || coalesce(NEW.invoice_number, '') || ' (' || coalesce(NEW.pharmacy_name, '') || ') إلى [' || coalesce(NEW.status, '') || ']',
        coalesce(auth.jwt() ->> 'name', v_user_email),
        v_user_email,
        jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status)
      );
    end if;
    return NEW;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_audit_pharmacy_invoices_change on crm_pharmacy_invoices;
create trigger trg_audit_pharmacy_invoices_change
  before delete or after update on crm_pharmacy_invoices
  for each row execute function trg_audit_pharmacy_invoices();


-- 3. TRIGGER: CRM Doctors (deletions and status changes)
create or replace function trg_audit_crm_doctors()
returns trigger
language plpgsql security definer as $$
declare
  v_user_email text := coalesce(auth.jwt() ->> 'email', 'rep/admin');
begin
  if (TG_OP = 'DELETE') then
    insert into audit_logs (action_type, entity_type, entity_ref, summary, actor_name, actor_email, details)
    values (
      'DELETE',
      'doctor',
      OLD.name,
      'تم حذف دكتور/جهة من CRM: ' || coalesce(OLD.name, '') || ' (' || coalesce(OLD.doctor_type, 'دكتور') || ') - العنوان: ' || coalesce(OLD.address, '—'),
      coalesce(auth.jwt() ->> 'name', v_user_email),
      v_user_email,
      jsonb_build_object('doctor', to_jsonb(OLD))
    );
    return OLD;
  elsif (TG_OP = 'UPDATE') then
    if (OLD.is_active is distinct from NEW.is_active) then
      insert into audit_logs (action_type, entity_type, entity_ref, summary, actor_name, actor_email, details)
      values (
        'UPDATE',
        'doctor',
        NEW.name,
        'تغيير حالة نشاط دكتور CRM ' || coalesce(NEW.name, '') || ' إلى: ' || case when NEW.is_active then 'نشط' else 'غير نشط' end,
        coalesce(auth.jwt() ->> 'name', v_user_email),
        v_user_email,
        jsonb_build_object('is_active', NEW.is_active)
      );
    end if;
    return NEW;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_audit_crm_doctors_change on crm_doctors;
create trigger trg_audit_crm_doctors_change
  before delete or after update on crm_doctors
  for each row execute function trg_audit_crm_doctors();
