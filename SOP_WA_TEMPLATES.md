# SOP & Template WhatsApp Report Calio Fish

> **PENTING**: Copy-paste format di bawah ini saat mengirim pesan laporan ke Grup WhatsApp.
> - Anda **BISA** menggunakan tanda bintang untuk menebalkan teks (contoh: `*PRODUKSI*`, `*PENGIRIMAN*`).
> - Anda **TIDAK PERLU** lagi memakai garis bawah (underscore).
> - Anda **BISA** menggunakan penulisan angka bebas: `1jt`, `50rb`, `seratusribu`, `5juta`, dll.
> - Anda **BISA** mengosongkan baris `Tanggal` — jika tidak diisi, AI otomatis menggunakan tanggal hari ini.
> - **Target, Persentase, MTD, dan Outlet Aktif TIDAK PERLU DIISI** — sistem akan menghitung semuanya secara otomatis berdasarkan data bulan ini di database.
> - **PENYEBUTAN PRODUK HARUS JELAS:** Gunakan "FS Ori", "FS SM", "FS Soto", "FS Rendang", atau "Abon".

---

## 1. Presensi / Absensi Karyawan

Karyawan bisa langsung mengirim pesan absen ke grup cukup **dalam satu baris saja**. 
**Pastikan nomor HP Anda sudah didaftarkan di menu "Database Karyawan" di web Dashboard**, agar sistem otomatis mengenali nama Anda.

**Jika Hadir:**
```text
PRESENSI HADIR
```

**Jika Izin / Sakit:**
```text
PRESENSI IZIN nganter keluarga ke rumah sakit
```

---

## 2. Marketing Offline (Penjualan Outlet / B2B)

**PENTING (Single Source of Truth):** Laporkan omset harian sekaligus rincian barang yang laku. Sistem akan langsung mencatat omset keuangannya, dan otomatis **memotong stok dari Outlet** yang Anda sebutkan.

```text
*MARKETING OFFLINE*
Outlet: Outlet Malang
Omset: 1,2jt
Laku: FS Ori 10, FS SM 5
```
*(Sistem akan memotong 10 FS Ori dan 5 FS SM dari stok Outlet Malang, dan mencatat omset keuangan 1.2jt)*

> **Contoh Narasi (Bebas):** 
> *"Laporan outlet malang hari ini omset 1.2jt mas, laku FS Ori 10 sama FS SM 5."*

---

## 3. Marketing Online (Penjualan Marketplace)

Sama seperti Offline, laporkan omset sekaligus rincian barang laku. Tuliskan juga **dari gudang mana** barang tersebut dikirim (jika tidak ditulis, otomatis memotong stok Gudang Banyuwangi).

```text
*MARKETING ONLINE*
Shopee: 609.830
Laku: FS Ori 50, Abon 20
Dikirim dari: Gudang Malang
```
*(Sistem akan mencatat omset Shopee 609.830, dan memotong 50 FS Ori serta 20 Abon dari stok Gudang Malang)*

> **Contoh Narasi (Bebas):** 
> *"Shopee hari ini omset 609.830. Barang yang laku FS Ori 50 bungkus, Abon 20. Dikirim dari gudang Malang ya."*

---

## 4. Pengiriman (Transfer Logistik / Stok)

Gunakan format ini **HANYA** untuk memindahkan stok antar gudang atau dari gudang ke outlet (Bukan barang laku/terjual). **Sebutkan dengan jelas Asal dan Tujuan pengiriman.**

```text
*PENGIRIMAN*
Dari: Gudang Banyuwangi
Ke: Outlet Malang
Barang: FS Ori 100, FS SM 50
```
*(Sistem akan mengurangi stok Gudang Banyuwangi dan memindahkan stok tersebut menjadi stok Outlet Malang. Total penyebaran produk secara global tetap sama, hanya berpindah lokasi).*

> **Contoh Narasi (Bebas):** 
> *"Kirim 100 FS Ori dan 50 FS SM dari Gudang Banyuwangi ke Outlet Malang mas."*

---

## 5. Produksi

Karyawan **WAJIB** menyebutkan nama produk dan kegiatan produksinya. 
**PENTING:** Hanya kegiatan **"Mengemas"** yang akan memicu penambahan stok produk jadi (pcs) secara otomatis ke **Gudang Banyuwangi**.

```text
*PRODUKSI*
Produk: FS Ori
Kegiatan: Mengemas
Total Hasil: 150 pcs
HPP Batch: 800rb
```
*(Stok Gudang Banyuwangi akan bertambah 150 pcs FS Ori)*

Jika kegiatannya bukan Mengemas (contoh: Menggoreng), stok barang jadi tidak akan bertambah, melainkan hanya tercatat riwayat produksinya saja.

> **Contoh Narasi (Bebas):** 
> *"Tim produksi hari ini mengemas FS Ori, total dapet 150 pcs. HPP Batch sekitar 800ribu."*

---

## 6. Retur Produk

Jika ada produk yang dikembalikan (rusak, cancel kurir, dsb) dari Outlet ke Gudang. 

```text
*RETUR*
Dari: Outlet Malang
Ke: Gudang Banyuwangi
Barang: FS Ori 5
Alasan: Kemasan rusak di ekspedisi
```
*(Stok Outlet Malang akan berkurang 5, dan stok Gudang Banyuwangi akan mencatat 5 barang tersebut ke bagian "Estimasi Kerugian / Retur" secara terisolasi agar tidak merusak hitungan stok produk sehat).*

> **Contoh Narasi (Bebas):** 
> *"Retur dari Outlet Malang 5 FS Ori ke Gudang Banyuwangi karena kemasan rusak di ekspedisi."*

---

## 7. Pembersihan Kulit

Sistem akan otomatis mencatat ini ke dalam tabel halaman `Produksi` dengan Kategori "Pembersihan Kulit". 

```text
*PEMBERSIHAN*
Beku: 10,6 kg
Bersih: 6,3 kg
```

> **Contoh Narasi (Bebas):** 
> *"Pembersihan kulit beku 10.6 kg, hasil bersihnya 6.3 kg."*

---

## 8. Jadwal KOL & Database Affiliate

Sistem bisa membaca penjadwalan KOL dan mendaftarkan Affiliate baru dari chat Anda.

**Penjadwalan KOL:**
```text
*JADWAL KOL*
Nama KOL: Kak Budi
Jadwal Kirim: 15 Agustus
Estimasi Upload: 20 Agustus
```
> **Contoh Narasi (Bebas):** 
> *"Jadwalin KOL Kak Budi ya, barang dikirim 15 Agustus, estimasi upload 20 Agustus."*

**Tambah Database Affiliate:**
```text
*DATABASE AFFILIATE*
Nama: Sisca Kohl
Akun Medsos: @siscakohl
Ratecard: 10juta
```
> **Contoh Narasi (Bebas):** 
> *"Tambah affiliate Sisca Kohl, IG @siscakohl, ratecard 10juta."*
