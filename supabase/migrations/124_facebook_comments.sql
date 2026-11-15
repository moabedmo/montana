-- Montana Naturals — Facebook Comments Management Table
-- Stores comments from Facebook Posts & Ads, and tracks agent replies.

create table if not exists facebook_comments (
  id bigserial primary key,
  comment_id text not null unique,
  post_id text,
  post_name text,
  from_name text not null default 'عميل فيسبوك',
  from_id text,
  message text not null,
  status text not null default 'pending' check (status in ('pending', 'replied', 'ignored')),
  reply_text text,
  replied_at timestamptz,
  replied_by text,
  permalink_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists fb_comments_created_idx on facebook_comments (created_at desc);
create index if not exists fb_comments_status_idx on facebook_comments (status, created_at desc);
create index if not exists fb_comments_post_idx on facebook_comments (post_id);

alter table facebook_comments enable row level security;

-- Admin & Owner read policy
drop policy if exists fb_comments_read on facebook_comments;
create policy fb_comments_read on facebook_comments
  for select to authenticated
  using (true);

-- Admin & Owner update policy
drop policy if exists fb_comments_update on facebook_comments;
create policy fb_comments_update on facebook_comments
  for update to authenticated
  using (true)
  with check (true);

-- Insert policy
drop policy if exists fb_comments_insert on facebook_comments;
create policy fb_comments_insert on facebook_comments
  for insert to authenticated
  with check (true);
