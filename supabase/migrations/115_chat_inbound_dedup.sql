-- Duplicate inbound messages, deduplicated somewhere both instances can see.
--
-- api/chat.js held the recent-message set in a module-level Map. Module scope
-- on Vercel lives inside one lambda instance, and the duplicates that matter
-- arrive while the first request is still running its model call — so they are
-- concurrent, land on a second instance, and meet an empty Map. The guard only
-- ever fired when a repeat arrived after the first had finished and happened to
-- be routed back to the same warm instance.
--
-- The claim moves here, where a unique key and a single statement make it
-- atomic: whichever request inserts the row answers, the other says nothing.

create table if not exists chat_inbound_dedup (
  key        text primary key,
  claimed_at timestamptz not null default now()
);

create index if not exists chat_inbound_dedup_claimed_idx
  on chat_inbound_dedup (claimed_at);

alter table chat_inbound_dedup enable row level security;
-- No policies: only the service role reaches this, same as the session store.

-- Returns true when the caller has the claim and should answer.
--
-- The conflict path re-claims only if the existing row is older than the
-- window, so the same customer asking the same thing an hour later is a new
-- question, not a duplicate. Postgres serialises the conflicting inserts, so
-- two requests in the same millisecond still produce exactly one claim.
create or replace function claim_inbound_message(
  p_key       text,
  p_window_ms integer default 12000
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claimed text;
begin
  if p_key is null or length(trim(p_key)) = 0 then
    return true;            -- nothing to dedupe on; never block the reply
  end if;

  insert into chat_inbound_dedup as d (key, claimed_at)
  values (p_key, now())
  on conflict (key) do update
    set claimed_at = now()
    where d.claimed_at < now() - make_interval(secs => p_window_ms / 1000.0)
  returning d.key into v_claimed;

  return v_claimed is not null;
end;
$$;

-- Releases a claim so a retry after a failed turn is answered rather than
-- silently swallowed — the in-memory version did this in its catch block.
create or replace function release_inbound_message(p_key text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from chat_inbound_dedup where key = p_key;
$$;

-- Keeps the table from growing without bound. Rows are only interesting for
-- seconds; anything past an hour is dead weight.
create or replace function prune_chat_inbound_dedup()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer;
begin
  delete from chat_inbound_dedup where claimed_at < now() - interval '1 hour';
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function claim_inbound_message(text, integer) from public, anon;
revoke all on function release_inbound_message(text) from public, anon;
revoke all on function prune_chat_inbound_dedup() from public, anon;
grant execute on function claim_inbound_message(text, integer) to service_role;
grant execute on function release_inbound_message(text) to service_role;
grant execute on function prune_chat_inbound_dedup() to service_role;
