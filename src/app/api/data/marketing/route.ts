import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { serializeDeep } from '@/lib/serialize';
import { getOnlineTarget } from '@/lib/settings';
import { verifySession } from '@/lib/auth';

export async function GET() {
  const user = await verifySession();
  const role = (user?.role || '').toUpperCase();
  const isOwnerOrAdmin = role === 'OWNER' || role === 'ADMIN';
  const isMarketing = role === 'MARKETING' || role.includes('MARKETING');

  const now = new Date();
  const currentMonth = now.getMonth() + 1; // 1-12
  const currentYear = now.getFullYear();

  // Fetch marketing employees with their outlets, targets, personal buyer txns
  const marketingEmployees = await prisma.employee.findMany({
    where: {
      OR: [
        { role: 'MARKETING' },
        { role: { contains: 'MARKETING' } },
        { posisi: { contains: 'Marketing', mode: 'insensitive' } },
      ],
      status_aktif: true,
    },
    include: {
      managed_outlets: {
        include: {
          stocks: { include: { product: true } },
          transactions: { orderBy: { date: 'desc' } },
        }
      },
      marketing_targets: {
        where: { bulan: currentMonth, tahun: currentYear }
      },
      personal_buyer_transactions: {
        orderBy: { date: 'desc' },
      },
      managed_booths: {
        include: {
          sales: { orderBy: { date: 'desc' } }
        }
      },
    },
    orderBy: { nama: 'asc' },
  });

  // Build performance summary for each marketing user
  const marketingPerformance = marketingEmployees.map(emp => {
    const target = emp.marketing_targets[0];
    const targetOmset = target ? Number(target.target_omset) : 0;

    // Calculate outlet-based omset this month from OutletTransactions
    const monthStart = new Date(currentYear, currentMonth - 1, 1);
    const monthEnd = new Date(currentYear, currentMonth, 0, 23, 59, 59, 999);

    let totalBillingThisMonth = 0;
    let totalPaymentThisMonth = 0;
    let totalOutstandingAll = 0;
    let totalTagihanAll = 0;
    let totalPaymentAll = 0;

    emp.managed_outlets.forEach(outlet => {
      totalTagihanAll += Number(outlet.tagihan);
      totalPaymentAll += Number(outlet.payment);
      totalOutstandingAll += Number(outlet.sisa_tagihan);

      outlet.transactions.forEach(tx => {
        const txDate = new Date(tx.date);
        if (txDate >= monthStart && txDate <= monthEnd) {
          if (tx.type === 'PIUTANG' || tx.type === 'BILLING' || tx.type === 'TAGIHAN') {
            totalBillingThisMonth += Number(tx.amount);
          } else if (tx.type === 'PELUNASAN' || tx.type === 'PAYMENT') {
            totalPaymentThisMonth += Number(tx.amount);
          }
        }
      });
    });

    // Personal buyer omset this month
    const personalBuyerThisMonth = emp.personal_buyer_transactions
      .filter(t => {
        const d = new Date(t.date);
        return d >= monthStart && d <= monthEnd;
      })
      .reduce((sum, t) => sum + Number(t.amount), 0);

    // Booth sales this month (where this marketing employee is PIC) -> Langsung masuk ke cashflow perusahaan
    const boothSalesThisMonth = emp.managed_booths.reduce((sum, b) => {
      const bMonthSales = b.sales
        .filter(s => {
          const d = new Date(s.date);
          return d >= monthStart && d <= monthEnd;
        })
        .reduce((sSum, s) => sSum + Number(s.total_price), 0);
      return sum + bMonthSales;
    }, 0);

    // Performa omset marketing: HANYA dari Outlet yang dikelola + Personal Buyer
    // Transaksi Event/Booth tidak masuk ke omset performa staf, melainkan langsung ke cashflow perusahaan
    const totalOmsetThisMonth = totalBillingThisMonth + personalBuyerThisMonth;
    const pencapaian = targetOmset > 0 ? (totalOmsetThisMonth / targetOmset) * 100 : 0;
    const gap = totalOmsetThisMonth - targetOmset;

    // Determine status
    let status: 'on_track' | 'behind' | 'critical' = 'on_track';
    if (targetOmset > 0) {
      const dayOfMonth = now.getDate();
      const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
      const expectedProgress = (dayOfMonth / daysInMonth) * 100;
      if (pencapaian < expectedProgress * 0.5) status = 'critical';
      else if (pencapaian < expectedProgress * 0.8) status = 'behind';
    }

    return {
      id: emp.id,
      nama: emp.nama,
      posisi: emp.posisi,
      no_hp: emp.no_hp,
      outlets: emp.managed_outlets.map(o => ({
        id: o.id,
        nama: o.nama,
        tagihan: Number(o.tagihan),
        payment: Number(o.payment),
        sisa_tagihan: Number(o.sisa_tagihan),
        status: o.status,
        wilayah: o.wilayah,
      })),
      target_omset: targetOmset,
      total_billing_this_month: totalBillingThisMonth,
      total_payment_this_month: totalPaymentThisMonth,
      personal_buyer_this_month: personalBuyerThisMonth,
      booth_sales_this_month: boothSalesThisMonth,
      total_omset_this_month: totalOmsetThisMonth,
      pencapaian,
      gap,
      status,
      total_tagihan_all: totalTagihanAll,
      total_payment_all: totalPaymentAll,
      total_outstanding_all: totalOutstandingAll,
      outlet_count: emp.managed_outlets.length,
      booth_count: emp.managed_booths.length,
      personal_buyer_transactions: emp.personal_buyer_transactions.map(t => ({
        id: t.id,
        buyer_name: t.buyer_name,
        product_name: (t as any).product_name || null,
        quantity: (t as any).quantity || 1,
        price_per_unit: (t as any).price_per_unit ? Number((t as any).price_per_unit) : null,
        amount: Number(t.amount),
        description: t.description,
        date: t.date,
      })),
      managed_booths: emp.managed_booths.map(b => ({
        id: b.id,
        nama: b.nama,
        lokasi: b.lokasi,
        status: b.status,
        total_penjualan: Number(b.total_penjualan),
        kas_masuk: Number(b.kas_masuk),
      })),
    };
  });

  const products = await prisma.product.findMany({
    where: { is_active: true },
    select: { id: true, name: true, short_name: true },
    orderBy: { name: 'asc' },
  });

  // Base response
  const response: any = {
    currentMonth,
    currentYear,
    userRole: role,
    userId: user?.id,
    products,
  };

  if (isOwnerOrAdmin) {
    // Admin/Owner sees all marketing performance + legacy reports + event booths
    const [offlineReports, onlineReports, globalShopeeTarget, globalTiktokTarget, totalOutlets, eventBooths] = await Promise.all([
      prisma.marketingOffline.findMany({ orderBy: { date: 'desc' }, include: { employee: true } }),
      prisma.marketingOnline.findMany({ orderBy: { date: 'desc' }, include: { employee: true } }),
      getOnlineTarget('shopee'),
      getOnlineTarget('tiktok'),
      prisma.outlet.count(),
      prisma.eventBooth.findMany({
        orderBy: [{ status: 'asc' }, { tanggal_mulai: 'desc' }],
        include: {
          pic: { select: { id: true, nama: true, role: true } },
          sales: { orderBy: { date: 'desc' } },
        }
      })
    ]);

    const totalBoothSalesAll = eventBooths.reduce((sum, b) => sum + Number(b.total_penjualan), 0);
    const totalBoothKasAll = eventBooths.reduce((sum, b) => sum + Number(b.kas_masuk), 0);
    const activeBoothCount = eventBooths.filter(b => b.status === 'AKTIF').length;

    const globalMarketingTarget = marketingPerformance.reduce((sum, p) => sum + p.target_omset, 0);

    response.marketingPerformance = marketingPerformance;
    response.offlineReports = offlineReports;
    response.onlineReports = onlineReports;
    response.globalOfflineTarget = globalMarketingTarget;
    response.globalShopeeTarget = globalShopeeTarget;
    response.globalTiktokTarget = globalTiktokTarget;
    response.totalOutlets = totalOutlets;
    response.eventBooths = eventBooths.map(b => ({
      id: b.id,
      nama: b.nama,
      lokasi: b.lokasi,
      tanggal_mulai: b.tanggal_mulai,
      tanggal_selesai: b.tanggal_selesai,
      status: b.status,
      pic: b.pic,
      total_penjualan: Number(b.total_penjualan),
      kas_masuk: Number(b.kas_masuk),
      sales_count: b.sales.length,
    }));
    response.totalBoothSalesAll = totalBoothSalesAll;
    response.totalBoothKasAll = totalBoothKasAll;
    response.activeBoothCount = activeBoothCount;
  } else if (isMarketing && user) {
    // Marketing user sees only their own data
    const myPerformance = marketingPerformance.find(p => p.id === user.id);
    response.myPerformance = myPerformance || null;
  }

  return NextResponse.json(serializeDeep(response));
}
