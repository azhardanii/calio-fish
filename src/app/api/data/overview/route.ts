import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getOfflineTarget, getOnlineTarget } from '@/lib/settings';
import { serializeDeep } from '@/lib/serialize';

function toNum(val: any): number {
  if (val === null || val === undefined) return 0;
  return Number(val);
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const fromParam = searchParams.get('from');
  const toParam = searchParams.get('to');
  const now = new Date();

  let startDate: Date | undefined = undefined;
  let endDate: Date | undefined = undefined;
  let filterLabel = 'Lifetime (Keseluruhan Waktu)';
  let isDailyChart = true;
  let monthsCount = 1;

  if (fromParam && toParam) {
    startDate = new Date(fromParam);
    startDate.setHours(0, 0, 0, 0);
    endDate = new Date(toParam);
    endDate.setHours(23, 59, 59, 999);
    
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    monthsCount = Math.max(1, diffDays / 30);
    if (diffDays > 31) {
      isDailyChart = false;
    }

    if (fromParam === toParam) {
       filterLabel = startDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    } else {
       filterLabel = `${startDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })} - ${endDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    }
  } else if (searchParams.get('lifetime') === 'true') {
    isDailyChart = false;
    monthsCount = 12;
  } else {
    // Default to this month
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    startDate = new Date(currentYear, currentMonth, 1);
    endDate = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59, 999);
    monthsCount = 1;
    filterLabel = startDate.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  }

  const dateFilter = startDate && endDate ? { gte: startDate, lte: endDate } : undefined;
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  const [baseOfflineTarget, baseShopeeTarget, baseTiktokTarget] = await Promise.all([
    getOfflineTarget(), getOnlineTarget('shopee'), getOnlineTarget('tiktok'),
  ]);

  const [
    offlineToday, offlineFilterAgg,
    onlineFilterAgg, onlineTodayAgg,
    offlineDaily, onlineDaily,
    totalOutlets, outletTagihanAgg,
    products, warehouses, outlets,
    totalEmployees, attendanceToday,
    recentOffline, recentOnline, recentAttendance, recentProduksi,
    onlineFilterByPlatform,
    shipmentsData,
    // NEW: Personal Buyer
    personalBuyerAgg, personalBuyerToday, personalBuyerDaily, recentPersonalBuyer,
    // NEW: Event & Open Booth
    boothSalesAgg, boothSalesToday, boothSalesDaily, recentBoothSales,
    activeBoothCount, totalBoothCount, boothStockAgg,
    // NEW: Kas Masuk Pelunasan Outlet
    outletPaymentAgg, recentOutletPayments
  ] = await Promise.all([
    prisma.marketingOffline.findFirst({ where: { date: { gte: todayStart, lte: todayEnd } }, orderBy: { created_at: 'desc' } }),
    prisma.marketingOffline.aggregate({ _sum: { omset_harian: true, target_bulanan: true }, where: dateFilter ? { date: dateFilter } : {} }),
    prisma.marketingOnline.aggregate({ _sum: { omset_harian: true }, where: dateFilter ? { date: dateFilter } : {} }),
    prisma.marketingOnline.aggregate({ _sum: { omset_harian: true }, where: { date: { gte: todayStart, lte: todayEnd } } }),
    prisma.marketingOffline.findMany({ where: dateFilter ? { date: dateFilter } : {}, orderBy: { date: 'asc' }, select: { date: true, omset_harian: true } }),
    prisma.marketingOnline.findMany({ where: dateFilter ? { date: dateFilter } : {}, orderBy: { date: 'asc' }, select: { date: true, omset_harian: true, platform: true } }),
    prisma.outlet.count(),
    prisma.outlet.aggregate({ _sum: { sisa_tagihan: true } }),
    prisma.product.findMany({ where: { is_active: true }, select: { name: true, short_name: true, stok: true, base_price: true }, orderBy: { stok: 'asc' } }),
    prisma.warehouse.findMany({ include: { stocks: { include: { product: true } } } }),
    prisma.outlet.findMany({ include: { stocks: { include: { product: true } } } }),
    prisma.employee.count({ where: { status_aktif: true } }),
    prisma.attendance.findMany({ where: { date: { gte: todayStart, lte: todayEnd } }, include: { employee: { select: { nama: true } } } }),
    prisma.marketingOffline.findMany({ take: 3, orderBy: { created_at: 'desc' }, select: { date: true, omset_harian: true, created_at: true } }),
    prisma.marketingOnline.findMany({ take: 3, orderBy: { created_at: 'desc' }, select: { date: true, platform: true, omset_harian: true, created_at: true } }),
    prisma.attendance.findMany({ take: 3, orderBy: { created_at: 'desc' }, include: { employee: { select: { nama: true } } } }),
    prisma.produksi.findMany({ take: 2, orderBy: { created_at: 'desc' }, select: { date: true, kegiatan: true, total_hasil_pcs: true, created_at: true } }),
    prisma.marketingOnline.groupBy({ by: ['platform'], _sum: { omset_harian: true }, where: dateFilter ? { date: dateFilter } : {} }),
    prisma.outboundShipment.findMany({ where: dateFilter ? { date: dateFilter } : {}, include: { items: true } }),

    // Personal Buyer
    prisma.personalBuyerTransaction.aggregate({ _sum: { amount: true }, where: dateFilter ? { date: dateFilter } : {} }),
    prisma.personalBuyerTransaction.aggregate({ _sum: { amount: true }, where: { date: { gte: todayStart, lte: todayEnd } } }),
    prisma.personalBuyerTransaction.findMany({ where: dateFilter ? { date: dateFilter } : {}, orderBy: { date: 'asc' }, select: { date: true, amount: true, buyer_name: true } }),
    prisma.personalBuyerTransaction.findMany({ take: 3, orderBy: { created_at: 'desc' }, select: { amount: true, buyer_name: true, date: true, created_at: true } }),

    // Event & Open Booth
    prisma.boothSale.aggregate({ _sum: { total_price: true }, where: dateFilter ? { date: dateFilter } : {} }),
    prisma.boothSale.aggregate({ _sum: { total_price: true }, where: { date: { gte: todayStart, lte: todayEnd } } }),
    prisma.boothSale.findMany({ where: dateFilter ? { date: dateFilter } : {}, orderBy: { date: 'asc' }, select: { date: true, total_price: true, item_name: true } }),
    prisma.boothSale.findMany({ take: 3, orderBy: { created_at: 'desc' }, select: { total_price: true, item_name: true, date: true, created_at: true, booth: { select: { nama: true } } } }),
    prisma.eventBooth.count({ where: { status: 'AKTIF' } }),
    prisma.eventBooth.count(),
    prisma.boothStock.aggregate({ _sum: { quantity: true }, where: { booth: { status: 'AKTIF' } } }),

    // Kas Masuk Outlet Payment
    prisma.outletTransaction.aggregate({ _sum: { amount: true }, where: { type: 'PAYMENT', ...(dateFilter ? { date: dateFilter } : {}) } }),
    prisma.outletTransaction.findMany({ where: { type: 'PAYMENT' }, take: 3, orderBy: { created_at: 'desc' }, select: { amount: true, date: true, created_at: true, outlet: { select: { nama: true } } } }),
  ]);

  // Calculations: Revenue per channel
  const offlineTarget = baseOfflineTarget * monthsCount;
  const offlineOmset = toNum(offlineFilterAgg._sum.omset_harian);
  const shopeeTarget = baseShopeeTarget * monthsCount;
  const tiktokTarget = baseTiktokTarget * monthsCount;
  const shopeeOmset = toNum(onlineFilterByPlatform.find(x => x.platform === 'shopee')?._sum.omset_harian);
  const tiktokOmset = toNum(onlineFilterByPlatform.find(x => x.platform === 'tiktok')?._sum.omset_harian);
  const personalBuyerOmset = toNum(personalBuyerAgg._sum.amount);
  const boothOmset = toNum(boothSalesAgg._sum.total_price);

  // Total Omset (Seluruh Jalur Penjualan: B2B Outlet + Shopee + TikTok + Personal Buyer + Event Booth)
  const totalOmset = offlineOmset + shopeeOmset + tiktokOmset + personalBuyerOmset + boothOmset;
  const totalTarget = offlineTarget + shopeeTarget + tiktokTarget;
  const totalGap = totalOmset - totalTarget;
  const totalPersentase = totalTarget > 0 ? (totalOmset / totalTarget) * 100 : 0;

  // Kas Masuk (Dana Cair / Kas Terkumpul)
  const kasPelunasanOutlet = toNum(outletPaymentAgg._sum.amount);
  const kasBooth = boothOmset; // Penjualan booth langsung tunai / QRIS / transfer
  const kasPersonalBuyer = personalBuyerOmset; // Penjualan langsung perorangan
  const kasEcommerce = shopeeOmset + tiktokOmset; // Penjualan online
  const totalKasMasuk = kasPelunasanOutlet + kasBooth + kasPersonalBuyer + kasEcommerce;
  const totalSisaTagihan = toNum(outletTagihanAgg._sum.sisa_tagihan);

  // Omset Hari Ini
  const omsetHariIni = toNum(offlineToday?.omset_harian) + 
    toNum(onlineTodayAgg._sum.omset_harian) + 
    toNum(personalBuyerToday._sum.amount) + 
    toNum(boothSalesToday._sum.total_price);

  // Chart data
  const chartMap = new Map<string, { date: string; displayDate: string; offline: number; online: number; booth: number; personal: number; total: number }>();
  
  const addChartPoint = (date: Date, type: 'offline' | 'online' | 'booth' | 'personal', amount: number) => {
    const key = isDailyChart ? date.toISOString().slice(0, 10) : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const displayDate = isDailyChart
      ? date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })
      : date.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' });
    const entry = chartMap.get(key) || { date: key, displayDate, offline: 0, online: 0, booth: 0, personal: 0, total: 0 };
    entry[type] += amount;
    entry.total += amount;
    chartMap.set(key, entry);
  };

  for (const r of offlineDaily) addChartPoint(new Date(r.date), 'offline', toNum(r.omset_harian));
  for (const r of onlineDaily) addChartPoint(new Date(r.date), 'online', toNum(r.omset_harian));
  for (const r of boothSalesDaily) addChartPoint(new Date(r.date), 'booth', toNum(r.total_price));
  for (const r of personalBuyerDaily) addChartPoint(new Date(r.date), 'personal', toNum(r.amount));

  const chartData = Array.from(chartMap.values()).sort((a, b) => a.date.localeCompare(b.date));

  // Dynamic Stock distribution
  let totalKerugian = 0;
  let factoryStok = 0;
  let storageStok = 0;
  let outletStok = 0;
  const boothStok = toNum(boothStockAgg._sum.quantity);

  const warehouseSummary = warehouses.map(w => {
    let wStock = 0;
    w.stocks.forEach(s => {
      wStock += s.quantity;
      totalKerugian += (s.returned_qty * Number(s.product.base_price));
      if (w.type === 'FACTORY') factoryStok += s.quantity;
      else storageStok += s.quantity;
    });
    return {
      id: w.id,
      name: w.name,
      type: w.type,
      stock: wStock,
    };
  });

  outlets.forEach(o => { o.stocks.forEach(s => { outletStok += s.quantity; }); });
  const totalStokFisikEkosistem = factoryStok + storageStok + boothStok + outletStok;

  const hadirToday = attendanceToday.filter(a => a.status_kehadiran.toUpperCase() === 'HADIR').length;

  // Recent Activity Feed
  type FeedItem = { type: string; title: string; sub: string; time: string; color: string; rawDate: string };
  const feed: FeedItem[] = [];

  for (const r of recentOffline) {
    feed.push({ 
      type: '📊', 
      title: `Marketing B2B: Rp ${toNum(r.omset_harian).toLocaleString('id-ID')}`, 
      sub: `Laporan Outlet ${new Date(r.date).toLocaleDateString('id-ID')}`, 
      time: new Date(r.created_at).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }), 
      rawDate: new Date(r.created_at).toISOString(),
      color: 'fi-blue' 
    });
  }
  for (const r of recentOnline) {
    feed.push({ 
      type: '🛒', 
      title: `${r.platform.charAt(0).toUpperCase() + r.platform.slice(1)}: Rp ${toNum(r.omset_harian).toLocaleString('id-ID')}`, 
      sub: `Laporan Online ${new Date(r.date).toLocaleDateString('id-ID')}`, 
      time: new Date(r.created_at).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }), 
      rawDate: new Date(r.created_at).toISOString(),
      color: 'fi-cyan' 
    });
  }
  for (const r of recentBoothSales) {
    feed.push({ 
      type: '🎪', 
      title: `Event Booth: Rp ${toNum(r.total_price).toLocaleString('id-ID')}`, 
      sub: `${r.booth?.nama || 'Booth'} • ${r.item_name}`, 
      time: new Date(r.created_at).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }), 
      rawDate: new Date(r.created_at).toISOString(),
      color: 'fi-green' 
    });
  }
  for (const r of recentPersonalBuyer) {
    feed.push({ 
      type: '👤', 
      title: `Personal Buyer: Rp ${toNum(r.amount).toLocaleString('id-ID')}`, 
      sub: `Pembeli: ${r.buyer_name}`, 
      time: new Date(r.created_at).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }), 
      rawDate: new Date(r.created_at).toISOString(),
      color: 'fi-blue' 
    });
  }
  for (const r of recentOutletPayments) {
    feed.push({ 
      type: '💵', 
      title: `Pelunasan Outlet: Rp ${toNum(r.amount).toLocaleString('id-ID')}`, 
      sub: `${r.outlet?.nama || 'Outlet Mitra'}`, 
      time: new Date(r.created_at).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }), 
      rawDate: new Date(r.created_at).toISOString(),
      color: 'fi-green' 
    });
  }
  for (const r of recentAttendance) {
    feed.push({ 
      type: r.status_kehadiran.toUpperCase() === 'HADIR' ? '✅' : '⚠️', 
      title: `${r.employee.nama} — ${r.status_kehadiran}`, 
      sub: r.alasan || 'Presensi harian', 
      time: new Date(r.created_at).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }), 
      rawDate: new Date(r.created_at).toISOString(),
      color: r.status_kehadiran.toUpperCase() === 'HADIR' ? 'fi-green' : 'fi-yellow' 
    });
  }
  for (const r of recentProduksi) {
    feed.push({ 
      type: '🏭', 
      title: `Produksi: ${r.kegiatan}`, 
      sub: r.total_hasil_pcs ? `${r.total_hasil_pcs} pcs` : `Tanggal ${new Date(r.date).toLocaleDateString('id-ID')}`, 
      time: new Date(r.created_at).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }), 
      rawDate: new Date(r.created_at).toISOString(),
      color: 'fi-yellow' 
    });
  }
  feed.sort((a, b) => b.rawDate.localeCompare(a.rawDate));

  let highlightTitle = 'Omset Hari Ini';
  let highlightValue = omsetHariIni;
  let highlightNote = omsetHariIni > 0 ? '📈 Pemasukan tercatat hari ini' : '— Belum ada data hari ini';
  let highlightUp = omsetHariIni > 0;

  if (fromParam && toParam) {
    if (fromParam === toParam && fromParam === todayStart.toISOString().slice(0, 10)) {
      highlightTitle = 'Omset Hari Ini';
    } else if (fromParam === toParam) {
      highlightTitle = 'Omset Pada Tanggal';
      highlightValue = totalOmset;
      highlightNote = `Tanggal ${startDate?.toLocaleDateString('id-ID')}`;
    } else {
      highlightTitle = 'Rata-rata Harian';
      let days = 1;
      if (startDate && endDate) {
        days = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
      }
      highlightValue = days > 0 ? totalOmset / days : 0;
      highlightNote = 'Berdasarkan filter aktif';
    }
  }

  const lowStockProducts = products.filter(p => p.stok <= 50);

  const data = {
    filterState: { from: fromParam, to: toParam, filterLabel },
    highlightOmset: { title: highlightTitle, value: highlightValue, note: highlightNote, isUp: highlightUp },
    totalOmset, 
    totalTarget, 
    totalGap,
    totalPersentase: Math.round(totalPersentase * 10) / 10,

    // Channels breakdown
    channels: [
      { name: 'B2B Outlet Mitra', mtd: offlineOmset, target: offlineTarget, icon: '🏪', pct: totalOmset > 0 ? Math.round((offlineOmset / totalOmset) * 100) : 0 },
      { name: 'Shopee Official', mtd: shopeeOmset, target: shopeeTarget, icon: '🛒', pct: totalOmset > 0 ? Math.round((shopeeOmset / totalOmset) * 100) : 0 },
      { name: 'TikTok Shop', mtd: tiktokOmset, target: tiktokTarget, icon: '📱', pct: totalOmset > 0 ? Math.round((tiktokOmset / totalOmset) * 100) : 0 },
      { name: 'Event & Open Booth', mtd: boothOmset, target: 0, icon: '🎪', pct: totalOmset > 0 ? Math.round((boothOmset / totalOmset) * 100) : 0 },
      { name: 'Personal Buyer Direct', mtd: personalBuyerOmset, target: 0, icon: '👤', pct: totalOmset > 0 ? Math.round((personalBuyerOmset / totalOmset) * 100) : 0 },
    ],

    // Financial Health: Kas Masuk vs Piutang
    financials: {
      totalOmset,
      totalKasMasuk,
      totalSisaTagihan,
      kasPelunasanOutlet,
      kasBooth,
      kasPersonalBuyer,
      kasEcommerce,
    },

    // Event & Booth Summary
    boothSummary: {
      activeBoothCount,
      totalBoothCount,
      boothOmset,
      boothStok,
    },

    chartData, 
    totalOutlets,
    totalSisaTagihan,
    totalEmployees, 
    hadirToday,
    attendanceTodayCount: attendanceToday.length,
    lowStockProducts: lowStockProducts.map(p => ({ name: p.short_name || p.name, stok: p.stok })),
    allProducts: products.map(p => ({ name: p.short_name || p.name, stok: p.stok })),

    // Stock Ecosystem
    stockDistribution: { 
      factoryStok, 
      storageStok, 
      boothStok,
      outletStok, 
      totalStokFisikEkosistem,
      totalKerugian,
      warehouses: warehouseSummary 
    },

    recentFeed: feed.slice(0, 10),
    totalShipments: shipmentsData.length,
    totalItemsSent: shipmentsData.reduce((acc, curr) => acc + curr.items.reduce((sum, item) => sum + item.qty, 0), 0),
  };

  return NextResponse.json(serializeDeep(data));
}
