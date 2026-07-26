-- XII IPS Ultra Premium — Seed data
-- Jalankan setelah schema dan policies. URL aset lokal akan tampil setelah deployment.

insert into public.site_settings (
  id, site_name, class_name, welcome_text, motto, generation, description, logo_url,
  closing_text, closing_quote, theme_color, accent_color, loading_enabled, loading_duration
) values (
  '00000000-0000-4000-8000-000000000001',
  'XII IPS — Official Class Website', 'XII IPS', 'WELCOME XII IPS',
  'Bersama tumbuh, bersama mengukir cerita.', 'Angkatan 2026',
  'Ruang digital untuk menyimpan cerita, karya, persahabatan, dan kenangan terbaik keluarga XII IPS.',
  './assets/defaults/default-logo.webp',
  'Terima kasih telah menjadi bagian dari XII IPS.',
  '“Yang selesai hanyalah masa sekolahnya, bukan persahabatannya.”',
  '#08101d', '#6aa9ff', true, 3400
) on conflict (id) do update set
  site_name=excluded.site_name, class_name=excluded.class_name, welcome_text=excluded.welcome_text,
  motto=excluded.motto, generation=excluded.generation, description=excluded.description,
  logo_url=excluded.logo_url, closing_text=excluded.closing_text, closing_quote=excluded.closing_quote;

insert into public.about (id,history,vision,mission,goals,expectations,achievements,quote) values (
  '00000000-0000-4000-8000-000000000002',
  'XII IPS adalah keluarga belajar yang tumbuh melalui kerja sama, keberanian, dan kepedulian.',
  'Menjadi kelas yang solid, berprestasi, berkarakter, dan saling mendukung.',
  'Belajar konsisten, menjaga kekompakan, menghargai perbedaan, dan menciptakan kenangan positif.',
  'Membentuk lingkungan kelas yang aman, produktif, kreatif, dan menyenangkan.',
  'Semoga setiap anggota tumbuh menjadi pribadi yang bermanfaat dan tetap terhubung setelah lulus.',
  'Prestasi akademik, organisasi, olahraga, seni, dan berbagai kontribusi positif di sekolah.',
  '“Kelas bukan hanya tempat belajar, tetapi tempat kita bertumbuh bersama.”'
) on conflict (id) do update set history=excluded.history,vision=excluded.vision,mission=excluded.mission,goals=excluded.goals,expectations=excluded.expectations,achievements=excluded.achievements,quote=excluded.quote;

insert into public.content_labels (id,about_title,structure_title,members_title,gallery_title) values
('00000000-0000-4000-8000-000000000004','Tentang XII IPS','Struktur Organisasi XII IPS','Anggota XII IPS','Galeri Kenangan')
on conflict (id) do update set about_title=excluded.about_title,structure_title=excluded.structure_title,members_title=excluded.members_title,gallery_title=excluded.gallery_title;

insert into public.background_settings (id,image_url,blur,brightness,overlay,position,scale) values
('00000000-0000-4000-8000-000000000003','./assets/defaults/default-background.webp',16,65,35,'center',108)
on conflict (id) do update set image_url=excluded.image_url,blur=excluded.blur,brightness=excluded.brightness,overlay=excluded.overlay,position=excluded.position,scale=excluded.scale;

delete from public.structure_members where name like 'Pengurus %' or name='Nama Wali Kelas';
insert into public.structure_members(name,position,description,photo_url,sort_order) values
('Nama Wali Kelas','Wali Kelas','Pembimbing dan pengarah keluarga XII IPS.','./assets/defaults/default-avatar.webp',1),
('Pengurus 01','Ketua Kelas','Mengkoordinasikan kegiatan dan komunikasi kelas.','./assets/defaults/default-avatar.webp',2),
('Pengurus 02','Wakil Ketua','Mendampingi ketua dan menjaga koordinasi.','./assets/defaults/default-avatar.webp',3),
('Pengurus 03','Sekretaris 1','Mengelola administrasi dan catatan kelas.','./assets/defaults/default-avatar.webp',4),
('Pengurus 04','Sekretaris 2','Mendukung administrasi dan dokumentasi.','./assets/defaults/default-avatar.webp',5),
('Pengurus 05','Bendahara 1','Mengelola keuangan kelas secara transparan.','./assets/defaults/default-avatar.webp',6),
('Pengurus 06','Bendahara 2','Mendukung pencatatan dan laporan keuangan.','./assets/defaults/default-avatar.webp',7),
('Pengurus 07','Koordinator Kebersihan','Menjaga kebersihan dan kenyamanan ruang kelas.','./assets/defaults/default-avatar.webp',8),
('Pengurus 08','Koordinator Keamanan','Mendukung ketertiban dan keamanan kelas.','./assets/defaults/default-avatar.webp',9),
('Pengurus 09','Koordinator Dokumentasi','Menyimpan dokumentasi kegiatan dan kenangan.','./assets/defaults/default-avatar.webp',10),
('Pengurus 10','Koordinator Peralatan','Mengatur kesiapan perlengkapan kelas.','./assets/defaults/default-avatar.webp',11);

delete from public.class_members where full_name ~ '^Anggota [0-9]{2}$';
insert into public.class_members(attendance_number,full_name,birth_place,instagram,bio,hobbies,ambition,quote,photo_url)
select n,
  'Anggota ' || lpad(n::text,2,'0'),
  'Kota Kelahiran',
  'anggota' || lpad(n::text,2,'0'),
  'Salah satu bagian penting dari keluarga XII IPS.',
  'Belajar, musik, dan olahraga',
  'Meraih masa depan terbaik',
  'Terus bertumbuh dan jangan takut mencoba.',
  './assets/defaults/default-avatar.webp'
from generate_series(1,30) as n
on conflict (attendance_number) do update set full_name=excluded.full_name;

delete from public.gallery where caption like 'Dokumentasi awal kategori%';
insert into public.gallery(title,caption,category,event_date,image_url,sort_order) values
('Study Tour','Dokumentasi awal kategori Study Tour.','Study Tour',null,'./assets/placeholders/gallery-placeholder.webp',1),
('Class Meeting','Dokumentasi awal kategori Class Meeting.','Class Meeting',null,'./assets/defaults/default-background.webp',2),
('17 Agustus','Dokumentasi awal kategori 17 Agustus.','17 Agustus',null,'./assets/placeholders/gallery-placeholder.webp',3),
('Pentas Seni','Dokumentasi awal kategori Pentas Seni.','Pentas Seni',null,'./assets/defaults/default-background.webp',4),
('Bukber','Dokumentasi awal kategori Bukber.','Bukber',null,'./assets/placeholders/gallery-placeholder.webp',5),
('Perpisahan','Dokumentasi awal kategori Perpisahan.','Perpisahan',null,'./assets/defaults/default-background.webp',6),
('Kegiatan Sekolah','Dokumentasi awal kategori Kegiatan Sekolah.','Kegiatan Sekolah',null,'./assets/placeholders/gallery-placeholder.webp',7),
('Random Moment','Dokumentasi awal kategori Random Moment.','Random Moment',null,'./assets/defaults/default-background.webp',8);
