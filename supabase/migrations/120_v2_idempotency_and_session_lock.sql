-- Migration 120: Montana AI Sales Assistant v2.0 (security-hardened)
--
-- 1. Database-enforced atomic order idempotency via a SEPARATE RPC
--    (create_chat_order_idempotent) — create_guest_order is NOT touched.
-- 2. Database-backed per-session lease + versioned, stale-write-protected saves.
--
-- SECURITY MODEL
--   * Every function below is SECURITY DEFINER, therefore every one of them is
--     REVOKEd from PUBLIC / anon / authenticated and GRANTed to service_role
--     ONLY. The anon key ships in browser JS; nothing here may be reachable
--     with it. The chat engine calls them with the server-side service-role
--     client and refuses to use v2 when that client is not configured.
--   * An idempotency key is NOT authorization. A replay is returned only when
--     the stored order belongs to the SAME chat session as the caller; any other
--     combination raises. There is no "no key" path and no fallback to
--     create_guest_order.
--   * get_chat_bot_session / save_chat_bot_session (migration 112) are left
--     exactly as they are. Version/lease data is exposed only through the new
--     service-only get_chat_bot_session_v2.
--   * search_path is pinned to public, pg_temp on every function.

-- ─────────────────────────────────────────────────────────────────────────────
-- PART 1: ORDER IDEMPOTENCY
-- ─────────────────────────────────────────────────────────────────────────────

set lock_timeout = '5s';
set statement_timeout = '10s';

alter table public.orders
  add column if not exists idempotency_key text;

create unique index if not exists orders_idempotency_key_uniq
  on public.orders (idempotency_key)
  where idempotency_key is not null;

-- Session-bound lookup of an already-committed order.
create or replace function public.get_order_by_idempotency_key(
  p_idempotency_key text,
  p_chat_session_id text
)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_key text := nullif(trim(coalesce(p_idempotency_key, '')), '');
  v_sid text := nullif(trim(coalesce(p_chat_session_id, '')), '');
  v_order public.orders%rowtype;
  v_items json;
begin
  if v_key is null or length(v_key) < 16 or v_sid is null then
    return json_build_object('found', false);
  end if;

  select * into v_order
  from public.orders
  where idempotency_key = v_key
  limit 1;

  -- Not found, OR found but owned by a different chat session: reveal nothing.
  if not found or v_order.chat_session_id is distinct from v_sid then
    return json_build_object('found', false);
  end if;

  select coalesce(json_agg(oi), '[]'::json) into v_items
  from public.order_items oi
  where oi.order_id = v_order.id;

  return json_build_object(
    'found', true,
    'order', json_build_object(
      'id', v_order.id,
      'order_number', v_order.order_number,
      'customer_name', v_order.customer_name,
      'customer_phone', v_order.customer_phone,
      'subtotal', v_order.subtotal,
      'shipping_cost', v_order.shipping_cost,
      'discount', v_order.discount,
      'total', v_order.total,
      'deposit_amount', v_order.deposit_amount,
      'status', v_order.status
    ),
    'items', v_items,
    'idempotent_replay', true
  );
end;
$$;

-- Atomic idempotent order creation for chatbot v2.
--   * A key and a chat session id are MANDATORY (raises otherwise — no fallback).
--   * Concurrent calls with the same key serialize on pg_advisory_xact_lock and
--     are backstopped by orders_idempotency_key_uniq.
--   * Stock is deducted at most once per key: create_guest_order runs in the
--     same sub-transaction that stamps the key.
--   * If creation fails the whole call rolls back; no key is stored, so a retry
--     can succeed.
--   * A replay is honoured only for the same chat session.
create or replace function public.create_chat_order_idempotent(
  p_idempotency_key text,
  p_customer jsonb,
  p_items jsonb,
  p_payment_method text default 'cod',
  p_delivery_method text default 'standard',
  p_subtotal numeric default 0,
  p_shipping_cost numeric default 0,
  p_discount numeric default 0,
  p_total numeric default 0,
  p_governorate text default null,
  p_deposit_amount numeric default 0,
  p_chat_session_id text default null,
  p_chat_channel text default null
)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_key text := nullif(trim(coalesce(p_idempotency_key, '')), '');
  v_sid text := nullif(trim(coalesce(p_chat_session_id, '')), '');
  v_existing_order public.orders%rowtype;
  v_existing_items json;
  v_created json;
  v_order_id bigint;
begin
  if v_key is null or length(v_key) < 16 then
    raise exception 'idempotency_key_required' using errcode = '22023';
  end if;
  if v_sid is null then
    raise exception 'chat_session_id_required' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext('montana_order_idem:' || v_key));

  select * into v_existing_order
  from public.orders
  where idempotency_key = v_key
  limit 1;

  if found then
    if v_existing_order.chat_session_id is distinct from v_sid then
      raise exception 'idempotency_key_session_mismatch' using errcode = '42501';
    end if;

    select coalesce(json_agg(oi), '[]'::json) into v_existing_items
    from public.order_items oi
    where oi.order_id = v_existing_order.id;

    return json_build_object(
      'order', row_to_json(v_existing_order),
      'items', v_existing_items,
      'idempotent_replay', true
    );
  end if;

  begin
    v_created := public.create_guest_order(
      p_customer := p_customer,
      p_items := p_items,
      p_payment_method := p_payment_method,
      p_delivery_method := p_delivery_method,
      p_subtotal := p_subtotal,
      p_shipping_cost := p_shipping_cost,
      p_discount := p_discount,
      p_total := p_total,
      p_governorate := p_governorate,
      p_deposit_amount := p_deposit_amount,
      p_chat_session_id := v_sid,
      p_chat_channel := p_chat_channel
    );

    v_order_id := ((v_created -> 'order') ->> 'id')::bigint;

    update public.orders
    set idempotency_key = v_key
    where id = v_order_id;

    return json_build_object(
      'order', ((v_created -> 'order')::jsonb || jsonb_build_object('idempotency_key', v_key))::json,
      'items', v_created -> 'items',
      'idempotent_replay', false
    );
  exception
    when unique_violation then
      -- The sub-transaction rolled back the duplicate order + stock deduction.
      select * into v_existing_order
      from public.orders
      where idempotency_key = v_key
      limit 1;

      if not found or v_existing_order.chat_session_id is distinct from v_sid then
        raise exception 'idempotency_key_session_mismatch' using errcode = '42501';
      end if;

      select coalesce(json_agg(oi), '[]'::json) into v_existing_items
      from public.order_items oi
      where oi.order_id = v_existing_order.id;

      return json_build_object(
        'order', row_to_json(v_existing_order),
        'items', v_existing_items,
        'idempotent_replay', true
      );
  end;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- PART 2: SESSION LEASE & STALE-WRITE PROTECTION
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.chat_bot_sessions
  add column if not exists state_version bigint not null default 1,
  add column if not exists lease_owner text,
  add column if not exists lease_expires_at timestamptz;

-- Version/lease-aware read. NEW function: get_chat_bot_session (112) keeps its
-- original body and grants, so lease data is never exposed to anon.
create or replace function public.get_chat_bot_session_v2(p_session_id text)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.chat_bot_sessions%rowtype;
begin
  if p_session_id is null or length(trim(p_session_id)) = 0 then
    return json_build_object('found', false);
  end if;

  select * into v_row
  from public.chat_bot_sessions
  where session_id = p_session_id
  limit 1;

  if not found then
    return json_build_object('found', false);
  end if;

  return json_build_object(
    'found', true,
    'cart', coalesce(v_row.cart_json, '[]'::jsonb),
    'history', coalesce(v_row.history_json, '[]'::jsonb),
    'customer_phone', v_row.customer_phone,
    'customer_name', v_row.customer_name,
    'checkout_wizard', v_row.checkout_wizard_json,
    'order_wizard', v_row.order_wizard_json,
    'chat_channel', v_row.chat_channel,
    'selected_bundle', v_row.selected_bundle,
    'updated_at', v_row.updated_at,
    'state_version', coalesce(v_row.state_version, 1),
    'lease_owner', v_row.lease_owner,
    'lease_expires_at', v_row.lease_expires_at
  );
end;
$$;

create or replace function public.acquire_chat_session_lease(
  p_session_id text,
  p_owner_id text,
  p_ttl_ms integer default 8000
)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ttl interval := make_interval(secs => least(greatest(coalesce(p_ttl_ms, 8000), 500), 60000) / 1000.0);
  v_row public.chat_bot_sessions%rowtype;
begin
  if p_session_id is null or length(trim(p_session_id)) = 0
     or p_owner_id is null or length(trim(p_owner_id)) = 0 then
    return json_build_object('acquired', false, 'reason', 'invalid_args');
  end if;

  insert into public.chat_bot_sessions as s (
    session_id, cart_json, history_json, state_version, lease_owner, lease_expires_at, updated_at
  ) values (
    p_session_id, '[]'::jsonb, '[]'::jsonb, 1, p_owner_id, now() + v_ttl, now()
  )
  on conflict (session_id) do update
    set lease_owner = p_owner_id,
        lease_expires_at = now() + v_ttl
    where s.lease_owner is null
       or s.lease_owner = p_owner_id
       or s.lease_expires_at is null
       or s.lease_expires_at <= now()
  returning * into v_row;

  if found then
    return json_build_object(
      'acquired', true,
      'owner_id', v_row.lease_owner,
      'state_version', v_row.state_version,
      'lease_expires_at', v_row.lease_expires_at
    );
  end if;

  select * into v_row from public.chat_bot_sessions where session_id = p_session_id limit 1;
  return json_build_object(
    'acquired', false,
    'owner_id', v_row.lease_owner,
    'state_version', v_row.state_version,
    'lease_expires_at', v_row.lease_expires_at
  );
end;
$$;

create or replace function public.renew_chat_session_lease(
  p_session_id text,
  p_owner_id text,
  p_ttl_ms integer default 8000
)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ttl interval := make_interval(secs => least(greatest(coalesce(p_ttl_ms, 8000), 500), 60000) / 1000.0);
  v_row public.chat_bot_sessions%rowtype;
begin
  update public.chat_bot_sessions
  set lease_expires_at = now() + v_ttl
  where session_id = p_session_id
    and lease_owner = p_owner_id
  returning * into v_row;

  if found then
    return json_build_object(
      'renewed', true,
      'owner_id', v_row.lease_owner,
      'lease_expires_at', v_row.lease_expires_at
    );
  end if;

  return json_build_object('renewed', false);
end;
$$;

create or replace function public.release_chat_session_lease(
  p_session_id text,
  p_owner_id text
)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_released integer := 0;
begin
  update public.chat_bot_sessions
  set lease_owner = null,
      lease_expires_at = null
  where session_id = p_session_id
    and lease_owner = p_owner_id;

  get diagnostics v_released = row_count;
  return json_build_object('released', v_released > 0);
end;
$$;

-- Versioned save with ownership verification and stale-write protection.
-- save_chat_bot_session (112, 9 params) is NOT touched.
create or replace function public.save_chat_bot_session_v2(
  p_session_id text,
  p_cart jsonb default null,
  p_history jsonb default null,
  p_customer_phone text default null,
  p_customer_name text default null,
  p_checkout_wizard jsonb default null,
  p_order_wizard jsonb default null,
  p_chat_channel text default null,
  p_selected_bundle text default null,
  p_expected_version bigint default null,
  p_lease_owner text default null
)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.chat_bot_sessions%rowtype;
  v_new_version bigint;
begin
  if p_session_id is null or length(trim(p_session_id)) = 0 then
    return json_build_object('saved', false, 'reason', 'empty_session_id');
  end if;

  select * into v_row
  from public.chat_bot_sessions
  where session_id = p_session_id
  for update;

  if found then
    -- 1. Ownership: reject if another active, non-expired lease owns the session
    if v_row.lease_owner is not null
       and v_row.lease_expires_at is not null
       and v_row.lease_expires_at > now()
       and (p_lease_owner is null or v_row.lease_owner <> p_lease_owner) then
      return json_build_object(
        'saved', false,
        'conflict', true,
        'reason', 'LEASE_OWNED_BY_OTHER',
        'current_version', v_row.state_version,
        'current_state', json_build_object(
          'cart', coalesce(v_row.cart_json, '[]'::jsonb),
          'history', coalesce(v_row.history_json, '[]'::jsonb),
          'customer_phone', v_row.customer_phone,
          'customer_name', v_row.customer_name,
          'checkout_wizard', v_row.checkout_wizard_json,
          'order_wizard', v_row.order_wizard_json,
          'selected_bundle', v_row.selected_bundle,
          'updated_at', v_row.updated_at,
          'state_version', v_row.state_version
        )
      );
    end if;

    -- 2. Stale-write protection
    if p_expected_version is not null and v_row.state_version > p_expected_version then
      return json_build_object(
        'saved', false,
        'conflict', true,
        'reason', 'STALE_VERSION',
        'current_version', v_row.state_version,
        'current_state', json_build_object(
          'cart', coalesce(v_row.cart_json, '[]'::jsonb),
          'history', coalesce(v_row.history_json, '[]'::jsonb),
          'customer_phone', v_row.customer_phone,
          'customer_name', v_row.customer_name,
          'checkout_wizard', v_row.checkout_wizard_json,
          'order_wizard', v_row.order_wizard_json,
          'selected_bundle', v_row.selected_bundle,
          'updated_at', v_row.updated_at,
          'state_version', v_row.state_version
        )
      );
    end if;

    v_new_version := coalesce(v_row.state_version, 1) + 1;

    update public.chat_bot_sessions
    set cart_json = coalesce(p_cart, chat_bot_sessions.cart_json),
        history_json = coalesce(p_history, chat_bot_sessions.history_json),
        customer_phone = coalesce(nullif(p_customer_phone, ''), chat_bot_sessions.customer_phone),
        customer_name = coalesce(nullif(p_customer_name, ''), chat_bot_sessions.customer_name),
        checkout_wizard_json = p_checkout_wizard,
        order_wizard_json = p_order_wizard,
        chat_channel = coalesce(nullif(p_chat_channel, ''), chat_bot_sessions.chat_channel),
        selected_bundle = case
          when p_selected_bundle is null then chat_bot_sessions.selected_bundle
          when trim(p_selected_bundle) = '' or trim(p_selected_bundle) = '__cleared__' then null
          else trim(p_selected_bundle)
        end,
        state_version = v_new_version,
        updated_at = now()
    where session_id = p_session_id;

    return json_build_object(
      'saved', true,
      'conflict', false,
      'state_version', v_new_version
    );
  end if;

  insert into public.chat_bot_sessions (
    session_id, cart_json, history_json, customer_phone, customer_name,
    checkout_wizard_json, order_wizard_json, chat_channel, selected_bundle,
    state_version, lease_owner, updated_at
  ) values (
    p_session_id,
    coalesce(p_cart, '[]'::jsonb),
    coalesce(p_history, '[]'::jsonb),
    nullif(p_customer_phone, ''),
    nullif(p_customer_name, ''),
    p_checkout_wizard,
    p_order_wizard,
    nullif(p_chat_channel, ''),
    case
      when p_selected_bundle is null or trim(p_selected_bundle) = '' or trim(p_selected_bundle) = '__cleared__' then null
      else trim(p_selected_bundle)
    end,
    1,
    p_lease_owner,
    now()
  );

  return json_build_object(
    'saved', true,
    'conflict', false,
    'state_version', 1
  );
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- PERMISSIONS: service_role ONLY.
-- Postgres grants EXECUTE to PUBLIC on every new function, and Supabase's
-- default privileges add anon / authenticated — both must be removed explicitly.
-- ─────────────────────────────────────────────────────────────────────────────

revoke all on function public.get_order_by_idempotency_key(text, text) from public, anon, authenticated;
revoke all on function public.create_chat_order_idempotent(text, jsonb, jsonb, text, text, numeric, numeric, numeric, numeric, text, numeric, text, text) from public, anon, authenticated;
revoke all on function public.get_chat_bot_session_v2(text) from public, anon, authenticated;
revoke all on function public.acquire_chat_session_lease(text, text, integer) from public, anon, authenticated;
revoke all on function public.renew_chat_session_lease(text, text, integer) from public, anon, authenticated;
revoke all on function public.release_chat_session_lease(text, text) from public, anon, authenticated;
revoke all on function public.save_chat_bot_session_v2(text, jsonb, jsonb, text, text, jsonb, jsonb, text, text, bigint, text) from public, anon, authenticated;

grant execute on function public.get_order_by_idempotency_key(text, text) to service_role;
grant execute on function public.create_chat_order_idempotent(text, jsonb, jsonb, text, text, numeric, numeric, numeric, numeric, text, numeric, text, text) to service_role;
grant execute on function public.get_chat_bot_session_v2(text) to service_role;
grant execute on function public.acquire_chat_session_lease(text, text, integer) to service_role;
grant execute on function public.renew_chat_session_lease(text, text, integer) to service_role;
grant execute on function public.release_chat_session_lease(text, text) to service_role;
grant execute on function public.save_chat_bot_session_v2(text, jsonb, jsonb, text, text, jsonb, jsonb, text, text, bigint, text) to service_role;

notify pgrst, 'reload schema';
