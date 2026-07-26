# Laporan Pengujian — XII IPS

Tanggal pemeriksaan: 26 Juli 2026

## Pemeriksaan otomatis yang lulus

- Seluruh file dan folder wajib tersedia pada root proyek.
- Seluruh file JavaScript dan MJS lulus `node --check`.
- `package.json` dan `vercel.json` valid sebagai JSON.
- `index.html` memakai ES Modules dan memiliki enam section dalam urutan Home, Tentang, Struktur, Anggota, Galeri, Penutup.
- Tidak ada ID HTML duplikat.
- Seluruh referensi aset lokal pada HTML ditemukan.
- Seluruh aset WebP/PNG default dapat dibuka dan diverifikasi.
- Seed menyediakan 30 anggota melalui `generate_series(1,30)`, 11 jabatan struktur, dan 8 kategori galeri.
- Tidak ditemukan `scroll-snap-type`, `scroll-snap-align`, fullPage, wheel hijacking, atau route `/admin`.
- CSS memuat `overscroll-behavior-y: none`, `touch-action: pan-y`, mobile safe area, dan reduced motion.
- Draft editor menggunakan LocalStorage, memiliki Undo/Redo, serta mempertahankan identitas pemilik draft ketika sesi berakhir.
- Setiap tabel utama mengaktifkan RLS.
- Storage policy memverifikasi pengguna aktif melalui role helper.
- API server memvalidasi Bearer access token dengan Supabase Auth dan memverifikasi role `super_admin`.
- Tidak ditemukan Service Role Key hardcoded pada source frontend.
- File statis utama berhasil dibaca melalui local HTTP server: `index.html`, `style.css`, dan `script.js`.

Jalankan ulang dengan:

```bash
npm run check
```

## Pengujian yang memerlukan environment pengguna

Pengujian berikut harus dilakukan setelah environment variables, proyek Supabase, bucket, dan deployment Vercel benar-benar tersedia:

- Login Editor dan Super Admin dengan akun nyata.
- Reset password melalui email.
- Undangan email dan password sementara.
- CRUD data terhadap database nyata.
- Upload, delete, dan public URL Supabase Storage.
- Realtime lintas dua perangkat.
- Endpoint pengelolaan pengguna pada deployment Vercel.
- Audit log nyata.
- Uji sentuh dan keyboard pada perangkat 360×800, 390×844, dan 412×915.
- Lighthouse/DevTools pada URL production.

Lingkungan pembuatan ZIP tidak memiliki kredensial Supabase/Vercel milik pengguna, sehingga proyek ini tidak mengklaim bahwa integrasi eksternal tersebut telah diuji secara live. Instalasi dependency melalui jaringan sandbox juga tidak diselesaikan; Vercel atau komputer lokal akan menjalankan `npm install` dari `package.json`.
