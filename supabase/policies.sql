-- XII IPS Ultra Premium — RLS policies
-- Jalankan setelah schema.sql.

alter table public.site_settings enable row level security;
alter table public.about enable row level security;
alter table public.content_labels enable row level security;
alter table public.background_settings enable row level security;
alter table public.structure_members enable row level security;
alter table public.class_members enable row level security;
alter table public.gallery enable row level security;
alter table public.profiles enable row level security;
alter table public.audit_logs enable row level security;

-- Hapus policy lama agar file aman dijalankan ulang.
do $$
declare p record;
begin
  for p in select schemaname, tablename, policyname from pg_policies where schemaname='public' and tablename in ('site_settings','about','content_labels','background_settings','structure_members','class_members','gallery','profiles','audit_logs') loop
    execute format('drop policy if exists %I on %I.%I', p.policyname, p.schemaname, p.tablename);
  end loop;
end $$;

-- Konten publik dapat dibaca tanpa login.
create policy public_read_site on public.site_settings for select to anon, authenticated using (true);
create policy public_read_about on public.about for select to anon, authenticated using (true);
create policy public_read_labels on public.content_labels for select to anon, authenticated using (true);
create policy public_read_background on public.background_settings for select to anon, authenticated using (true);
create policy public_read_structure on public.structure_members for select to anon, authenticated using (true);
create policy public_read_members on public.class_members for select to anon, authenticated using (true);
create policy public_read_gallery on public.gallery for select to anon, authenticated using (true);

-- Editor aktif dan Super Admin aktif dapat mengelola konten.
create policy editor_insert_site on public.site_settings for insert to authenticated with check ((select private.can_edit()));
create policy editor_update_site on public.site_settings for update to authenticated using ((select private.can_edit())) with check ((select private.can_edit()));
create policy editor_delete_site on public.site_settings for delete to authenticated using ((select private.can_edit()));

create policy editor_insert_about on public.about for insert to authenticated with check ((select private.can_edit()));
create policy editor_update_about on public.about for update to authenticated using ((select private.can_edit())) with check ((select private.can_edit()));
create policy editor_delete_about on public.about for delete to authenticated using ((select private.can_edit()));

create policy editor_insert_labels on public.content_labels for insert to authenticated with check ((select private.can_edit()));
create policy editor_update_labels on public.content_labels for update to authenticated using ((select private.can_edit())) with check ((select private.can_edit()));
create policy editor_delete_labels on public.content_labels for delete to authenticated using ((select private.can_edit()));

create policy editor_insert_background on public.background_settings for insert to authenticated with check ((select private.can_edit()));
create policy editor_update_background on public.background_settings for update to authenticated using ((select private.can_edit())) with check ((select private.can_edit()));
create policy editor_delete_background on public.background_settings for delete to authenticated using ((select private.can_edit()));

create policy editor_insert_structure on public.structure_members for insert to authenticated with check ((select private.can_edit()));
create policy editor_update_structure on public.structure_members for update to authenticated using ((select private.can_edit())) with check ((select private.can_edit()));
create policy editor_delete_structure on public.structure_members for delete to authenticated using ((select private.can_edit()));

create policy editor_insert_members on public.class_members for insert to authenticated with check ((select private.can_edit()));
create policy editor_update_members on public.class_members for update to authenticated using ((select private.can_edit())) with check ((select private.can_edit()));
create policy editor_delete_members on public.class_members for delete to authenticated using ((select private.can_edit()));

create policy editor_insert_gallery on public.gallery for insert to authenticated with check ((select private.can_edit()));
create policy editor_update_gallery on public.gallery for update to authenticated using ((select private.can_edit())) with check ((select private.can_edit()));
create policy editor_delete_gallery on public.gallery for delete to authenticated using ((select private.can_edit()));

-- Profil: pengguna hanya membaca profil sendiri; Super Admin membaca seluruh profil.
create policy profile_read_self_or_admin on public.profiles for select to authenticated
using ((select auth.uid()) = id or (select private.is_super_admin()));
-- Tidak ada policy INSERT/UPDATE/DELETE langsung untuk profiles.
-- Perubahan nama sendiri memakai RPC terbatas; pengelolaan akun memakai serverless function + service role.

-- Audit hanya dapat dibaca Super Admin. Insert dilakukan trigger / service role / RPC terkontrol.
create policy audit_read_super_admin on public.audit_logs for select to authenticated using ((select private.is_super_admin()));

-- Grants eksplisit.
grant select on public.site_settings, public.about, public.content_labels, public.background_settings, public.structure_members, public.class_members, public.gallery to anon, authenticated;
grant insert, update, delete on public.site_settings, public.about, public.content_labels, public.background_settings, public.structure_members, public.class_members, public.gallery to authenticated;
grant select on public.profiles, public.audit_logs to authenticated;
grant usage, select on sequence public.audit_logs_id_seq to authenticated;
