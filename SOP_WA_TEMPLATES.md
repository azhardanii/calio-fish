# SOP & Template WhatsApp Report Calio Fish

---

## 1. Presensi / Absensi Karyawan

Karyawan bisa langsung mengirim pesan absen ke grup cukup **dalam satu baris saja**. 
**Pastikan nomor HP Anda sudah didaftarkan di menu "Database Karyawan" di web Dashboard**, agar sistem otomatis mengenali nama Anda.

**Jika Hadir:**
```text
/masuk
```

**Jika Izin / Sakit:**
```text
/izin nganter keluarga ke rumah sakit
```

---

## 2. Marketing Offline (Penjualan Outlet / B2B)

Laporan omset harian sekaligus rincian barang yang laku. Sistem akan langsung mencatat omset keuangannya, dan otomatis **memotong stok dari Outlet** yang Anda sebutkan.

> *"/lapor Laporan outlet A malang hari ini omset 1.2jt, laku FS Ori 10 sama FS SM 5."*

*(Sistem akan memotong 10 FS Ori dan 5 FS SM dari stok Outlet Malang, dan mencatat omset keuangan 1.2jt)*

---

## 3. Marketing Online (Penjualan Marketplace)

Sama seperti Offline, laporkan omset sekaligus rincian barang laku. Tuliskan juga **dari gudang mana** barang tersebut dikirim (jika tidak ditulis, otomatis memotong stok Gudang Banyuwangi).

> *"/lapor Shopee hari ini omset 609.830. Barang yang laku FS Ori 50 bungkus, Abon 20. Dikirim dari gudang Malang."*

*(Sistem akan mencatat omset Shopee 609.830, dan memotong 50 FS Ori serta 20 Abon dari stok Gudang Malang)*

---

## 4. Pengiriman (Transfer Logistik / Stok)

Gunakan format ini **HANYA** untuk memindahkan stok antar gudang atau dari gudang ke outlet (Bukan barang laku/terjual). **Sebutkan dengan jelas Asal dan Tujuan pengiriman.**

> *"/lapor Kirim 100 FS Ori dan 50 FS SM dari Gudang Banyuwangi ke Outlet A Malang."*

*(Sistem akan mengurangi stok Gudang Banyuwangi dan memindahkan stok tersebut menjadi stok Outlet Malang. Total penyebaran produk secara global tetap sama, hanya berpindah lokasi).*

---

## 5. Produksi

Karyawan **WAJIB** menyebutkan nama produk dan kegiatan produksinya. 
**PENTING:** Hanya kegiatan **"Mengemas"** yang akan memicu penambahan stok produk jadi (pcs) secara otomatis ke **Gudang Banyuwangi**.

> *"/lapor Tim produksi hari ini mengemas FS Ori, total dapet 150 pcs."*

*(Stok Gudang Banyuwangi akan bertambah 150 pcs FS Ori)*

Jika kegiatannya bukan Mengemas (contoh: Menggoreng), stok barang jadi tidak akan bertambah, melainkan hanya tercatat riwayat produksinya saja.

---

## 6. Retur Produk

Jika ada produk yang dikembalikan (rusak, cancel kurir, dsb) dari Outlet ke Gudang. 

> *"/lapor Retur dari Outlet Malang 5 FS Ori ke Gudang Banyuwangi karena kemasan rusak di ekspedisi."*

*(Stok Outlet Malang akan berkurang 5, dan stok Gudang Banyuwangi akan mencatat 5 barang tersebut ke bagian "Estimasi Kerugian / Retur" secara terisolasi agar tidak merusak hitungan stok produk sehat).*

---

## 7. Pembersihan Kulit

Sistem akan otomatis mencatat ini ke dalam tabel halaman `Produksi` dengan Kategori "Pembersihan". 

> *" /lapor Pembersihan kulit beku 10.6 kg, hasil bersihnya 6.3 kg."*

---

## 8. Jadwal KOL & Database Affiliate

Sistem bisa membaca penjadwalan KOL dan mendaftarkan Affiliate baru dari chat Anda.

**Penjadwalan KOL:**

> *"/lapor Jadwalin KOL Kak Budi, barang dikirim 15 Agustus, estimasi upload 20 Agustus."*

**Tambah Database Affiliate:**
> *"/lapor Tambah affiliate Sisca Kohl, IG @siscakohl, ratecard 10juta."*
