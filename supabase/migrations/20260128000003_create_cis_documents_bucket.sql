-- Create storage bucket for CIS documents
insert into storage.buckets (id, name, public)
values ('cis-documents', 'cis-documents', false)
on conflict (id) do nothing;

-- Storage RLS policies for cis-documents bucket
drop policy if exists "Allow authenticated uploads to cis-documents" on storage.objects;
create policy "Allow authenticated uploads to cis-documents"
  on storage.objects for insert
  with check (
    bucket_id = 'cis-documents'
    and auth.uid() is not null
  );

drop policy if exists "Allow authenticated reads from cis-documents" on storage.objects;
create policy "Allow authenticated reads from cis-documents"
  on storage.objects for select
  using (
    bucket_id = 'cis-documents'
    and auth.uid() is not null
  );

drop policy if exists "Allow authenticated updates to cis-documents" on storage.objects;
create policy "Allow authenticated updates to cis-documents"
  on storage.objects for update
  using (
    bucket_id = 'cis-documents'
    and auth.uid() is not null
  )
  with check (
    bucket_id = 'cis-documents'
    and auth.uid() is not null
  );

drop policy if exists "Allow authenticated deletes from cis-documents" on storage.objects;
create policy "Allow authenticated deletes from cis-documents"
  on storage.objects for delete
  using (
    bucket_id = 'cis-documents'
    and auth.uid() is not null
  );
