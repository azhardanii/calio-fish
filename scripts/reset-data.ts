import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function resetOperationalData() {
  console.log('=== MEMULAI RESET DATA OPERASIONAL CALIO FISH ===\n');

  try {
    // 1. Reset Mutasi & Logistik (Outbound, Items, Stock Transactions)
    console.log('1. Menghapus riwayat pengiriman dan mutasi stok...');
    const delOutboundItems = await prisma.outboundItem.deleteMany({});
    console.log(`   - OutboundItem terhapus: ${delOutboundItems.count}`);

    const delOutboundShipments = await prisma.outboundShipment.deleteMany({});
    console.log(`   - OutboundShipment terhapus: ${delOutboundShipments.count}`);

    const delStockTx = await prisma.stockTransaction.deleteMany({});
    console.log(`   - StockTransaction terhapus: ${delStockTx.count}`);

    // 2. Reset Produksi & Stok Bahan
    console.log('2. Menghapus catatan produksi & stok bahan...');
    const delProduksi = await prisma.produksi.deleteMany({});
    console.log(`   - Produksi terhapus: ${delProduksi.count}`);

    const delStokBahan = await prisma.stokBahan.deleteMany({});
    console.log(`   - StokBahan terhapus: ${delStokBahan.count}`);

    // 3. Reset Laporan Marketing (Offline & Online)
    console.log('3. Menghapus laporan marketing...');
    const delMarketingOffline = await prisma.marketingOffline.deleteMany({});
    console.log(`   - MarketingOffline terhapus: ${delMarketingOffline.count}`);

    const delMarketingOnline = await prisma.marketingOnline.deleteMany({});
    console.log(`   - MarketingOnline terhapus: ${delMarketingOnline.count}`);

    // 4. Reset Distribusi Sample & KOL
    console.log('4. Menghapus distribusi sample & jadwal KOL...');
    const delSample = await prisma.distribusiSample.deleteMany({});
    console.log(`   - DistribusiSample terhapus: ${delSample.count}`);

    const delJadwalKOL = await prisma.jadwalKOL.deleteMany({});
    console.log(`   - JadwalKOL terhapus: ${delJadwalKOL.count}`);

    // 5. Reset Stok di Outlet menjadi 0 (Data Outlet & Transaksi Tagihan/Pelunasan TETAP AMAN)
    console.log('5. Mengubah stok di seluruh outlet menjadi 0...');
    const resetOutletStocks = await prisma.outletStock.updateMany({
      data: { quantity: 0 }
    });
    console.log(`   - OutletStock di-set 0: ${resetOutletStocks.count} baris`);

    const resetOutletOrder = await prisma.outlet.updateMany({
      data: { order_baru: 0 }
    });
    console.log(`   - Outlet order_baru di-reset: ${resetOutletOrder.count} outlet`);
    console.log('   (Catatan: Data tagihan, pembayaran, sisa tagihan, dan histori OutletTransaction tetap tersimpan utuh!)');

    // 6. Reset Stok di Warehouse menjadi 0
    console.log('6. Mengubah stok di gudang/warehouse menjadi 0...');
    const resetWarehouseStocks = await prisma.warehouseStock.updateMany({
      data: { quantity: 0, returned_qty: 0 }
    });
    console.log(`   - WarehouseStock di-set 0: ${resetWarehouseStocks.count} baris`);

    // 7. Reset Stok Utama Produk menjadi 0
    console.log('7. Mengubah stok produk menjadi 0...');
    const resetProducts = await prisma.product.updateMany({
      data: { stok: 0 }
    });
    console.log(`   - Product master stok di-set 0: ${resetProducts.count} produk`);

    // 8. Cek database yang TIDAK disentuh
    const employeeCount = await prisma.employee.count();
    const outletCount = await prisma.outlet.count();
    const txCount = await prisma.outletTransaction.count();
    const reportSettingsCount = await prisma.reportSettings.count();
    const systemSettingsCount = await prisma.systemSetting.count();

    console.log('\n=== STATUS DATA YANG DIPERTAHANKAN (AMAN) ===');
    console.log(`✓ Karyawan (Employee)        : ${employeeCount} orang`);
    console.log(`✓ Outlet                     : ${outletCount} outlet`);
    console.log(`✓ Transaksi Tagihan/Pelunasan : ${txCount} transaksi`);
    console.log(`✓ Pengaturan Laporan         : ${reportSettingsCount} setting`);
    console.log(`✓ Pengaturan Sistem          : ${systemSettingsCount} setting`);
    console.log('\n=== RESET SELESAI DENGAN SUKSES! ===');

  } catch (error) {
    console.error('\n❌ Terjadi kesalahan saat reset data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

resetOperationalData();
