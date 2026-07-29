# XII SOCIAL — Ultra Premium Official Class Website

Website resmi kelas XII SOCIAL berbasis HTML, CSS, dan JavaScript ES Modules tanpa framework frontend. Proyek ini menyediakan tampilan Apple-inspired Liquid Glass, navigasi natural tanpa scroll snap, profil kelas, struktur, anggota, galeri, editor langsung pada website utama, autentikasi Supabase, database PostgreSQL, Storage, Realtime, audit log, dan pengelolaan akun melalui Vercel Functions.

> Tidak ada route `/admin`. Semua pengeditan dilakukan pada halaman utama setelah pengguna login dan mengaktifkan **Mode Edit**.

## 1. Deskripsi Website

Fitur utama:

- Website publik dapat dibuka tanpa login.
- Role `editor` dan `super_admin` dapat mengaktifkan Mode Edit.
- Super Admin dapat mengelola pengguna dan audit melalui modal di halaman utama.
- Draft disimpan ke LocalStorage, dengan undo/redo maksimal 20 snapshot.
- Upload gambar dikompres dan dikonversi ke WebP melalui Canvas API.
- Data tersimpan di Supabase PostgreSQL dan gambar/audio di Supabase Storage.
- Sinkronisasi antardevice memakai Supabase Realtime dan refetch.
- Server-side account administration memakai Service Role Key hanya pada `/api`.
- Mobile-first, target sentuh minimal 44 px, modal bottom-sheet pada HP, dan safe-area support.

## 2. Struktur Folder

```text
/
├── index.html
├── style.css
├── script.js
├── config.js
├── auth.js
├── data.js
├── editor.js
├── storage.js
├── ui.js
├── vercel.json
├── package.json
├── .gitignore
├── .env.example
├── README.md
├── assets/
│   ├── defaults/
│   ├── icons/
│   └── placeholders/
├── api/
│   ├── _shared.js
│   ├── config.js
│   ├── users/
│   └── audit/
├── scripts/
│   └── check-project.mjs
└── supabase/
    ├── schema.sql
    ├── policies.sql
    ├── storage-policies.sql
    └── seed.sql
```

## 3. Membuat Proyek Supabase

1. Masuk ke Supabase Dashboard.
2. Pilih **New project**.
3. Tentukan organisasi, nama proyek, password database yang kuat, dan region terdekat.
4. Setelah proyek aktif, buka **Project Settings → API**.
5. Salin:
   - Project URL sebagai `SUPABASE_URL`.
   - Anon/public key sebagai `SUPABASE_ANON_KEY`.
   - Service role key sebagai `SUPABASE_SERVICE_ROLE_KEY`.
6. Jangan pernah memasukkan Service Role Key ke browser, source frontend, atau repository.

## 4. Menjalankan `schema.sql`

1. Buka **SQL Editor** di Supabase.
2. Buat query baru.
3. Salin seluruh isi `supabase/schema.sql`.
4. Jalankan query.
5. Pastikan tabel, trigger, fungsi keamanan, dan publication Realtime terbentuk.

Schema menambahkan tabel:

- `site_settings`
- `about`
- `content_labels`
- `background_settings`
- `structure_members`
- `class_members`
- `gallery`
- `profiles`
- `audit_logs`

## 5. Menjalankan `policies.sql`

1. Buka query baru pada SQL Editor.
2. Salin isi `supabase/policies.sql`.
3. Jalankan.
4. Buka **Database → Tables** dan pastikan RLS aktif pada seluruh tabel publik.

Kebijakan intinya:

- `anon`: hanya SELECT konten publik.
- Editor aktif: CRUD konten.
- Super Admin aktif: CRUD konten dan akses melalui API pengelolaan akun.
- Profiles tidak dapat diubah langsung dari browser.
- Audit log hanya dapat dibaca Super Admin.

## 6. Menjalankan `storage-policies.sql`

1. Buka query baru.
2. Salin isi `supabase/storage-policies.sql`.
3. Jalankan.
4. Script akan membuat bucket publik dan Storage Policies.

## 7. Membuat Bucket Storage

Script Storage membuat bucket berikut otomatis:

- `backgrounds`
- `logos`
- `members`
- `structure`
- `gallery`
- `audio`

Jika bucket tidak muncul, buat manual melalui **Storage → New bucket**, gunakan nama persis seperti di atas, jadikan public, lalu jalankan ulang `storage-policies.sql`.

Batas default:

- Gambar: 5–10 MB tergantung bucket.
- Audio MP3: 20 MB.
- Tipe executable, HTML, JavaScript, PHP, shell, dan SVG ditolak oleh kebijakan nama file.

## 8. Menjalankan `seed.sql`

1. Buka query baru.
2. Salin isi `supabase/seed.sql`.
3. Jalankan.

Seed berisi:

- 1 profil website.
- 1 pengaturan background.
- 1 bagian Tentang.
- 1 kumpulan label section.
- 11 struktur kelas.
- 30 anggota `Anggota 01` hingga `Anggota 30`.
- 8 placeholder galeri untuk semua kategori.

URL aset seed masih menunjuk ke aset lokal proyek. Setelah website aktif, Super Admin dapat mengganti semua aset melalui Mode Edit agar file tersimpan di Storage.

## 9. Membuat Super Admin Pertama

Super Admin pertama harus dibuat melalui Supabase Dashboard, bukan hardcoded.

1. Buka **Authentication → Users**.
2. Klik **Add user → Create new user**.
3. Masukkan email dan password kuat.
4. Centang email confirmed jika sesuai kebutuhan.
5. Salin UUID pengguna.
6. Trigger `handle_new_auth_user` akan membuat profil default sebagai Editor.
7. Jalankan SQL berikut dengan UUID dan email sebenarnya:

```sql
update public.profiles
set
  full_name = 'Super Admin XII SOCIAL',
  email = 'EMAIL_ADMIN_SEBENARNYA',
  role = 'super_admin',
  is_active = true,
  must_change_password = true,
  updated_at = now()
where id = 'UUID_AUTH_USER';
```

8. Opsional, sinkronkan app metadata melalui server setelah deployment atau gunakan dashboard Auth metadata. Otorisasi utama tetap membaca tabel `profiles`, bukan metadata frontend.
9. Login ke website dan ganti password ketika modal wajib muncul.

Contoh email/password dalam brief hanyalah dokumentasi. Jangan gunakan password contoh untuk production.

## 10. Mengisi Environment Variables

Buat `.env.local` untuk pengembangan lokal:

```env
SUPABASE_URL=https://PROJECT_ID.supabase.co
SUPABASE_ANON_KEY=ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=SERVICE_ROLE_KEY
```

Aturan:

- `SUPABASE_URL`: dipakai frontend dan server.
- `SUPABASE_ANON_KEY`: aman dipublikasikan untuk browser selama RLS aktif.
- `SUPABASE_SERVICE_ROLE_KEY`: hanya dibaca Vercel Functions.
- Endpoint `/api/config` hanya mengirim URL dan anon key. Service Role Key tidak pernah dikirim.

## 11. Menjalankan Secara Lokal

Prasyarat: Node.js 20 atau lebih baru.

```bash
npm install
cp .env.example .env.local
# isi .env.local
npm run check
npm run dev
```

Buka alamat yang ditampilkan Vercel CLI, biasanya `http://localhost:3000`.

Tanpa environment variables, website tetap terbuka dalam **mode demo lokal**, tetapi login, upload, dan penyimpanan online tidak aktif.

Jangan membuka `index.html` langsung dengan skema `file://` karena ES Modules dan endpoint API membutuhkan HTTP server.

## 12. Upload ke GitHub

```bash
git init
git add .
git commit -m "Initial XII SOCIAL website"
git branch -M main
git remote add origin https://github.com/USERNAME/NAMA-REPOSITORY.git
git push -u origin main
```

Sebelum push:

```bash
git status
npm run check
```

Pastikan `.env`, `.env.local`, `.vercel`, dan `node_modules` tidak ikut terunggah.

## 13. Deploy ke Vercel

1. Masuk ke Vercel.
2. Klik **Add New → Project**.
3. Import repository GitHub.
4. Gunakan konfigurasi:
   - Framework Preset: **Other**.
   - Root Directory: `./`.
   - Build Command: biarkan terdeteksi dari `vercel-build`, yaitu `npm run check`.
   - Output Directory: kosong/root.
5. Tambahkan tiga environment variables.
6. Deploy.
7. Tambahkan URL production pada Supabase:
   - **Authentication → URL Configuration → Site URL**.
   - Tambahkan URL production dan preview yang diperlukan ke Redirect URLs.
8. Setiap push ke `main` akan memicu deployment production baru jika branch production Vercel adalah `main`.

## 14. Cara Login

1. Buka bagian Penutup.
2. Tekan **Login Pengelola**.
3. Isi email dan password.
4. Setelah berhasil, avatar, nama, role, tombol **Edit Website**, dan tombol keluar muncul.
5. Website tetap dalam tampilan pengunjung sampai tombol **Edit Website** ditekan.

## 15. Mengaktifkan Mode Edit

1. Login sebagai Editor atau Super Admin aktif.
2. Pastikan kewajiban ganti password sudah selesai.
3. Tekan **Edit Website** pada Home.
4. Posisi scroll tidak berubah.
5. Outline biru muncul pada konten yang dapat diedit.
6. Toolbar muncul di bawah. Pada HP toolbar berada di atas bottom navigation.

## 16. Mengedit Teks

1. Aktifkan Mode Edit.
2. Tekan teks yang memiliki outline.
3. Edit melalui input atau textarea pada bottom sheet/modal.
4. Tekan **Terapkan**.
5. Perubahan masuk ke draft dan live preview.
6. Tekan **Simpan** pada toolbar untuk mengirim ke Supabase.

`contenteditable` tidak digunakan sebagai satu-satunya editor sehingga pengisian di HP lebih stabil.

## 17. Mengganti Foto

- Logo: tekan tombol **Ganti Logo** di atas logo.
- Struktur/anggota: tekan **Ganti Foto** pada card.
- Background: buka **Pengaturan → Ganti Background**.
- Galeri: gunakan **Upload Banyak Foto**.

Sebelum upload, browser akan:

1. Memvalidasi MIME dan ukuran.
2. Membuka file dari galeri HP melalui input file.
3. Mengompres dimensi.
4. Mengonversi ke WebP.
5. Mengunggah ke path unik.
6. Menyimpan URL ke draft database.

## 18. Menambah Anggota

1. Aktifkan Mode Edit.
2. Buka section Anggota.
3. Tekan **Tambah Anggota**.
4. Isi nomor absen dan data profil.
5. Tekan **Simpan Draft**.
6. Pastikan nomor absen tidak duplikat.
7. Tekan **Simpan** pada toolbar.

Total anggota dan urutan nomor absen diperbarui otomatis.

## 19. Mengelola Struktur

Pada setiap card tersedia:

- Edit.
- Ganti Foto.
- Naik.
- Turun.
- Hapus.

Tombol **Tambah Struktur** tersedia di atas grid. Urutan disimpan melalui `sort_order`.

## 20. Mengelola Galeri

- Upload banyak foto melalui galeri HP.
- Ubah judul, caption, kategori, tanggal, dan urutan.
- Hapus foto melalui tombol card.
- Filter kategori tetap berfungsi pada mode pengunjung.
- Lightbox mendukung previous, next, keyboard panah, zoom sederhana, dan swipe horizontal khusus area foto.

## 21. Membuat Akun Editor

1. Login sebagai Super Admin.
2. Aktifkan Mode Edit.
3. Tekan **Pengguna** pada toolbar.
4. Tekan **Buat Akun Baru**.
5. Isi nama, email, dan role Editor.
6. Pilih metode:
   - Undangan email: metode utama.
   - Password sementara: minimal 10 karakter dan `must_change_password=true`.
7. Endpoint `/api/users/create` memverifikasi access token dan role Super Admin sebelum memakai Service Role Key.

## 22. Menonaktifkan Akun

1. Buka **Kelola Pengguna**.
2. Tekan **Nonaktifkan**.
3. Server memeriksa bahwa target bukan akun sendiri dan bukan satu-satunya Super Admin aktif.
4. Supabase Auth akan diberi ban berdurasi panjang dan `profiles.is_active` menjadi false.
5. RLS juga menolak akses edit meskipun token lama masih tersisa sesaat.

## 23. Mengubah Password

- Pengguna login: buka menu akun → **Ubah Password**.
- Lupa password: pada modal login, isi email lalu tekan **Lupa password**.
- Password sementara: pengguna wajib mengganti password sebelum Mode Edit dapat digunakan.

Atur Site URL dan Redirect URLs Supabase dengan benar agar tautan recovery kembali ke website.

## 24. Backup Database

Opsi sederhana:

- Gunakan fitur backup Supabase sesuai paket proyek.
- Ekspor tabel penting melalui Table Editor.
- Gunakan Supabase CLI/PostgreSQL `pg_dump` dengan connection string database yang disimpan secara aman.

Contoh konseptual:

```bash
pg_dump "POSTGRES_CONNECTION_STRING" --format=custom --file=xii-ips.backup
```

Jangan menyimpan connection string ke GitHub.

Untuk file Storage, simpan inventaris bucket dan lakukan salinan objek secara berkala jika dokumentasi kelas dianggap arsip permanen.

## 25. Restore Database

Gunakan lingkungan kosong atau backup proyek terlebih dahulu.

```bash
pg_restore --clean --if-exists --no-owner --dbname="POSTGRES_CONNECTION_STRING" xii-ips.backup
```

Setelah restore:

1. Jalankan ulang `policies.sql` bila perlu.
2. Periksa bucket dan Storage Policies.
3. Periksa Auth users dan relasi `profiles`.
4. Uji akun Super Admin.
5. Uji SELECT publik dan penolakan UPDATE anonim.

## 26. Mengatasi RLS Error

Gejala: pesan `new row violates row-level security policy` atau data tidak dapat disimpan.

Periksa:

1. Pengguna sudah login.
2. Row `profiles` tersedia untuk UUID Auth yang sama.
3. `role` bernilai `editor` atau `super_admin`.
4. `is_active=true`.
5. `policies.sql` sudah dijalankan setelah `schema.sql`.
6. Fungsi `private.can_edit()` tersedia dan memiliki execute grant untuk authenticated.
7. Jangan memakai Service Role Key pada frontend untuk “memperbaiki” RLS.

Query diagnosis:

```sql
select id, email, role, is_active, must_change_password
from public.profiles
order by created_at desc;
```

## 27. Mengatasi Upload Gagal

Periksa:

- Bucket ada dan namanya benar.
- `storage-policies.sql` sudah dijalankan.
- Akun aktif dan memiliki role editor/admin.
- File JPG/JPEG/PNG/WebP, atau MP3 untuk audio.
- Ukuran file tidak melebihi batas.
- Browser mendukung Canvas dan `createImageBitmap`.
- Koneksi tidak terputus.
- URL project dan anon key benar.

Jika file terunggah tetapi penyimpanan database gagal, editor mempertahankan draft. File baru yang dibatalkan dalam sesi normal akan dicoba dihapus. Untuk orphan file akibat browser ditutup paksa, lakukan pembersihan manual berkala berdasarkan objek yang tidak direferensikan database.

## 28. Mengatasi Cache

File utama memakai query version:

```html
style.css?v=1.0.0
script.js?v=1.0.0
```

Saat perubahan besar:

1. Naikkan versi di `index.html`.
2. Push ulang ke GitHub.
3. Tunggu deployment selesai.
4. Pada HP lakukan hard refresh atau hapus cache situs.
5. Aset upload memakai nama timestamp-random agar tidak tertahan CDN lama.

## 29. Memasang Custom Domain

1. Buka project Vercel → **Settings → Domains**.
2. Tambahkan domain/subdomain.
3. Ikuti DNS record dari Vercel.
4. Setelah valid, buka Supabase Auth URL Configuration.
5. Ganti Site URL ke custom domain.
6. Tambahkan custom domain ke Redirect URLs.
7. Uji login, undangan, dan reset password melalui HTTPS.

## 30. Peringatan Keamanan

- Jangan pernah commit `.env` atau Service Role Key.
- Jangan menaruh password default di source code.
- Jangan mengandalkan tombol tersembunyi sebagai keamanan.
- Jangan menonaktifkan RLS.
- Jangan memberikan akses endpoint pengguna kepada Editor.
- Audit perubahan role dan status akun secara berkala.
- Gunakan password kuat dan aktifkan proteksi akun Supabase yang tersedia.
- Batasi anggota yang diberi role Super Admin.
- Backup database dan dokumentasi Storage secara berkala.
- Tinjau daftar Auth Redirect URLs agar tidak mengarah ke domain asing.
- Rotasi Service Role Key jika pernah bocor.

## Endpoint Serverless

| Method | Endpoint | Akses |
|---|---|---|
| GET | `/api/config` | Publik; hanya URL + anon key |
| POST | `/api/users/create` | Super Admin |
| GET | `/api/users/list` | Super Admin |
| PATCH | `/api/users/update` | Super Admin |
| POST | `/api/users/disable` | Super Admin |
| POST | `/api/users/enable` | Super Admin |
| DELETE | `/api/users/delete` | Super Admin |
| GET | `/api/audit/list` | Super Admin |

## Pengujian Otomatis Lokal

```bash
npm run check
```

Pemeriksaan mencakup:

- File wajib tersedia.
- ES Modules aktif.
- Tidak ada `scroll-snap`.
- Tidak ada route `/admin`.
- CSS natural scroll tersedia.
- Draft LocalStorage tersedia.
- Tidak ada Service Role Key yang tampak hardcoded.

## Checklist Pengujian Manual

### Publik

- [ ] Home dan loading tampil.
- [ ] Semua section tampil.
- [ ] Scroll manual alami dan kontinu.
- [ ] Menu hanya melakukan smooth scroll saat ditekan.
- [ ] Popup anggota dapat dibuka dan ditutup.
- [ ] Filter anggota bekerja.
- [ ] Filter galeri bekerja.
- [ ] Lightbox, swipe horizontal, previous, next, zoom, Escape, dan keyboard bekerja.
- [ ] Tidak ada horizontal overflow pada 360×800, 390×844, dan 412×915.

### Login dan role

- [ ] Pengunjung tidak melihat tombol Edit.
- [ ] Password salah menampilkan pesan.
- [ ] Session restore bekerja.
- [ ] Akun nonaktif tidak dapat mengedit.
- [ ] Editor tidak dapat membuka Kelola Pengguna.
- [ ] Super Admin dapat membuka pengguna dan audit.
- [ ] Logout menghapus state editor dan tombol edit.

### Mode Edit

- [ ] Posisi scroll tidak berubah saat mode aktif.
- [ ] Teks, logo, background, struktur, anggota, dan galeri dapat diubah.
- [ ] Undo/redo bekerja sebelum simpan.
- [ ] Draft dapat dipulihkan.
- [ ] Preview menyembunyikan outline.
- [ ] Simpan mengirim perubahan ke Supabase.
- [ ] Perubahan terlihat pada perangkat lain.

### Keamanan

- [ ] UPDATE anonim gagal.
- [ ] Editor tidak dapat mengubah profiles/role.
- [ ] Endpoint menolak token Editor.
- [ ] Service Role Key tidak terlihat pada DevTools Network/source.
- [ ] Satu-satunya Super Admin aktif tidak dapat dinonaktifkan/dihapus/didemote.

## Bagian Kode Penting yang Dapat Diedit

- `style.css`: token warna, radius, glass, breakpoint, toolbar, modal, dan performa HP.
- `data.js`: fallback/demo data dan kategori galeri.
- `ui.js`: rendering card, modal, lightbox, navigasi, loading, dan efek visual.
- `editor.js`: draft, undo/redo, form editor, upload, pengguna, dan audit.
- `storage.js`: batas file, kualitas WebP, dimensi kompresi, dan pola nama file.
- `supabase/schema.sql`: struktur tabel, trigger, RPC, dan audit.
- `supabase/policies.sql`: otorisasi database.
- `supabase/storage-policies.sql`: izin upload/read/delete Storage.
- `api/_shared.js`: validasi token/role dan helper keamanan server.
- `vercel.json`: header keamanan, CSP, cache, dan runtime function.

## Catatan Implementasi

- Musik tidak autoplay. Pengguna harus menekan tombol musik.
- Particle, parallax, dan mouse light hanya aktif di desktop dan dimatikan pada reduced motion.
- Pada HP, backdrop blur dan efek berlapis dikurangi.
- Tidak ada wheel listener, scroll snap, swipe global, atau `scrollIntoView` saat scroll manual.
- Upload Supabase standar tidak menyediakan callback progress byte bawaan pada implementasi ini; progress galeri menunjukkan progres jumlah file yang selesai diproses.
