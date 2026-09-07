import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { serializeDeep } from '@/lib/serialize';
import { getOnlineTarget } from '@/lib/settings';
import { verifySession } from '@/lib/auth';

export async function GET(req: Request) {
  try {
    const user = await verifySession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = (user.role || '').toUpperCase();
    const isOwnerOrAdmin = role === 'OWNER' || role === 'ADMIN';
    const isMarketing = role === 'MARKETING' || role.includes('MARKETING');
    const isDistributor = role === 'DISTRIBUTOR' || role.includes('DISTRIBUTOR');

    const { searchParams } = new URL(req.url);
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');

    const now = new Date();
    let periodStart: Date;
    let periodEnd: Date;
    let currentMonth: number;
    let currentYear: number;

    if (startDateParam && endDateParam) {
      periodStart = new Date(startDateParam);
      periodStart.setHours(0, 0, 0, 0);
      periodEnd = new Date(endDateParam);
      periodEnd.setHours(23, 59, 59, 999);
      currentMonth = periodStart.getMonth() + 1;
      currentYear = periodStart.getFullYear();
    } else {
      currentMonth = now.getMonth() + 1; // 1-12
      currentYear = now.getFullYear();
      periodStart = new Date(currentYear, currentMonth - 1, 1, 0, 0, 0, 0);
      periodEnd = new Date(currentYear, currentMonth, 0, 23, 59, 59, 999);
    }

    // 1. Fetch marketing employees with their outlets, targets, personal buyer txns, expenses
    const marketingEmployees = await prisma.employee.findMany({
      where: {
        OR: [
          { role: 'MARKETING' },
          { role: { contains: 'MARKETING', mode: 'insensitive' } },
          { posisi: { contains: 'Marketing', mode: 'insensitive' } },
          { id: user.id },
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
        expenses: {
          where: { date: { gte: periodStart, lte: periodEnd } },
          orderBy: { date: 'desc' }
        }
      },
      orderBy: { nama: 'asc' },
    });

    // Build performance summary for each marketing user
    const marketingPerformance = marketingEmployees.map(emp => {
      const target = emp.marketing_targets?.[0];
      const targetOmset = target ? Number(target.target_omset || 0) : 0;

      // Calculate outlet-based omset in period from OutletTransactions
      let totalBillingThisMonth = 0;
      let totalPaymentThisMonth = 0;
      let totalOutstandingAll = 0;
      let totalTagihanAll = 0;
      let totalPaymentAll = 0;

      const outletPaymentsHistory: any[] = [];

      (emp.managed_outlets || []).forEach(outlet => {
        totalTagihanAll += Number(outlet.tagihan || 0);
        totalPaymentAll += Number(outlet.payment || 0);
        totalOutstandingAll += Number(outlet.sisa_tagihan || 0);

        (outlet.transactions || []).forEach(tx => {
          if (!tx.date) return;
          const txDate = new Date(tx.date);
          if (txDate >= periodStart && txDate <= periodEnd) {
            if (tx.type === 'PIUTANG' || tx.type === 'BILLING' || tx.type === 'TAGIHAN') {
              totalBillingThisMonth += Number(tx.amount || 0);
            } else if (tx.type === 'PELUNASAN' || tx.type === 'PAYMENT') {
              totalPaymentThisMonth += Number(tx.amount || 0);
              outletPaymentsHistory.push({
                id: tx.id,
                outlet_id: outlet.id,
                outlet_nama: outlet.nama,
                amount: Number(tx.amount || 0),
                description: tx.description || 'Pelunasan Outlet',
                date: tx.date,
                sisa_tagihan_outlet: Number(outlet.sisa_tagihan || 0)
              });
            }
          }
        });
      });

      outletPaymentsHistory.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      // Personal buyer omset in period
      const personalBuyerThisMonth = (emp.personal_buyer_transactions || [])
        .filter(t => {
          if (!t.date) return false;
          const d = new Date(t.date);
          return d >= periodStart && d <= periodEnd;
        })
        .reduce((sum, t) => sum + Number(t.amount || 0), 0);

      // Booth sales in period
      const boothSalesThisMonth = (emp.managed_booths || []).reduce((sum, b) => {
        const bMonthSales = (b.sales || [])
          .filter(s => {
            if (!s.date) return false;
            const d = new Date(s.date);
            return d >= periodStart && d <= periodEnd;
          })
          .reduce((sSum, s) => sSum + Number(s.total_price || 0), 0);
        return sum + bMonthSales;
      }, 0);

      // Total Expenses for this marketing employee
      const totalExpensesThisMonth = (emp.expenses || []).reduce((sum, e) => sum + Number(e.amount || 0), 0);

      // Performa omset marketing: Realisasi Pengiriman (Gross Billing) vs Kas Terkumpul (Cash Realized)
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
        outlets: (emp.managed_outlets || []).map(o => ({
          id: o.id,
          nama: o.nama,
          tagihan: Number(o.tagihan || 0),
          payment: Number(o.payment || 0),
          sisa_tagihan: Number(o.sisa_tagihan || 0),
          status: o.status,
          wilayah: o.wilayah,
        })),
        target_omset: targetOmset,
        total_billing_this_month: totalBillingThisMonth,
        total_payment_this_month: totalPaymentThisMonth,
        personal_buyer_this_month: personalBuyerThisMonth,
        booth_sales_this_month: boothSalesThisMonth,
        total_omset_this_month: totalOmsetThisMonth,
        total_expenses_this_month: totalExpensesThisMonth,
        pencapaian,
        gap,
        status,
        total_tagihan_all: totalTagihanAll,
        total_payment_all: totalPaymentAll,
        total_outstanding_all: totalOutstandingAll,
        outlet_count: (emp.managed_outlets || []).length,
        booth_count: (emp.managed_booths || []).length,
        expenses: (emp.expenses || []).map(e => ({
          id: e.id,
          title: e.title,
          amount: Number(e.amount || 0),
          date: e.date,
          category: e.category,
          description: e.description,
        })),
        outlet_payments_history: outletPaymentsHistory,
        personal_buyer_transactions: (emp.personal_buyer_transactions || [])
          .filter(t => {
            if (!t.date) return false;
            const d = new Date(t.date);
            return d >= periodStart && d <= periodEnd;
          })
          .map(t => ({
            id: t.id,
            buyer_name: t.buyer_name,
            product_name: (t as any).product_name || null,
            quantity: (t as any).quantity || 1,
            price_per_unit: (t as any).price_per_unit ? Number((t as any).price_per_unit) : null,
            amount: Number(t.amount || 0),
            description: t.description,
            date: t.date,
          })),
      };
    });

    // 2. Fetch Distributors (Performa Distributor dengan filter area)
    const distributorEmployees = await prisma.employee.findMany({
      where: {
        role: 'DISTRIBUTOR',
        status_aktif: true,
        ...(isDistributor && !isOwnerOrAdmin ? { id: user.id } : {})
      },
      include: {
        distributor_warehouses: {
          include: {
            stocks: { include: { product: true } }
          }
        },
        distributor_outlets: {
          include: {
            transactions: { orderBy: { date: 'desc' } }
          }
        },
        managed_outlets: {
          include: {
            transactions: { orderBy: { date: 'desc' } }
          }
        },
        expenses: {
          where: { date: { gte: periodStart, lte: periodEnd } }
        }
      },
      orderBy: { nama: 'asc' }
    });

    const distributorPerformance = distributorEmployees.map(dist => {
      const rawOutlets = [...(dist.distributor_outlets || []), ...(dist.managed_outlets || [])];
      const uniqueOutlets = Array.from(new Map(rawOutlets.map(o => [o.id, o])).values());

      let totalBilling = 0;
      let totalPayment = 0;
      let totalTagihan = 0;
      let totalSisaTagihan = 0;

      uniqueOutlets.forEach(o => {
        totalTagihan += Number(o.tagihan || 0);
        totalSisaTagihan += Number(o.sisa_tagihan || 0);

        (o.transactions || []).forEach(tx => {
          if (!tx.date) return;
          const d = new Date(tx.date);
          if (d >= periodStart && d <= periodEnd) {
            if (tx.type === 'PIUTANG' || tx.type === 'BILLING' || tx.type === 'TAGIHAN') {
              totalBilling += Number(tx.amount || 0);
            } else if (tx.type === 'PELUNASAN' || tx.type === 'PAYMENT') {
              totalPayment += Number(tx.amount || 0);
            }
          }
        });
      });

      let totalStokGudang = 0;
      (dist.distributor_warehouses || []).forEach(w => {
        (w.stocks || []).forEach(s => {
          totalStokGudang += (s.quantity || 0);
        });
      });

      return {
        id: dist.id,
        nama: dist.nama,
        no_hp: dist.no_hp,
        wilayah: dist.wilayah || 'Umum',
        outlet_count: uniqueOutlets.length,
        total_stok_gudang: totalStokGudang,
        total_billing_this_month: totalBilling,
        total_payment_this_month: totalPayment,
        total_sisa_tagihan: totalSisaTagihan,
        warehouses: (dist.distributor_warehouses || []).map(w => ({
          id: w.id,
          name: w.name,
          address: w.address,
          total_stock: (w.stocks || []).reduce((acc: number, s: any) => acc + (s.quantity || 0), 0),
          stocks: (w.stocks || []).map(s => ({
            product_id: s.product_id,
            product_name: s.product.name,
            quantity: s.quantity,
          }))
        })),
        outlets: uniqueOutlets.map(o => ({
          id: o.id,
          nama: o.nama,
          wilayah: o.wilayah,
          tagihan: Number(o.tagihan || 0),
          payment: Number(o.payment || 0),
          sisa_tagihan: Number(o.sisa_tagihan || 0)
        }))
      };
    });

    // 3. Products with stock & Warehouses for Personal Buyer Modal
    const [products, warehouses] = await Promise.all([
      prisma.product.findMany({
        where: { is_active: true },
        select: {
          id: true,
          sku: true,
          name: true,
          short_name: true,
          base_price: true,
          stok: true,
          warehouse_stocks: {
            select: {
              warehouse_id: true,
              quantity: true,
              warehouse: { select: { id: true, name: true, type: true } }
            }
          }
        },
        orderBy: { name: 'asc' },
      }),
      prisma.warehouse.findMany({
        select: { id: true, name: true, type: true, address: true },
        orderBy: { name: 'asc' }
      })
    ]);

    // Base response
    const response: any = {
      currentMonth,
      currentYear,
      startDate: periodStart.toISOString(),
      endDate: periodEnd.toISOString(),
      userRole: role,
      userId: user.id,
      products: products || [],
      warehouses: warehouses || [],
      distributorPerformance: distributorPerformance || [],
    };

    if (isOwnerOrAdmin) {
      const [offlineReports, onlineReports, globalShopeeTarget, globalTiktokTarget, totalOutlets] = await Promise.all([
        prisma.marketingOffline.findMany({
          where: { date: { gte: periodStart, lte: periodEnd } },
          orderBy: { date: 'desc' },
          include: { employee: true }
        }),
        prisma.marketingOnline.findMany({
          where: { date: { gte: periodStart, lte: periodEnd } },
          orderBy: { date: 'desc' },
          include: { employee: true }
        }),
        getOnlineTarget('shopee'),
        getOnlineTarget('tiktok'),
        prisma.outlet.count(),
      ]);

      const globalMarketingTarget = marketingPerformance.reduce((sum, p) => sum + p.target_omset, 0);

      response.marketingPerformance = marketingPerformance;
      response.offlineReports = offlineReports || [];
      response.onlineReports = onlineReports || [];
      response.globalOfflineTarget = globalMarketingTarget;
      response.globalShopeeTarget = globalShopeeTarget;
      response.globalTiktokTarget = globalTiktokTarget;
      response.totalOutlets = totalOutlets;
    } else if (isMarketing && user) {
      let myPerformance = marketingPerformance.find(p => p.id === user.id);
      if (!myPerformance) {
        myPerformance = {
          id: user.id,
          nama: user.nama,
          posisi: (user as any).posisi || 'Marketing',
          no_hp: '',
          outlets: [],
          target_omset: 0,
          total_billing_this_month: 0,
          total_payment_this_month: 0,
          personal_buyer_this_month: 0,
          booth_sales_this_month: 0,
          total_omset_this_month: 0,
          total_expenses_this_month: 0,
          pencapaian: 0,
          gap: 0,
          status: 'on_track',
          total_tagihan_all: 0,
          total_payment_all: 0,
          total_outstanding_all: 0,
          outlet_count: 0,
          booth_count: 0,
          expenses: [],
          outlet_payments_history: [],
          personal_buyer_transactions: [],
        };
      }
      response.myPerformance = myPerformance;
    } else if (isDistributor && user) {
      response.myDistributor = distributorPerformance.find(d => d.id === user.id) || null;
    }

    return NextResponse.json(serializeDeep(response));
  } catch (error: any) {
    console.error('Error in /api/data/marketing:', error);
    return NextResponse.json(
      { error: error?.message || 'Gagal memuat data marketing' },
      { status: 500 }
    );
  }
}
