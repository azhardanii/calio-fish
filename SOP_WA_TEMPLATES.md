# SOP & Template WhatsApp Report Calio Fish

> **PENTING**: Copy-paste format di bawah ini saat mengirim pesan laporan ke Grup WhatsApp.
> - Anda **BISA** menggunakan penulisan angka bebas: `1jt`, `50rb`, `seratusribu`, `5juta`, dll.
> - Anda **BISA** mengosongkan baris `Tanggal` — jika tidak diisi, AI otomatis menggunakan tanggal hari ini.
> - **Target, Persentase, MTD, dan Outlet Aktif TIDAK PERLU DIISI** — sistem akan menghitung semuanya secara otomatis berdasarkan data bulan ini di database.

---

## 1. Presensi / Absensi Karyawan

Karyawan bisa langsung mengirim pesan absen ke grup. **Pastikan nomor HP Anda sudah didaftarkan di menu "Database Karyawan" di web Dashboard**, agar sistem otomatis mengenali nama Anda.

**Jika Hadir:**
```
PRESENSI
HADIR
```

**Jika Izin / Sakit:**
```
PRESENSI
IZIN
Alasan: Mengantar keluarga ke rumah sakit
```

> **Catatan:** Jam kedatangan otomatis dicatat saat pesan terkirim.

---

## 2. Marketing Offline

Cukup kirimkan **Omset Harian** saja. Jumlah Outlet Aktif dan Total Omset MTD akan ditarik otomatis dari web.

```
MARKETING_OFFLINE
Omset Harian: 1,2jt
```

---

## 3. Marketing Online

Sama seperti Offline, cukup kirimkan Omset Harian saja. MTD otomatis dihitung dari database. Bisa dikirim 1 platform atau 2 platform sekaligus.

**Satu platform:**
```
MARKETING_ONLINE
Platform: Shopee
Omset Harian: 74rb
```

**Dua platform sekaligus:**
```
MARKETING_ONLINE

Shopee
Omset Harian: 609.830

Tiktok
Omset Harian: 250rb
```

---

## 4. Paket Kiriman (Warehouse)

Tulis HANYA pada bagian produk/channel yang laku saja. Yang tidak ditulis atau kosong akan otomatis dianggap `0` oleh sistem.

```
PAKET_KIRIMAN

Shopee: 2
Offline: 18

Produk Keluar:
FS Original: 10
FS Sambal Matah: 10
```

---

## 5. Pembersihan Kulit

Sistem akan otomatis mencatat ini ke dalam tabel halaman `Produksi` dengan Kategori "Pembersihan Kulit".

```
PEMBERSIHAN
Bahan Beku: 10,6
Bahan Bersih: 6,3
```

---

## 6. Produksi

```
PRODUKSI
Kegiatan: Menggoreng
Bahan Baku: 12,125
Bahan Jadi: 15,765
```

> Catatan: Jika kegiatannya "menimbang" (tanpa bahan baku), isi langsung `Total Hasil: 32 pcs`

---

## 7. Distribusi Sample

```
DISTRIBUSI_SAMPLE
Jenis Sample: Fish Skin Original
Total Produk: 10
Biaya Ekspedisi: 15rb
```
