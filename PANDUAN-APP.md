# Dapur Parto — panduan app Android

Kode web dan app memakai satu `index.html` yang sama. GitHub Pages tetap jalan
seperti biasa, dan GitHub Actions otomatis membuat file APK setiap kali ada push ke `main`.

## Yang baru
- Login email + password (Supabase Auth), ditambah sidik jari di app Android.
  Email dan password disimpan di Android Keystore dan hanya bisa dibuka lewat scan sidik jari.
- App terkunci lagi kalau ditinggal di background lebih dari 5 menit.
- Tampilan baru: splash screen, skeleton loading, indikator "Menyimpan… / Tersimpan".
- Struk bisa diekspor jadi JPG (lebar 1080px), dibagikan ke WhatsApp/Instagram, atau disimpan ke Galeri.
- Library dan font disimpan lokal di folder `vendor/`, jadi tidak bergantung CDN.

## Langkah 1 — Supabase (sekali saja)
1. **Authentication → Sign In / Providers → Email**: pastikan aktif.
   Matikan **Allow new users to sign up** supaya orang lain tidak bisa mendaftar sendiri.
2. **Authentication → Users → Add user → Create new user**: buat akun untuk kamu dan
   setiap staff. Centang **Auto Confirm User**.
3. Upload semua file ke repo GitHub (lihat langkah 2), lalu tunggu GitHub Pages ter-update.
4. Setelah itu baru jalankan `supabase/rls.sql` di **SQL Editor**. File ini mengunci
   database sehingga hanya user yang sudah login yang bisa membaca dan menulis data.
   Data lama tidak berubah.

> Urutannya penting. Kalau RLS dinyalakan sebelum versi baru online, web lama
> (yang belum punya login) tidak akan bisa memuat data.

## Langkah 2 — Upload ke GitHub
Upload isi folder ini ke repo `dapur-parto`, **kecuali** `node_modules/` dan `www/`.
Folder yang wajib ikut: `android/`, `vendor/`, `.github/`, `scripts/`, `supabase/`,
`package.json`, dan `package-lock.json`.

## Langkah 3 — Kunci tanda tangan APK (sekali saja)
Supaya update APK bisa langsung dipasang di atas versi lama:
1. Repo → **Settings → Secrets and variables → Actions → New repository secret**.
2. `ANDROID_KEYSTORE_BASE64` = isi file `keystore-base64.txt`.
3. `ANDROID_KEYSTORE_PASSWORD` = isi file `keystore-password.txt`.
4. Simpan `dapurparto-release.keystore` dan password-nya di tempat aman (misalnya password manager).
   Kalau hilang, app harus di-uninstall dulu sebelum bisa dipasang versi baru.

Tanpa secret ini, workflow tetap jalan tapi hanya membuat APK *debug*.

## Langkah 4 — Ambil APK
Repo → **Actions → Build APK Android** → pilih run terbaru → bagian **Artifacts** →
download `dapur-parto-apk`. Kirim file `.apk` ke HP (misalnya lewat WhatsApp/Drive), lalu
pasang. Android akan minta izin "install dari sumber tidak dikenal"; izinkan.

Untuk update berikutnya: naikkan `versionCode` (contoh: 1 → 2) di
`android/app/build.gradle`, push, lalu pasang APK baru di atas yang lama.

## Kerja lokal (opsional)
```
npm install
npm run build          # salin web ke www/
npx cap sync android   # salin ke project Android
npx cap open android   # buka di Android Studio
```
