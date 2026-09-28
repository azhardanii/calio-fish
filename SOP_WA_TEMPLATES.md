# SOP & Template WhatsApp Bot Calio Fish (Format Singkat & Padat)

Panduan praktis perintah WhatsApp Bot Calio Fish. Perintah dibuat **singkat, padat, dan langsung pada poin penting** agar AI sistem dapat memproses dan mengeksekusi data ke database secara otomatis dan bebas error.

> [!TIP]
> **Aturan Penulisan Singkat:**
> - Presensi cukup diawali `/hadir`, `/izin [alasan]`, atau `/sakit [alasan]`.
> - Semua pelaporan operasional diawali `/lapor` diikuti detail poin penting (Nama pihak/lokasi, nominal/jumlah, varian produk).
> - Tidak perlu kata pengantar yang panjang atau bertele-tele.

---

## 1. Presensi Karyawan
Kirim langsung dari nomor WhatsApp yang sudah terdaftar di Database Karyawan:

* **Hadir / Masuk Kerja:**
  > `/hadir`
  > *(atau: `/masuk`)*
* **Izin Kerja:**
  > `/izin urusan keluarga`
  > `/izin antar ortu ke klinik`
* **Sakit:**
  > `/sakit demam flu`
  > `/sakit radang tenggorokan istirahat dokter`

*Efek Sistem: Langsung tercatat di riwayat absensi harian dan rekap kehadiran karyawan.*

---

## 2. Produksi & Pengolahan Bahan Baku

* **Mengemas Produk Jadi (Menambah Stok Siap Jual di Gudang):**
  > `/lapor mengemas FS Ori 100gr 50pcs`
  > `/lapor mengemas FS SM 100gr 100pcs`
  > `/lapor mengemas Abon 90gr 40pcs`
  *(Stok fisik di Gudang Banyuwangi dan stok global sistem otomatis bertambah)*

* **Menggoreng:**
  > `/lapor menggoreng bahan baku 2kg jadi 1kg`
  > `/lapor menggoreng bahan baku 20kg jadi 17kg`

* **Pembersihan Kulit Ikan (Bahan Baku Beku -> Siap Olah):**
  > `/lapor pembersihan kulit beku 15kg jadi 9kg`
  > `/lapor pembersihan kulit beku 20kg jadi 12kg`

* **Penirisan Minyak (Spinner):**
  > `/lapor penirisan minyak bahan 18kg jadi 17kg`

* **Pemberian Bumbu / Seasoning:**
  > `/lapor bumbu salted egg bahan 17kg jadi 18kg`
  > `/lapor bumbu soto bahan 10kg jadi 10.5kg`

* **Pemotongan Kulit:**
  > `/lapor pemotongan bahan baku 20kg jadi 19kg`

*Efek Sistem: Otomatis masuk ke kartu batch harian di modul Produksi.*

---

## 3. Pengeluaran Operasional Perusahaan

Format: `/lapor pengeluaran [KATEGORI] [NOMINAL] [KEPERLUAN]`  
*Pilihan Kategori: `OPERASIONAL`, `MARKETING`, `IKLAN`, `LOGISTIK`, `PRODUKSI`*

* **BBM / Bensin / Transport:**
  > `/lapor pengeluaran OPERASIONAL 50.000 bensin mobil box`
  > `/lapor pengeluaran OPERASIONAL 350.000 servis mobil operasional`

* **Marketing & Perlengkapan Display Toko:**
  > `/lapor pengeluaran MARKETING 250.000 beli rak display outlet`
  > `/lapor pengeluaran MARKETING 120.000 cetak banner promosi`

* **Biaya Iklan E-Commerce (Shopee Ads & TikTok Ads):**
  > `/lapor pengeluaran IKLAN 150.000 Shopee Ads`
  > `/lapor pengeluaran IKLAN 200.000 TikTok Ads`

* **Logistik / Ekspedisi:**
  > `/lapor pengeluaran LOGISTIK 85.000 ongkir kargo kirim sampel`

*Efek Sistem: Masuk ke modul Pengeluaran, tersinkron ke Ringkasan Finansial Overview, dan memotong Margin Bersih.*

---

## 4. Penjualan Personal Buyer (Direct Retail B2C)
Penjualan eceran langsung ke perorangan (bukan toko/outlet).

Format: `/lapor personal buyer [NAMA PEMBELI] total [NOMINAL]: [QTY] [PRODUK], [GUDANG ASAL]`

* **Contoh Singkat:**
  > `/lapor personal buyer Bu Siti total 75.000: 2 FS Ori, 1 Abon, Gudang Banyuwangi`
  > `/lapor personal buyer Pak Hendra total 125.000: 5 FS SM, transfer`
  > *(Jika nama gudang tidak ditulis, sistem otomatis memotong stok Gudang Banyuwangi)*

*Efek Sistem: Memotong stok gudang asal, memotong stok global, dan mencatat transaksi ke modul Personal Buyer serta menambah Kas Terkumpul.*

---

## 5. Marketing Offline (Penjualan Outlet / Toko B2B)
Penjualan pada toko langganan/outlet mitra.

Format: `/lapor penjualan [NAMA OUTLET] omset [NOMINAL]: [QTY] [PRODUK]`

* **Contoh Singkat:**
  > `/lapor penjualan Toko Oleh-oleh Malang omset 1.250.000: 15 FS Ori, 10 FS SM, 5 Abon`
  > `/lapor penjualan Toko Barokah Banyuwangi omset 800.000: 20 FS Ori, 10 FS Soto`

*Efek Sistem: Memotong stok display outlet yang bersangkutan dan menambah progress omset bulanan PIC Marketing.*

---

## 6. Keuangan Outlet (Pelunasan vs Bon Baru)

* **Pelunasan / Bayar Tagihan Toko:**
  > `/lapor bayar Toko Barokah 850.000 transfer`
  > `/lapor bayar Toko Oleh-oleh Malang 1.200.000 tunai`
  *(Mengurangi sisa piutang outlet dan mencatat kas masuk)*

* **Penambahan Piutang / Bon Baru:**
  > `/lapor piutang Toko Barokah 500.000 bon display`
  *(Menambah tagihan outlet tanpa mengubah stok fisik)*

---

## 7. Distributor (Kirim Stok & Kas Masuk)

* **Kirim Stok ke Distributor:**
  > `/lapor kirim Gudang Banyuwangi ke Gudang Distributor Malang: 200 FS Ori, 100 FS SM, 50 Abon`
  > `/lapor kirim Gudang Banyuwangi ke Distributor Pak Budi: 150 FS Ori, 50 FS Soto`
  *(Memindahkan stok internal dari Gudang Pusat ke stok aktif Distributor)*

* **Pembayaran Kas Masuk dari Distributor:**
  > `/lapor bayar Toko Barokah Malang 2.500.000 transfer`
  > `/lapor bayar Distributor Pak Hendra 5.000.000 transfer`
  *(Masuk ke rekap transaksi distributor dan menambah saldo Kas Masuk Distributor di Overview)*

---

## 8. E-Commerce (Shopee & TikTok Shop)
Laporan omset harian marketplace online dan pemotongan stok gudang packing.

* **Shopee:**
  > `/lapor shopee omset 1.850.000 Gudang Malang: 40 FS Ori, 20 FS Soto, 15 Abon`

* **TikTok Shop:**
  > `/lapor tiktok omset 2.100.000 Gudang Banyuwangi: 50 FS Ori, 25 FS SM`

*Efek Sistem: Mencatat omset harian & MTD e-commerce, serta memotong stok gudang yang dipilih.*

---

## 9. Logistik & Transfer Stok

* **Transfer Antar Gudang:**
  > `/lapor kirim Gudang Banyuwangi ke Gudang Malang: 200 FS Ori, 100 FS SM, 50 Abon`

* **Kirim Barang ke Outlet / Toko:**
  > `/lapor kirim Gudang Malang ke Toko Barokah: 50 FS Ori, 25 FS Soto`
  *(Memotong stok gudang asal, menambah stok outlet, dan membuat tagihan kirim baru)*

---

## 10. Event & Open Booth Pameran

* **Kirim Stok Persiapan ke Booth:**
  > `/lapor kirim Gudang Malang ke Booth Jatim Expo: 100 FS Ori, 50 FS SM, 30 Abon`

* **Laporan Penjualan Booth:**
  > `/lapor penjualan Booth Jatim Expo omset 1.350.000 qris: 20 Paket Hemat, 15 FS Ori`
  > `/lapor penjualan Booth Bazar UMKM omset 800.000 tunai: 20 FS Ori, 12 FS SM`

* **Penutupan Event Booth & Kembalikan Sisa Stok Layak Jual:**
  > `/lapor selesai Booth Jatim Expo kembali ke Gudang Malang: 25 FS Ori, 10 Abon`
  *(Sisa produk masuk kembali ke stok aktif gudang utama dan event booth ditandai SELESAI)*

---

## 11. Retur Produk Rusak (Isolasi)
Khusus barang cacat produksi, remuk, bocor kemasan, atau expired (tidak untuk dijual kembali).

* **Contoh Singkat:**
  > `/lapor retur Toko Barokah ke Gudang Banyuwangi 5 FS Ori kemasan sobek`
  > `/lapor retur Toko Malang ke Gudang Malang 3 FS SM bocor seal`

*Efek Sistem: Masuk ke gudang retur isolasi (returned_qty).*

---

## 12. Distribusi Sample (Promosi / Tester / Influencer)

* **Sample Promosi / Endorsement:**
  > `/lapor sample Gudang Banyuwangi ke Selebgram Amanda: 3 FS Ori, 2 Abon, ongkir 18.000`

* **Sample Affiliate:**
  > `/lapor sample affiliate Amanda: 2 FS Ori`
  *(Otomatis default potong dari Gudang Banyuwangi)*

---

## 13. Jadwal KOL & Affiliate Baru

* **Jadwal Tayang / Review KOL:**
  > `/lapor jadwal KOL Amanda kirim 10 Sep upload 16 Sep`

* **Daftar Affiliate Baru:**
  > `/lapor affiliate baru Rina Wulandari IG @rinawulan WA 08123456789 fee 500.000`

---

## 14. Kamus SKU & Singkatan Resmi Produk Calio Fish

Gunakan singkatan atau nama berikut agar AI mengenali produk secara tepat:

| Nama Produk | Singkatan Populer | SKU Sistem | Keterangan Ukuran |
| :--- | :--- | :--- | :--- |
| **Fish Skin Original 100g** | `FS Ori`, `FS Original 100g`, `Original` | `FS-ORI-100` | Varian 100 gram |
| **Fish Skin Original 60g** | `FS Ori 60g`, `FS 60g` | `FS-ORI-60` | Varian mini 60 gram |
| **Fish Skin Salted Egg / SM** | `FS SM`, `Salted Egg`, `Telur Asin` | `FS-SM-100` | 100 gram |
| **Fish Skin Soto** | `FS Soto`, `Soto` | `FS-SOTO-100` | 100 gram |
| **Fish Skin Rendang** | `FS Rendang`, `Rendang` | `FS-RENDANG-100` | 100 gram |
| **Abon Tuna** | `Abon`, `Abon Tuna` | `AB-TNA-90` | 90 gram |
| **Paket Hemat Booth** | `Paket Hemat`, `Bundling Hemat` | Bundle | 2 FS Ori + 1 FS SM |
