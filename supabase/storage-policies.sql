-- XII IPS Ultra Premium — Storage buckets dan policies
-- Jalankan setelah schema.sql dan policies.sql.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('backgrounds','backgrounds',true,10485760,array['image/jpeg','image/png','image/webp']),
  ('logos','logos',true,5242880,array['image/jpeg','image/png','image/webp']),
  ('members','members',true,10485760,array['image/jpeg','image/png','image/webp']),
  ('structure','structure',true,10485760,array['image/jpeg','image/png','image/webp']),
  ('gallery','gallery',true,10485760,array['image/jpeg','image/png','image/webp']),
  ('audio','audio',true,20971520,array['audio/mpeg'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname='storage' and tablename='objects' and policyname like 'xii_ips_%' loop
    execute format('drop policy if exists %I on storage.objects', p.policyname);
  end loop;
end $$;

create policy xii_ips_public_read
on storage.objects for select
to anon, authenticated
using (bucket_id in ('backgrounds','logos','members','structure','gallery','audio'));

create policy xii_ips_editor_upload
on storage.objects for insert
to authenticated
with check (
  bucket_id in ('backgrounds','logos','members','structure','gallery','audio')
  and (select private.can_edit())
  and name !~ '(^|/)\.\.'
  and name !~* '\.(exe|js|html?|php|sh|svg)$'
);

create policy xii_ips_editor_update
on storage.objects for update
to authenticated
using (bucket_id in ('backgrounds','logos','members','structure','gallery','audio') and (select private.can_edit()))
with check (
  bucket_id in ('backgrounds','logos','members','structure','gallery','audio')
  and (select private.can_edit())
  and name !~ '(^|/)\.\.'
  and name !~* '\.(exe|js|html?|php|sh|svg)$'
);

create policy xii_ips_editor_delete
on storage.objects for delete
to authenticated
using (bucket_id in ('backgrounds','logos','members','structure','gallery','audio') and (select private.can_edit()));
