-- Company legal / registration papers for the owner dashboard.
-- Private bucket + owner-only RLS (not public like payment proofs).

create table if not exists company_documents (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  category     text not null default 'عام',
  file_name    text not null,
  storage_path text not null unique,
  mime_type    text,
  file_size    bigint,
  notes        text,
  uploaded_by  uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now()
);

create index if not exists company_documents_created_idx
  on company_documents (created_at desc);

alter table company_documents enable row level security;

drop policy if exists company_documents_owner_all on company_documents;
create policy company_documents_owner_all on company_documents
  for all to authenticated
  using (is_owner())
  with check (is_owner());

-- Private bucket — files only via signed URLs / authenticated Storage API
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'company-docs',
  'company-docs',
  false,
  52428800, -- 50 MB
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/zip',
    'application/x-zip-compressed'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists company_docs_owner_select on storage.objects;
create policy company_docs_owner_select on storage.objects
  for select to authenticated
  using (bucket_id = 'company-docs' and is_owner());

drop policy if exists company_docs_owner_insert on storage.objects;
create policy company_docs_owner_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'company-docs' and is_owner());

drop policy if exists company_docs_owner_update on storage.objects;
create policy company_docs_owner_update on storage.objects
  for update to authenticated
  using (bucket_id = 'company-docs' and is_owner())
  with check (bucket_id = 'company-docs' and is_owner());

drop policy if exists company_docs_owner_delete on storage.objects;
create policy company_docs_owner_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'company-docs' and is_owner());
