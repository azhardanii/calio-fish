# SPEC Konsinyasi Calio — pendamping `schema.prisma` baru

Dokumen ini = **sumber kebenaran aturan bisnis** untuk vibe coding. Kalau kode dan dokumen ini bertentangan, ikuti dokumen ini.
Dasar: transkrip meet + kode repo `azhardanii/calio-fish` (Next.js + Prisma 6 + Postgres, deploy pakai `prisma db push`).

> ⚠️ `AGENTS.md` di repo: versi Next.js ini punya breaking changes. Baca `node_modules/next/dist/docs/` sebelum menulis kode Next.

---

## 1. Tiga konsep (jangan dicampur lagi)

| Istilah | Field | Arti |
|---|---|---|
| **Valuasi** | `Outlet.valuasi_stok` | Nilai stok Calio yang masih ada di outlet = `Σ OutletTypeStock.quantity × harga`. **Bukan utang.** |
| **Piutang** | `Outlet.piutang` | Nilai produk terjual yang belum dibayar = `Σ OutletTransaction.piutang_delta` (tidak boleh < 0). |
| **Pembayaran** | `Outlet.payment` | Total uang masuk = `Σ amount` transaksi bertipe `PAYMENT`. |

Field legacy (tetap ada, hanya **mirror**, jangan dipakai untuk logika baru):
`sisa_tagihan = piutang` · `tagihan = payment + piutang`

Tampilan valuasi di UI = `valuasi_stok − valuasi_pending`.

**Harga:** `harga(outlet, jenis) = OutletTypeStock.harga_beli ?? ProductType.base_price`. Harga per **jenis**, sama untuk semua varian rasa.

## 2. Dua mode outlet (`Outlet.has_daily_sales`)

| | `false` — outlet biasa | `true` — modern trade (daily sales) |
|---|---|---|
| Penjualan diketahui dari | Laporan pembayaran + qty terjual | Input `SALE` |
| `SALE` | tidak ada | valuasi ↓, piutang ↑ |
| `PAYMENT` | valuasi ↓ (lewat qty terjual), selisih → piutang | hanya piutang ↓, valuasi tetap |

Ganti mode hanya berlaku untuk transaksi berikutnya.

## 3. Unit data: varian vs jenis

- **Gudang, kiriman (PO), `OutletStock`** → tetap per **varian** (`Product`). `OutletStock` sekarang hanya histori kiriman.
- **Stok outlet & semua laporan outlet** → per **jenis** (`ProductType` → `OutletTypeStock`). Ini yang dipakai hitung valuasi.
- Rasa baru = tambah `Product` baru dengan `product_type_id` jenis yang sudah ada. Tidak ada perubahan lain.

---

## 4. Aturan posting per kejadian

Semua dalam **satu `prisma.$transaction`**: tulis `OutletTransaction` (+ items per jenis), ubah `OutletTypeStock`, lalu panggil `recalculateOutletFinance`. Ledger **tidak di-UPDATE**; koreksi = transaksi baru.

### 4.1 `SHIPMENT` — kirim barang ke outlet
Hook di `submitWarehouseInput` (tujuan Outlet). Per item varian:
- `OutletStock += qty` (histori) dan `OutletTypeStock[jenis] += qty`
- Produk tanpa `product_type_id` → **error**, jangan lanjut.
- Tx: `amount = Σ qty×harga`, `valuasi_delta = +amount`, `piutang_delta = 0`. Menggantikan tx `BILLING` otomatis.

### 4.2 `SALE` — hanya `has_daily_sales = true`
- Input: `items[{product_type_id, qty}]`, `period_start/end` opsional (boleh mingguan).
- Validasi `qty ≤ OutletTypeStock.quantity`, kalau tidak → error.
- `OutletTypeStock −= qty` · `valuasi_delta = −amount` · `piutang_delta = +amount`.

### 4.2b `PAYMENT` — mode B (`has_daily_sales = true`)
- Tanpa items. `settle = min(nominal, piutang_saat_ini)`.
- `piutang_delta = −settle` · `valuasi_delta = 0` · `unallocated = nominal − settle` · `needs_review = unallocated > 0`.

### 4.3 `PAYMENT` — mode A (`has_daily_sales = false`)

**(a) Ada rincian** (`breakdown_status = COMPLETE`):
`sold = Σ qty×harga` · `OutletTypeStock −= qty` (validasi cukup) · `valuasi_delta = −sold` · `selisih = sold − nominal`
- `selisih > 0` → `piutang_delta = +selisih`, `needs_review = true`
- `selisih ≤ 0` → `surplus = −selisih`; `settle = min(surplus, piutang)`; `piutang_delta = −settle`; `unallocated = surplus − settle`; `needs_review = unallocated > 0`
- Flag `settleOnly = true` (items kosong, pelunasan piutang murni) → `sold = 0`, seluruh nominal masuk jalur `selisih ≤ 0`.

**(b) Hanya nominal** (sales tidak kirim qty):
- Jika outlet hanya punya **1 jenis** berstok: `qty = floor(nominal ÷ harga)`, `breakdown_status = ESTIMATED`, `is_estimated = true`, lalu jalankan jalur (a).
- Selain itu: `breakdown_status = PENDING`, `needs_review = true`, stok & `piutang` **tidak** berubah, `valuasi_delta = 0`. `Outlet.valuasi_pending += nominal`.
- `completePendingPayment(txId, items)`: isi rincian → jalankan jalur (a) → `breakdown_status = COMPLETE` → `valuasi_pending −= nominal`.

### 4.4 `PIUTANG_MANUAL` (dulu `PIUTANG`)
`piutang_delta = ±amount`, tanpa efek stok. Wajib ada `description`.

### 4.5 `ADJUSTMENT` — stok opname
`OutletStockOpname` status `DRAFT` → `APPROVED` (oleh OWNER/ADMIN). Saat approve, per item: `OutletTypeStock.quantity = qty_actual`; tx `ADJUSTMENT` dengan `valuasi_delta = Σ selisih_value`, `piutang_delta = 0`. Rekomendasi tiap ±3 bulan.

### 4.6 Retur gudang (`WarehouseReturn`)
Per item: syarat `qty_reusable + qty_reject == qty_returned`.
- `WarehouseStock.quantity += qty_reusable` (+ `Product.stok`, + `StockTransaction` IN)
- `WarehouseStock.returned_qty += qty_reject` (= kerugian)
- Jika `source_type = OUTLET`: *(opsional, konfirmasi)* kurangi `OutletTypeStock` dengan tx `RETURN` (`valuasi_delta = −nilai`).
- **Ubah** `actions.ts:~899` dan `warehouse/page.tsx:~142`: `totalStock` hanya `quantity`, **jangan** `+ returned_qty`.

### 4.7 Produksi / tambah stok manual (`ProductionEntry`)
Tombol "Tambah Stok / Produksi" di warehouse (bukan via WA). Per entry: `WarehouseStock.quantity += qty`, `Product.stok += qty`, `StockTransaction` IN `PRODUCTION`. Rekap bulanan = `groupBy` bulan × produk dari `ProductionEntry`.

---

## 5. `recalculateOutletFinance(tx, outletId)` — versi baru

```ts
valuasi_stok    = Σ type_stocks: quantity * (harga_beli ?? product_type.base_price)
piutang         = max(0, Σ transactions.piutang_delta)
payment         = Σ transactions[type='PAYMENT'].amount
valuasi_pending = Σ transactions[type='PAYMENT' && breakdown_status='PENDING'].amount
sisa_tagihan    = piutang
tagihan         = payment + piutang
```

**Hapus** perilaku lama yang meng-UPDATE amount tx `BILLING` agar cocok dengan valuasi (`actions.ts` baris ~136–160).
Seragamkan juga jalur WA `PELUNASAN` (`route.ts:~1219`), jangan hitung `sisa` sendiri; panggil fungsi ini.

## 6. Test wajib (golden cases)

Siapkan jenis `G60` harga 20.000. Buat unit test untuk fungsi hitung murni.

| # | Skenario | Hasil |
|---|---|---|
| T1 | Mode A. Kirim 5 pcs → bayar 50.000 dengan 3 pcs terjual | valuasi 40.000 · piutang 10.000 · payment 50.000 · tagihan 60.000 · sisa_tagihan 10.000 · `needs_review` |
| T2 | Mode B. Kirim 5 pcs → SALE 3 pcs → bayar 20.000 | valuasi 40.000 · piutang 40.000 · payment 20.000 |
| T3 | Mode A, 2 jenis berstok, bayar 50.000 tanpa rincian | `PENDING` · valuasi_stok 100.000 · pending 50.000 · tampil 50.000 · lalu `completePendingPayment` 3 pcs → hasil sama dengan T1, pending 0 |
| T4 | Mode B, piutang 40.000, bayar 50.000 | piutang 0 · unallocated 10.000 · `needs_review` |
| T5 | Retur 10 pcs (5 layak, 5 reject) | `quantity` +5 · `returned_qty` +5 |
| T6 | SALE/PAYMENT qty > stok outlet | Error, tidak ada data tertulis |
| T7 | Mode A, piutang 10.000, `settleOnly` bayar 10.000 | piutang 0 · valuasi tidak berubah |

## 7. Migrasi (build repo memakai `prisma db push`)

Semua kolom baru nullable/ber-default, jadi `db push` tidak menghapus data.

1. Ganti `prisma/schema.prisma` dengan file baru → `prisma db push`.
2. Buat `ProductType` sesuai produk riil (dari transkrip: gramasi 60 gr, 20 gr, abon — **konfirmasi nama & harga**), lalu isi `Product.product_type_id` semua varian aktif.
3. Backfill `OutletTypeStock` = `Σ OutletStock.quantity` per jenis (harga: pakai `harga_beli` yang dominan di varian berstok, kalau beda-beda → `null`).
4. Ubah tipe tx lama: `PIUTANG → PIUTANG_MANUAL` (isi `piutang_delta = amount`), `PELUNASAN → PAYMENT`. Tx `BILLING` lama biarkan (diabaikan recalc).
5. Jalankan recalc untuk semua outlet.
6. **Catatan jujur:** pembayaran lama tidak punya rincian produk, jadi valuasi hasil backfill bisa lebih tinggi dari kenyataan. Lakukan **stok opname awal per outlet** sebagai titik nol baru (atau reset via `api/admin/reset-data` sebelum go-live).

## 8. File yang disentuh

| File | Perubahan |
|---|---|
| `prisma/schema.prisma` | Ganti dengan file baru |
| `src/lib/consignment/` *(baru)* | `constants.ts` (tipe tx), `finance.ts` (fungsi hitung murni + `postShipment/postSale/postPayment/completePendingPayment/applyOpname`) |
| `src/app/actions.ts` | `recalculateOutletFinance`, `addPiutang`, `addPelunasan`, `adjustOutletStock`, `resetOutletFinance` (reset juga `OutletTypeStock`), `totalStock` warehouse |
| `outlet/actions.ts` | `submitOutletPayment` → terima `items`, `settleOnly`; validasi selisih |
| `input/actions.ts` | `submitWarehouseInput` → `postShipment`; `updateOutletInput` yang menimpa `tagihan` langsung **dihapus/diarahkan** ke fungsi baru |
| `outlet/OutletManager.tsx` | Form bayar per jenis, form SALE (mode B), badge `needs_review`/`PENDING`, toggle `has_daily_sales`, tampil valuasi vs piutang terpisah |
| `api/webhook/whatsapp/route.ts` + `lib/ai-parser.ts` | Skema `PELUNASAN` tambah `items: [{jenis, qty}]`; tanpa items → jalur 4.3(b) |
| `warehouse/page.tsx` | Tombol Retur (layak/reject) dan Tambah Stok/Produksi + rekap bulanan |
| `overview` | Total per jenis (gudang / outlet / terjual), valuasi akumulasi per marketing, filter bulan |

## 9. Asumsi yang saya ambil (cek ke client)

1. Pembayaran mode A tanpa rincian di outlet multi-jenis → `PENDING` (bukan ditebak).
2. Pembayaran berlebih tidak hilang, ditandai `unallocated` + `needs_review`.
3. Piutang mode A hanya muncul dari selisih laporan, dan dilunasi lewat `settleOnly` atau surplus pembayaran berikutnya.
4. Harga per jenis bisa dioverride per outlet (`OutletTypeStock.harga_beli`).
5. Retur dari outlet ikut mengurangi stok outlet (4.6, opsional).
6. Daily sales tidak dibuat model sendiri; dicatat sebagai `OutletTransaction` tipe `SALE` + `period_start/end`.

## 10. Urutan prompt vibe coding (satu per sesi)

1. "Pakai `schema.prisma` ini, jalankan `db push`, buat seed `ProductType`, backfill `OutletTypeStock`." (§7)
2. "Buat `src/lib/consignment/finance.ts` berisi fungsi hitung murni sesuai §4–5 + unit test T1–T7 dulu, belum ubah UI."
3. "Refactor `recalculateOutletFinance` dan semua pemanggilnya ke fungsi baru." (§5, §8)
4. "Ubah form pembayaran outlet + tambah form SALE + badge review." 
5. "Update parser WA dan handler `PELUNASAN`."
6. "Tambah retur & produksi di warehouse, perbaiki `totalStock`."
7. "Update overview (total per jenis, valuasi per marketing, filter bulan)."
8. "Tambah stok opname outlet."

**Aturan untuk AI coder:** semua tulis ke DB lewat `$transaction`; Decimal dikonversi `Number()` seperti pola repo; jangan menyentuh field lama selain yang tercantum; jangan menambah model di luar schema ini tanpa bertanya.