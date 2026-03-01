# SETUP — Contest Dashboard v5

## A. Untuk Klien (Tidak Perlu Install Apapun)

Klien **tidak perlu menginstall PHP, Node.js, Laragon, atau software apapun**.

Cukup buka browser dan akses URL Vercel:

```
https://your-app.vercel.app/
```

Data akan otomatis terupdate setiap 30 detik dari Google Sheets.

---

## B. Deploy ke Vercel (Satu Kali, Oleh Developer)

### Prasyarat
- Akun [Vercel](https://vercel.com) (gratis)
- Vercel CLI: `npm install -g vercel`
- Repository sudah di-push ke GitHub/GitLab

### Langkah Deploy

```bash
# 1. Login ke Vercel
vercel login

# 2. Di folder project
cd /path/to/contest/v5

# 3. Deploy (pertama kali — ikuti wizard)
vercel

# 4. Deploy berikutnya (otomatis dari git push jika sudah terhubung)
git push origin master
```

Vercel otomatis mendeteksi `api/proxy.js` sebagai serverless function dan menjalankannya di endpoint `/api/proxy`.

### Struktur file yang relevan untuk Vercel
```
v5/
├── api/
│   └── proxy.js        ← Node.js serverless function (otomatis di-deploy Vercel)
├── vercel.json         ← Konfigurasi routing Vercel
└── index.html          ← Frontend SPA
```

---

## C. Development Lokal (Opsional, Untuk Developer)

Ada tiga opsi untuk development lokal:

### Opsi 1: Laragon + PHP (Setup Saat Ini)

File `api/proxy.php` dan `api/.htaccess` sudah tersedia untuk dijalankan di Laragon.

```
http://contest.test/v5/
```

Apache di Laragon akan merewrite request `api/proxy?sheet=...` ke `api/proxy.php` via `.htaccess`.

**Prasyarat:** Laragon berjalan, virtual host `contest.test` aktif.

### Opsi 2: Vercel Dev (Tanpa PHP, Menggunakan Node.js Lokal)

```bash
# Install Vercel CLI jika belum
npm install -g vercel

# Jalankan di folder project
cd /path/to/contest/v5
vercel dev
```

Buka `http://localhost:3000/` — Vercel Dev akan menjalankan `api/proxy.js` secara lokal persis seperti di production.

**Prasyarat:** Node.js terinstall.

### Opsi 3: Akses Langsung URL Vercel Production (Paling Simpel)

Tidak perlu setup lokal sama sekali. Cukup edit file, push ke git, lalu buka URL Vercel production untuk testing.

```bash
git add .
git commit -m "update"
git push origin master
# Tunggu ~30 detik → Vercel otomatis rebuild
```

---

## D. Troubleshooting

### Data tidak terupdate

1. Buka browser DevTools → tab **Network**
2. Cari request ke `/api/proxy?sheet=tasks`
3. Pastikan response status **200** dan header `Cache-Control: no-store`

Jika status bukan 200, cek:
- Vercel: `vercel logs` di terminal
- Laragon: cek apakah Apache berjalan dan `api/.htaccess` aktif

### Proxy down / error

App secara otomatis akan **fallback ke Google Sheets langsung**. Sebuah toast warning akan muncul:

> ⚠️ Mode Fallback — Proxy tidak tersedia — data diambil langsung dari Google Sheets (mungkin sedikit tidak terbaru)

Data tetap tampil, namun mungkin terlambat hingga ~1 menit (Google CDN cache).

### Cek Vercel function logs

```bash
vercel logs
# atau untuk production
vercel logs --prod
```

### Data Google Sheets tidak muncul

Pastikan spreadsheet sudah di-publish:
- Google Sheets → **File** → **Share** → **Publish to web**
- Pilih format **CSV**
- Aktifkan **Automatically republish when changes are made**

---

## E. Arsitektur Sistem

```
KLIEN (browser, tanpa install apapun)
  └─ https://your-app.vercel.app/
            │
       Vercel CDN (static files: HTML, CSS, JS)
            │
       api/proxy.js (Node.js serverless, berjalan di Vercel)
            │
       Google Sheets API (fresh data, no cache)
```

**Fallback otomatis jika proxy down:**

```
Browser → api/proxy (gagal)
       → Google Sheets langsung (data mungkin sedikit stale)
```
