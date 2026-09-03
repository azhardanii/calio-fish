import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifySession } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    const session = await verifySession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized: Harap login terlebih dahulu' }, { status: 401 });
    }

    const role = (session.role || '').toUpperCase();
    if (role !== 'OWNER' && role !== 'ADMIN') {
      return NextResponse.json({ error: 'Akses ditolak: Hanya OWNER atau ADMIN yang dapat mereset data operasional' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    if (body.confirmation !== 'RESET DATA') {
      return NextResponse.json({ error: 'Konfirmasi tidak valid. Harap ketik "RESET DATA"' }, { status: 400 });
    }

    // 1. Reset Mutasi & Logistik (Outbound, Items, Stock Transactions)
    const delOutboundItems = await prisma.outboundItem.deleteMany({});
    const delOutboundShipments = await prisma.outboundShipment.deleteMany({});
    const delStockTx = await prisma.stockTransaction.deleteMany({});

    // 2. Reset Produksi & Stok Bahan
    const delProduksi = await prisma.produksi.deleteMany({});
    const delStokBahan = await prisma.stokBahan.deleteMany({});

    // 3. Reset Laporan Marketing (Offline & Online)
    const delMarketingOffline = await prisma.marketingOffline.deleteMany({});
    const delMarketingOnline = await prisma.marketingOnline.deleteMany({});

    // 4. Reset Distribusi Sample & Jadwal KOL
    const delSample = await prisma.distribusiSample.deleteMany({});
    const delJadwalKOL = await prisma.jadwalKOL.deleteMany({});

    // 5. Reset Stok di Outlet menjadi 0 (Data Master Outlet & Transaksi Tagihan/Pelunasan TETAP AMAN)
    const resetOutletStocks = await prisma.outletStock.updateMany({
      data: { quantity: 0 },
    });
    const resetOutletOrder = await prisma.outlet.updateMany({
      data: { order_baru: 0 },
    });

    // 6. Reset Stok di Warehouse menjadi 0
    const resetWarehouseStocks = await prisma.warehouseStock.updateMany({
      data: { quantity: 0, returned_qty: 0 },
    });

    // 7. Reset Stok Utama Produk menjadi 0
    const resetProducts = await prisma.product.updateMany({
      data: { stok: 0 },
    });

    return NextResponse.json({
      success: true,
      message: 'Seluruh data operasional berhasil di-reset ke kondisi awal!',
      summary: {
        outboundItemsDeleted: delOutboundItems.count,
        outboundShipmentsDeleted: delOutboundShipments.count,
        stockTransactionsDeleted: delStockTx.count,
        produksiDeleted: delProduksi.count,
        stokBahanDeleted: delStokBahan.count,
        marketingOfflineDeleted: delMarketingOffline.count,
        marketingOnlineDeleted: delMarketingOnline.count,
        sampleDeleted: delSample.count,
        jadwalKolDeleted: delJadwalKOL.count,
        outletStocksReset: resetOutletStocks.count,
        outletsReset: resetOutletOrder.count,
        warehouseStocksReset: resetWarehouseStocks.count,
        productsStockReset: resetProducts.count,
      },
    });
  } catch (error: any) {
    console.error('Error saat reset data operasional:', error);
    return NextResponse.json({ error: error.message || 'Terjadi kesalahan pada server saat mereset data' }, { status: 500 });
  }
}
