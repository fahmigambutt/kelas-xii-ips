-- XII SOCIAL Ultra Premium — Database schema
-- Jalankan lebih dahulu melalui Supabase SQL Editor.

create extension if not exists pgcrypto;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create table if not exists public.site_settings (
  id uuid primary key default gen_random_uuid(),
  site_name text not null default 'XII SOCIAL — Official Class Website',
  class_name text not null default 'XII SOCIAL',
  welcome_text text not null default 'WELCOME XII SOCIAL',
  motto text not null default 'Bersama tumbuh, bersama mengukir cerita.',
  generation text not null default 'Angkatan 2026',
  description text not null default '',
  logo_url text,
  closing_text text not null default 'Terima kasih telah menjadi bagian dari XII SOCIAL.',
  closing_quote text not null default 'Yang selesai hanyalah masa sekolahnya, bukan persahabatannya.',
  theme_color text not null default '#08101d' check (theme_color ~ '^#[0-9A-Fa-f]{6}$'),
  accent_color text not null default '#6aa9ff' check (accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  animation_duration integer not null default 700 check (animation_duration between 0 and 2000),
  loading_enabled boolean not null default true,
  loading_duration integer not null default 3400 check (loading_duration between 800 and 7000),
  music_enabled boolean not null default false,
  audio_url text,
  music_volume numeric(3,2) not null default .35 check (music_volume between 0 and 1),
  parallax_enabled boolean not null default true,
  particles_enabled boolean not null default true,
  mouse_light_enabled boolean not null default true,
  reveal_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

create table if not exists public.about (
  id uuid primary key default gen_random_uuid(),
  history text not null default '',
  vision text not null default '',
  mission text not null default '',
  goals text not null default '',
  expectations text not null default '',
  achievements text not null default '',
  quote text not null default '',
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

create table if not exists public.content_labels (
  id uuid primary key default gen_random_uuid(),
  about_title text not null default 'Tentang XII SOCIAL',
  structure_title text not null default 'Struktur Organisasi XII SOCIAL',
  members_title text not null default 'Anggota XII SOCIAL',
  gallery_title text not null default 'Galeri Kenangan',
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

create table if not exists public.background_settings (
  id uuid primary key default gen_random_uuid(),
  image_url text,
  blur integer not null default 16 check (blur between 0 and 32),
  brightness integer not null default 65 check (brightness between 20 and 100),
  overlay integer not null default 35 check (overlay between 0 and 90),
  position text not null default 'center' check (position in ('center','top','bottom','left','right')),
  scale integer not null default 108 check (scale between 100 and 130),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

create table if not exists public.structure_members (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  position text not null check (char_length(position) between 1 and 100),
  description text not null default '' check (char_length(description) <= 500),
  photo_url text,
  sort_order integer not null default 1 check (sort_order > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

create table if not exists public.class_members (
  id uuid primary key default gen_random_uuid(),
  attendance_number integer not null unique check (attendance_number > 0),
  full_name text not null check (char_length(full_name) between 1 and 150),
  birth_place text not null default '' check (char_length(birth_place) <= 120),
  birth_date date,
  instagram text not null default '' check (char_length(instagram) <= 100),
  bio text not null default '' check (char_length(bio) <= 1500),
  hobbies text not null default '' check (char_length(hobbies) <= 800),
  ambition text not null default '' check (char_length(ambition) <= 800),
  quote text not null default '' check (char_length(quote) <= 1000),
  position text not null default '' check (char_length(position) <= 100),
  photo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

create table if not exists public.gallery (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 160),
  caption text not null default '' check (char_length(caption) <= 1500),
  category text not null check (category in ('Study Tour','Class Meeting','17 Agustus','Pentas Seni','Bukber','Perpisahan','Kegiatan Sekolah','Random Moment')),
  event_date date,
  image_url text not null,
  sort_order integer not null default 1 check (sort_order > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 100),
  email text not null unique,
  role text not null default 'editor' check (role in ('editor','super_admin')),
  is_active boolean not null default true,
  must_change_password boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  last_login_at timestamptz
);

create table if not exists public.audit_logs (
  id bigint generated by default as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  user_name text,
  action text not null,
  entity_type text,
  entity_id text,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_structure_sort on public.structure_members(sort_order);
create index if not exists idx_members_attendance on public.class_members(attendance_number);
create index if not exists idx_gallery_sort on public.gallery(sort_order);
create index if not exists idx_gallery_category on public.gallery(category);
create index if not exists idx_profiles_role_active on public.profiles(role, is_active);
create index if not exists idx_audit_created on public.audit_logs(created_at desc);
create index if not exists idx_audit_user on public.audit_logs(user_id);

create or replace function private.current_role()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select role from public.profiles
  where id = (select auth.uid()) and is_active = true
  limit 1;
$$;

create or replace function private.can_edit()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((select private.current_role()) in ('editor','super_admin'), false);
$$;

create or replace function private.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((select private.current_role()) = 'super_admin', false);
$$;

revoke all on function private.current_role() from public;
revoke all on function private.can_edit() from public;
revoke all on function private.is_super_admin() from public;
grant execute on function private.current_role() to authenticated;
grant execute on function private.can_edit() to authenticated;
grant execute on function private.is_super_admin() to authenticated;

create or replace function public.set_updated_fields()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  if auth.uid() is not null then new.updated_by = auth.uid(); end if;
  return new;
end;
$$;

create or replace function public.set_profile_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$ begin new.updated_at = now(); return new; end; $$;

create or replace function private.audit_content_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  actor_name text;
  row_id text;
  old_json jsonb;
  new_json jsonb;
begin
  if actor_id is null then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;
  select coalesce(full_name, email) into actor_name from public.profiles where id = actor_id;
  if tg_op in ('UPDATE','DELETE') then old_json := to_jsonb(old); end if;
  if tg_op in ('INSERT','UPDATE') then new_json := to_jsonb(new); end if;
  row_id := coalesce(new_json->>'id', old_json->>'id');
  insert into public.audit_logs(user_id, user_name, action, entity_type, entity_id, old_data, new_data)
  values(actor_id, actor_name, lower(tg_op) || '_' || tg_table_name, tg_table_name, row_id, old_json, new_json);
  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles(id, full_name, email, role, is_active, must_change_password)
  values(new.id, coalesce(new.raw_user_meta_data->>'full_name',''), coalesce(new.email,''), 'editor', true, false)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_auth_user();

create or replace function public.record_client_activity(p_action text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := (select auth.uid());
  actor_name text;
begin
  if actor_id is null then raise exception 'Not authenticated'; end if;
  if p_action not in ('login','logout') then raise exception 'Invalid action'; end if;
  select coalesce(full_name,email) into actor_name from public.profiles where id=actor_id and is_active=true;
  if actor_name is null then raise exception 'Inactive profile'; end if;
  if p_action='login' then update public.profiles set last_login_at=now(),updated_at=now() where id=actor_id; end if;
  insert into public.audit_logs(user_id,user_name,action,entity_type,entity_id) values(actor_id,actor_name,p_action,'auth',actor_id::text);
end;
$$;

create or replace function public.mark_password_changed()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if (select auth.uid()) is null then raise exception 'Not authenticated'; end if;
  update public.profiles set must_change_password=false,updated_at=now() where id=(select auth.uid()) and is_active=true;
end;
$$;

create or replace function public.update_own_profile_name(p_full_name text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if (select auth.uid()) is null then raise exception 'Not authenticated'; end if;
  if char_length(trim(p_full_name)) not between 2 and 100 then raise exception 'Invalid name'; end if;
  update public.profiles set full_name=trim(p_full_name),updated_at=now() where id=(select auth.uid()) and is_active=true;
end;
$$;

revoke all on function public.record_client_activity(text) from public;
revoke all on function public.mark_password_changed() from public;
revoke all on function public.update_own_profile_name(text) from public;
grant execute on function public.record_client_activity(text) to authenticated;
grant execute on function public.mark_password_changed() to authenticated;
grant execute on function public.update_own_profile_name(text) to authenticated;

-- Updated-at triggers
create or replace trigger trg_site_updated before update on public.site_settings for each row execute function public.set_updated_fields();
create or replace trigger trg_about_updated before update on public.about for each row execute function public.set_updated_fields();
create or replace trigger trg_labels_updated before update on public.content_labels for each row execute function public.set_updated_fields();
create or replace trigger trg_background_updated before update on public.background_settings for each row execute function public.set_updated_fields();
create or replace trigger trg_structure_updated before update on public.structure_members for each row execute function public.set_updated_fields();
create or replace trigger trg_members_updated before update on public.class_members for each row execute function public.set_updated_fields();
create or replace trigger trg_gallery_updated before update on public.gallery for each row execute function public.set_updated_fields();
create or replace trigger trg_profiles_updated before update on public.profiles for each row execute function public.set_profile_updated_at();

-- Audit triggers for content
create or replace trigger audit_site after insert or update or delete on public.site_settings for each row execute function private.audit_content_change();
create or replace trigger audit_about after insert or update or delete on public.about for each row execute function private.audit_content_change();
create or replace trigger audit_labels after insert or update or delete on public.content_labels for each row execute function private.audit_content_change();
create or replace trigger audit_background after insert or update or delete on public.background_settings for each row execute function private.audit_content_change();
create or replace trigger audit_structure after insert or update or delete on public.structure_members for each row execute function private.audit_content_change();
create or replace trigger audit_members after insert or update or delete on public.class_members for each row execute function private.audit_content_change();
create or replace trigger audit_gallery after insert or update or delete on public.gallery for each row execute function private.audit_content_change();

-- Realtime publication. Abaikan error duplicate jika tabel sudah ditambahkan.
do $$
begin
  alter publication supabase_realtime add table public.site_settings, public.about, public.content_labels, public.background_settings, public.structure_members, public.class_members, public.gallery;
exception when duplicate_object then null;
end $$;
