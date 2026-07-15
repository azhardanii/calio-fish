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
  const filter = searchParams.get('filter') || 'this_month';
  const customMonth = searchParams.get('month') || '';
  const customYear = searchParams.get('year') || '';
  const now = new Date();

  let startDate: Date | undefined = undefined;
  let endDate: Date | undefined = undefined;
  let filterLabel = 'Keseluruhan Waktu';
  let isDailyChart = true;
  let monthsCount = 1;

  if (filter === 'this_month') {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    filterLabel = `Bulan Ini (${now.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })})`;
  } else if (filter === 'last_month') {
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    startDate = new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1);
    endDate = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0, 23, 59, 59, 999);
    filterLabel = `Bulan Lalu (${lastMonth.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })})`;
  } else if (filter === 'this_year') {
    startDate = new Date(now.getFullYear(), 0, 1);
    endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
    filterLabel = `Tahun Ini (${now.getFullYear()})`;
    isDailyChart = false;
    monthsCount = 12;
  } else if (filter === 'last_year') {
    startDate = new Date(now.getFullYear() - 1, 0, 1);
    endDate = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
    filterLabel = `Tahun Lalu (${now.getFullYear() - 1})`;
    isDailyChart = false;
    monthsCount = 12;
  } else if (filter === 'custom' && customMonth && customYear) {
    const y = parseInt(customYear, 10);
    const m = parseInt(customMonth, 10) - 1;
    startDate = new Date(y, m, 1);
    endDate = new Date(y, m + 1, 0, 23, 59, 59, 999);
    const d = new Date(y, m, 1);
    filterLabel = `${d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}`;
  } else {
    isDailyChart = false;
    monthsCount = 12;
  }

  const dateFilter = startDate && endDate ? { gte: startDate, lte: endDate } : undefined;
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  const [baseOfflineTarget, baseShopeeTarget, baseTiktokTarget] = await Promise.all([
    getOfflineTarget(), getOnlineTarget('shopee'), getOnlineTarget('tiktok'),
  ]);

  const [
    offlineToday, offlineFilterAgg, latestOffline,
    onlineFilterAgg, onlineTodayAgg,
    offlineDaily, onlineDaily,
    totalOutlets, outletTagihanAgg,
    products, warehouses, outlets,
    totalEmployees, attendanceToday,
    recentOffline, recentOnline, recentAttendance, recentProduksi,
    onlineFilterByPlatform,
  ] = await Promise.all([
    prisma.marketingOffline.findFirst({ where: { date: { gte: todayStart, lte: todayEnd } }, orderBy: { created_at: 'desc' } }),
    prisma.marketingOffline.aggregate({ _sum: { omset_harian: true, target_bulanan: true }, where: dateFilter ? { date: dateFilter } : {} }),
    prisma.marketingOffline.findFirst({ where: dateFilter ? { date: dateFilter } : {}, orderBy: { date: 'desc' } }),
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
  ]);

  // Chart data
  const chartMap = new Map<string, { date: string; offline: number; online: number; displayDate: string }>();
  for (const r of offlineDaily) {
    const d = new Date(r.date);
    const key = isDailyChart ? d.toISOString().slice(0, 10) : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const displayDate = isDailyChart
      ? d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })
      : d.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' });
    const entry = chartMap.get(key) || { date: key, displayDate, offline: 0, online: 0 };
    entry.offline += toNum(r.omset_harian);
    chartMap.set(key, entry);
  }
  for (const r of onlineDaily) {
    const d = new Date(r.date);
    const key = isDailyChart ? d.toISOString().slice(0, 10) : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const displayDate = isDailyChart
      ? d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })
      : d.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' });
    const entry = chartMap.get(key) || { date: key, displayDate, offline: 0, online: 0 };
    entry.online += toNum(r.omset_harian);
    chartMap.set(key, entry);
  }
  const chartData = Array.from(chartMap.values()).sort((a, b) => a.date.localeCompare(b.date));

  // Stock distribution
  let totalKerugian = 0, factoryStok = 0, storageStok = 0, outletStok = 0;
  warehouses.forEach(w => {
    w.stocks.forEach(s => {
      totalKerugian += (s.returned_qty * Number(s.product.base_price));
      if (w.type === 'FACTORY') factoryStok += s.quantity;
      else storageStok += s.quantity;
    });
  });
  outlets.forEach(o => { o.stocks.forEach(s => { outletStok += s.quantity; }); });

  const hadirToday = attendanceToday.filter(a => a.status_kehadiran.toUpperCase() === 'HADIR').length;

  // Feed
  type FeedItem = { type: string; title: string; sub: string; time: string; color: string };
  const feed: FeedItem[] = [];
  for (const r of recentOffline) {
    feed.push({ type: '📊', title: `Marketing Offline: Rp ${toNum(r.omset_harian).toLocaleString('id-ID')}`, sub: `Laporan ${new Date(r.date).toLocaleDateString('id-ID')}`, time: new Date(r.created_at).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }), color: 'fi-blue' });
  }
  for (const r of recentOnline) {
    feed.push({ type: '🛒', title: `${r.platform.charAt(0).toUpperCase() + r.platform.slice(1)}: Rp ${toNum(r.omset_harian).toLocaleString('id-ID')}`, sub: `Laporan ${new Date(r.date).toLocaleDateString('id-ID')}`, time: new Date(r.created_at).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }), color: 'fi-cyan' });
  }
  for (const r of recentAttendance) {
    feed.push({ type: r.status_kehadiran.toUpperCase() === 'HADIR' ? '✅' : '⚠️', title: `${r.employee.nama} — ${r.status_kehadiran}`, sub: r.alasan || 'Presensi harian', time: new Date(r.created_at).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }), color: r.status_kehadiran.toUpperCase() === 'HADIR' ? 'fi-green' : 'fi-yellow' });
  }
  for (const r of recentProduksi) {
    feed.push({ type: '🏭', title: `Produksi: ${r.kegiatan}`, sub: r.total_hasil_pcs ? `${r.total_hasil_pcs} pcs` : `Tanggal ${new Date(r.date).toLocaleDateString('id-ID')}`, time: new Date(r.created_at).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }), color: 'fi-yellow' });
  }
  feed.sort((a, b) => b.time.localeCompare(a.time));

  // Progress
  const offlineTarget = baseOfflineTarget * monthsCount;
  const offlineOmset = toNum(offlineFilterAgg._sum.omset_harian);
  const shopeeTarget = baseShopeeTarget * monthsCount;
  const tiktokTarget = baseTiktokTarget * monthsCount;
  const shopeeOmset = toNum(onlineFilterByPlatform.find(x => x.platform === 'shopee')?._sum.omset_harian);
  const tiktokOmset = toNum(onlineFilterByPlatform.find(x => x.platform === 'tiktok')?._sum.omset_harian);
  const omsetHariIni = toNum(offlineToday?.omset_harian) + toNum(onlineTodayAgg._sum.omset_harian);
  const totalOmset = offlineOmset + shopeeOmset + tiktokOmset;
  const totalTarget = offlineTarget + shopeeTarget + tiktokTarget;
  const totalGap = totalOmset - totalTarget;
  const totalPersentase = totalTarget > 0 ? (totalOmset / totalTarget) * 100 : 0;

  let highlightTitle = 'Omset Hari Ini';
  let highlightValue = omsetHariIni;
  let highlightNote = omsetHariIni > 0 ? '📈 Ada pemasukan hari ini' : '— Belum ada data';
  let highlightUp = omsetHariIni > 0;

  if (filter !== 'this_month') {
    highlightTitle = 'Rata-rata Harian';
    let days = 1;
    if (startDate && endDate) {
      days = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
    } else {
      const firstRecord = await prisma.marketingOffline.findFirst({ orderBy: { date: 'asc' } });
      if (firstRecord) {
        days = Math.max(1, Math.ceil((now.getTime() - new Date(firstRecord.date).getTime()) / (1000 * 60 * 60 * 24)));
      }
    }
    highlightValue = days > 0 ? totalOmset / days : 0;
    highlightNote = 'Berdasarkan filter aktif';
    highlightUp = highlightValue > 0;
  }

  const lowStockProducts = products.filter(p => p.stok <= 50);

  const data = {
    filterState: { filter, month: customMonth, year: customYear, filterLabel },
    highlightOmset: { title: highlightTitle, value: highlightValue, note: highlightNote, isUp: highlightUp },
    totalOmset, totalTarget, totalGap,
    totalPersentase: Math.round(totalPersentase * 10) / 10,
    channels: [
      { name: 'Offline (Outlet)', mtd: offlineOmset, target: offlineTarget },
      { name: 'Shopee', mtd: shopeeOmset, target: shopeeTarget },
      { name: 'TikTok', mtd: tiktokOmset, target: tiktokTarget },
    ],
    chartData, totalOutlets,
    totalSisaTagihan: toNum(outletTagihanAgg._sum.sisa_tagihan),
    totalEmployees, hadirToday,
    attendanceTodayCount: attendanceToday.length,
    lowStockProducts: lowStockProducts.map(p => ({ name: p.short_name || p.name, stok: p.stok })),
    allProducts: products.map(p => ({ name: p.short_name || p.name, stok: p.stok })),
    stockDistribution: { factoryStok, storageStok, outletStok, totalKerugian },
    recentFeed: feed.slice(0, 8),
  };

  return NextResponse.json(data);
}
