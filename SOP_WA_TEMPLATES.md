# SOP & Panduan Template WhatsApp Bot Calio Fish

Dokumen ini adalah panduan resmi pelaporan operasional harian via WhatsApp Bot Calio Fish.
Sistem AI Calio Fish mendukung **2 gaya penulisan laporan**:
1. **Format Terstruktur (Form/Template Baku)**: Cocok untuk laporan rekap yang rapi.
2. **Versi Naratif Natural (`/lapor ...`)**: Cocok untuk laporan cepat dengan bahasa percakapan sehari-hari.

> [!TIP]
> **Awalan `/lapor`**: Untuk laporan naratif/bebas, selalu awali pesan Anda dengan `/lapor` agar bot langsung memprioritaskan pemrosesan data ke sistem.

---

## 1. Presensi & Absensi Karyawan

Karyawan cukup mengirim pesan singkat 1 baris ke bot/grup. Pastikan nomor WhatsApp Anda sudah terdaftar di menu **Database Karyawan** web dashboard.

### A. Hadir / Masuk Kerja
```text
/masuk
```
*Atau naratif:*
```text
/lapor hadir kerja tepat waktu
```

### B. Izin / Sakit / Terlambat
```text
/izin [alasan izin]
/sakit [keterangan sakit]
```
*Contoh naratif:*
```text
/izin antar orang tua periksa ke klinik
/sakit demam flu dari semalam
```
*Efek Sistem*: Otomatis tercatat di riwayat kehadiran karyawan hari ini.

---

## 2. Marketing Offline (Penjualan Outlet & Personal Buyer)

Melaporkan omset harian dan barang yang terjual.

### Format Terstruktur:
```text
LAPORAN MARKETING OFFLINE
OUTLET: Toko Oleh-oleh Malang
OMSET: 1250000
TERJUAL:
- FS Ori: 15
- FS SM: 10
- Abon: 5
```

### Versi Naratif (`/lapor`):
> `/lapor hari ini ada penjualan di Outlet Toko Oleh-oleh Malang omset 1.250.000, laku FS Ori 15 pcs, FS SM 10 pcs, dan Abon 5 pcs.`

*Efek Sistem*:
- Mencatat omset penjualan marketing offline.
- Otomatis memotong stok fisik dari outlet yang bersangkutan.

---

## 3. Keuangan Outlet (Pelunasan Pembayaran vs Piutang/Bon)

Digunakan untuk mencatat pembayaran pelunasan tagihan outlet atau penambahan bon/piutang baru.

### A. Pelunasan / Pembayaran Tagihan Outlet
**Format Terstruktur:**
```text
PEMBAYARAN OUTLET
OUTLET: Toko Barokah Banyuwangi
NOMINAL: 850000
KETERANGAN: Pelunasan invoice kiriman minggu lalu
```
**Versi Naratif (`/lapor`):**
> `/lapor outlet Toko Barokah Banyuwangi sudah lunasin pembayaran tagihan sebesar 850.000 via transfer bank.`

*Efek Sistem*: Mengurangi sisa tagihan outlet, menambah total pembayaran, dan mencatat riwayat mutasi keuangan outlet.

---

### B. Penambahan Piutang / Bon Baru Outlet
**Format Terstruktur:**
```text
PIUTANG OUTLET
OUTLET: Toko Barokah Banyuwangi
NOMINAL: 500000
KETERANGAN: Bon tambahan display etalase depan
```
**Versi Naratif (`/lapor`):**
> `/lapor tambah piutang untuk outlet Toko Barokah Banyuwangi sebesar 500.000 karena ada nota bon baru.`

*Efek Sistem*: Menambah total tagihan dan sisa tagihan outlet tanpa mengubah stok fisik.

---

## 4. Marketing Online (Shopee & TikTok Shop)

Melaporkan omset marketplace online dan pengurangan stok gudang asal.

### Format Terstruktur:
```text
LAPORAN SHOPEE
OMSET: 1850000
GUDANG: Gudang Malang
BARANG TERJUAL:
- FS Ori: 40
- FS Soto: 20
- Abon: 15
```

### Versi Naratif (`/lapor`):
> `/lapor penjualan Shopee hari ini omset 1.850.000 laku FS Ori 40, FS Soto 20, sama Abon 15 bungkus, packing dikirim dari Gudang Malang ya.`

*Efek Sistem*: Mencatat omset harian & MTD e-commerce, memotong stok fisik produk dari Gudang Malang.

---

## 5. Logistik & Pengiriman Stok (Internal Transfer)

Gunakan format ini **HANYA** untuk pemindahan stok antar lokasi (Bukan barang laku terjual). Wajib menyebutkan **ASAL** dan **TUJUAN**.

### A. Transfer Antar Gudang
**Format Terstruktur:**
```text
KIRIM BARANG
DARI: Gudang Banyuwangi
KE: Gudang Malang
BARANG:
- FS Ori: 200
- FS SM: 100
- Abon: 50
```
**Versi Naratif (`/lapor`):**
> `/lapor kirim stok dari Gudang Banyuwangi ke Gudang Malang: FS Ori 200 pcs, FS SM 100 pcs, dan Abon 50 pcs dibawa mobil box.`

---

### B. Distribusi dari Gudang ke Outlet
**Format Terstruktur:**
```text
KIRIM BARANG
DARI: Gudang Malang
KE: Toko Barokah
BARANG:
- FS Ori: 50
- FS Soto: 25
```
**Versi Naratif (`/lapor`):**
> `/lapor restock kiriman dari Gudang Malang ke Toko Barokah berupa FS Ori 50 bungkus dan FS Soto 25 bungkus.`

*Efek Sistem*: Mengurangi stok gudang asal, menambah stok outlet, dan membuat tagihan pengiriman baru pada outlet.

---

## 6. Event & Open Booth / Pameran

Fitur khusus agenda pameran, bazar, dan booth insidental dengan paket bundling SKU dan pengembalian sisa stok.

### A. Pengiriman Stok dari Gudang ke Booth
**Format Terstruktur:**
```text
KIRIM BARANG
DARI: Gudang Malang
KE: Booth Jatim Expo
BARANG:
- FS Ori: 100
- FS SM: 50
- Abon: 30
```
**Versi Naratif (`/lapor`):**
> `/lapor kirim stok untuk persiapan pameran dari Gudang Malang ke Booth Jatim Expo: FS Ori 100 pcs, FS SM 50 pcs, dan Abon 30 pcs.`

*Efek Sistem*: Mengurangi stok Gudang Malang dan mencatat penambahan stok fisik di `BoothStock`.

---

### B. Laporan Penjualan Harian Booth (Bundling & Eceran)
**Format Terstruktur:**
```text
LAPORAN PENJUALAN BOOTH: Booth Jatim Expo
TANGGAL: 2026-09-04
TERJUAL:
- Paket Hemat: 20
- FS Ori: 15
TOTAL OMSET: 1350000
METODE: QRIS
KETERANGAN: Ramai pengunjung siang hari
```
**Versi Naratif (`/lapor`):**
> `/lapor rekap penjualan Booth Jatim Expo hari ini dapet total omset 1.350.000 via QRIS, laku Paket Hemat 20 paket dan FS Ori 15 bungkus.`

*Efek Sistem*:
- Otomatis memotong komponen fisik produk penyusun paket bundling atau produk eceran di booth.
- Menambah total penjualan & kas masuk booth.
- **Tersinkronisasi ke Dashboard Marketing**: Penjualan booth langsung masuk ke pencapaian omset bulanan PIC Marketing penanggung jawab booth.

---

### C. Pengembalian Sisa Stok Layak Jual ke Gudang (Bukan Retur)
> [!IMPORTANT]
> **Pengembalian Sisa Booth ≠ Retur**: Sisa produk dari booth pameran adalah barang **bagus & layak jual**, sehingga stok langsung masuk kembali ke stok aktif gudang dan siap dijual kembali.

**Format Terstruktur:**
```text
PENGEMBALIAN DARI: Booth Jatim Expo
KE GUDANG: Gudang Malang
BARANG:
- FS Ori: 25
- Abon: 10
KETERANGAN: Pameran selesai, sisa stok kembali ke gudang
```
**Versi Naratif (`/lapor`):**
> `/lapor event Booth Jatim Expo sudah selesai ya min, sisa produk yang layak jual dibalikin ke Gudang Malang: FS Ori 25 pcs dan Abon 10 pcs.`

*Efek Sistem*: Mengembalikan produk ke stok aktif (`quantity`) Gudang Malang, menaikkan stok global sistem, dan mencatat riwayat mutasi `PENGEMBALIAN_BOOTH` (arah `IN`).

---

## 7. Retur Produk Rusak / Expired

Hanya untuk barang cacat, rusak di pengiriman, bocor, atau expired dari outlet ke gudang.

### Format Terstruktur:
```text
RETUR BARANG
DARI: Toko Barokah
KE: Gudang Banyuwangi
BARANG:
- FS Ori: 5
KETERANGAN: Kemasan sobek saat ekspedisi
```

### Versi Naratif (`/lapor`):
> `/lapor retur barang rusak dari Toko Barokah ke Gudang Banyuwangi sebanyak 5 pcs FS Ori karena kemasan sobek.`

*Efek Sistem*: Barang dicatat khusus ke stok retur isolasi (`returned_qty`) dan tidak dapat dijual kembali.

---

## 8. Distribusi Sample (Promosi / Tester / Influencer)

### Format Terstruktur:
```text
DISTRIBUSI SAMPLE
DARI: Gudang Banyuwangi
KE: Influencer Sisca
BARANG:
- FS Ori: 3
- Abon: 2
TOTAL PRODUK: 5
BIAYA EKSPEDISI: 18000
```

### Versi Naratif (`/lapor`):
> `/lapor kirim sample tester dari Gudang Banyuwangi ke Selebgram Amanda berupa 3 FS Ori dan 2 Abon, ongkir ekspedisi 18.000.`

---

## 9. Produksi & Pembersihan Bahan Baku

### A. Pengemasan Barang Jadi (Menambah Stok Produk)
> [!NOTE]
> Hanya kegiatan **"Mengemas"** yang memicu penambahan stok produk jadi siap jual ke **Gudang Banyuwangi**.

**Format Terstruktur:**
```text
PRODUKSI
KEGIATAN: Mengemas
PRODUK: FS Ori
JUMLAH: 150
```
**Versi Naratif (`/lapor`):**
> `/lapor tim produksi hari ini selesai mengemas FS Ori dapet total 150 bungkus.`

---

### B. Pembersihan Kulit Ikan (Bahan Baku)
**Format Terstruktur:**
```text
PEMBERSIHAN KULIT
BERAT BEKU: 15.5 kg
HASIL BERSIH: 9.2 kg
```
**Versi Naratif (`/lapor`):**
> `/lapor pembersihan bahan baku kulit ikan beku 15.5 kg, dapet hasil bersih siap olah 9.2 kg.`

---

## 10. Jadwal KOL & Database Affiliate

### A. Jadwal Konten KOL / Influencer
**Versi Naratif (`/lapor`):**
> `/lapor jadwalin KOL Kak Budi Santoso, sample dikirim tanggal 10 September, estimasi upload video review tanggal 16 September.`

---

### B. Registrasi Affiliate Baru
**Versi Naratif (`/lapor`):**
> `/lapor tambah affiliate baru atas nama Rina Wulandari, Instagram @rinawulan, WA 08123456789, ratecard 500.000 untuk konten reels.`

---

## 11. Panduan Singkatan & SKU Produk Calio Fish

Gunakan singkatan atau nama produk berikut dalam laporan agar AI mengenali SKU dengan 100% akurat:

| Nama Produk Lengkap | Singkatan / Sebutan Umum | SKU Sistem |
| :--- | :--- | :--- |
| **Fish Skin Original** | `FS Ori`, `Original`, `FS Original` | `FS-ORI-100` |
| **Fish Skin Salted Egg / SM** | `FS SM`, `Salted Egg`, `Telur Asin` | `FS-SM-100` |
| **Fish Skin Soto** | `FS Soto`, `Soto` | `FS-SOTO-100` |
| **Fish Skin Rendang** | `FS Rendang`, `Rendang` | `FS-RENDANG-100` |
| **Abon Tuna** | `Abon`, `Abon Tuna` | `AB-TNA-90` |
