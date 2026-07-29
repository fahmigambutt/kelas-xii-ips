-- XII SOCIAL — migrasi identitas untuk database Supabase yang sudah aktif.
-- Jalankan sekali melalui Supabase Dashboard > SQL Editor.
-- Aman dijalankan ulang karena hanya memakai UPDATE idempoten.

begin;

update public.site_settings
set
  site_name = 'XII SOCIAL — Official Class Website',
  class_name = 'XII SOCIAL',
  welcome_text = 'WELCOME XII SOCIAL',
  description = replace(coalesce(description, ''), 'XII IPS', 'XII SOCIAL'),
  closing_text = replace(coalesce(closing_text, ''), 'XII IPS', 'XII SOCIAL'),
  accent_color = '#e50914',
  theme_color = '#050505';

update public.about
set
  history = replace(coalesce(history, ''), 'XII IPS', 'XII SOCIAL'),
  vision = replace(coalesce(vision, ''), 'XII IPS', 'XII SOCIAL'),
  mission = replace(coalesce(mission, ''), 'XII IPS', 'XII SOCIAL'),
  goals = replace(coalesce(goals, ''), 'XII IPS', 'XII SOCIAL'),
  expectations = replace(coalesce(expectations, ''), 'XII IPS', 'XII SOCIAL'),
  achievements = replace(coalesce(achievements, ''), 'XII IPS', 'XII SOCIAL'),
  quote = replace(coalesce(quote, ''), 'XII IPS', 'XII SOCIAL');

update public.content_labels
set
  about_title = replace(coalesce(about_title, ''), 'XII IPS', 'XII SOCIAL'),
  structure_title = replace(coalesce(structure_title, ''), 'XII IPS', 'XII SOCIAL'),
  members_title = replace(coalesce(members_title, ''), 'XII IPS', 'XII SOCIAL'),
  gallery_title = replace(coalesce(gallery_title, ''), 'XII IPS', 'XII SOCIAL');

update public.structure_members
set description = replace(coalesce(description, ''), 'XII IPS', 'XII SOCIAL')
where description ilike '%XII IPS%';

update public.class_members
set
  bio = replace(coalesce(bio, ''), 'XII IPS', 'XII SOCIAL'),
  quote = replace(coalesce(quote, ''), 'XII IPS', 'XII SOCIAL')
where bio ilike '%XII IPS%' or quote ilike '%XII IPS%';

update public.gallery
set
  title = replace(coalesce(title, ''), 'XII IPS', 'XII SOCIAL'),
  caption = replace(coalesce(caption, ''), 'XII IPS', 'XII SOCIAL')
where title ilike '%XII IPS%' or caption ilike '%XII IPS%';

commit;
