import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifySession } from '@/lib/auth';
import { serializeDeep } from '@/lib/serialize';

export async function GET(req: Request) {
  const user = await verifySession();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const role = (user.role || '').toUpperCase();
  const { searchParams } = new URL(req.url);
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  let periodStart: Date | undefined;
  let periodEnd: Date | undefined;

  if (startDate && endDate) {
    periodStart = new Date(startDate);
    periodStart.setHours(0, 0, 0, 0);
    periodEnd = new Date(endDate);
    periodEnd.setHours(23, 59, 59, 999);
  }

  // Fetch event booths
  const whereClause = periodStart && periodEnd ? {
    OR: [
      { status: 'AKTIF' },
      { tanggal_mulai: { lte: periodEnd }, tanggal_selesai: { gte: periodStart } },
      { sales: { some: { date: { gte: periodStart, lte: periodEnd } } } }
    ]
  } : undefined;

  const salesConfig = periodStart && periodEnd ? {
    where: { date: { gte: periodStart, lte: periodEnd } },
    orderBy: { date: 'desc' as const }
  } : {
    orderBy: { date: 'desc' as const },
    take: 100
  };

  const rawBooths = await prisma.eventBooth.findMany({
    where: whereClause,
    orderBy: [
      { status: 'asc' }, // AKTIF before SELESAI
      { tanggal_mulai: 'desc' }
    ],
    include: {
      pic: { select: { id: true, nama: true, no_hp: true, role: true } },
      stocks: {
        include: { product: true },
        orderBy: { product: { name: 'asc' } }
      },
      bundles: {
        include: {
          items: { include: { product: true } }
        },
        orderBy: { nama: 'asc' }
      },
      sales: salesConfig,
      shipments: {
        orderBy: { date: 'desc' },
        take: 20
      }
    }
  });

  const booths = rawBooths.map(b => {
    const periodSales = (b.sales && b.sales.length > 0)
      ? b.sales.reduce((sum, s) => sum + Number(s.total_price || 0), 0)
      : (!startDate ? Number(b.total_penjualan || 0) : 0);
    const periodKas = (b.sales && b.sales.length > 0)
      ? b.sales.filter(s => s.metode_pembayaran !== 'HUTANG').reduce((sum, s) => sum + Number(s.total_price || 0), 0)
      : (!startDate ? Number(b.kas_masuk || 0) : 0);

    return {
      ...b,
      total_penjualan: periodSales,
      kas_masuk: periodKas,
      all_time_penjualan: Number(b.total_penjualan || 0),
      all_time_kas: Number(b.kas_masuk || 0),
    };
  });

  // Fetch supporting data for modals
  const [products, warehouses, employees] = await Promise.all([
    prisma.product.findMany({
      where: { is_active: true },
      orderBy: { name: 'asc' }
    }),
    prisma.warehouse.findMany({
      orderBy: { name: 'asc' },
      include: {
        stocks: { include: { product: true } }
      }
    }),
    prisma.employee.findMany({
      where: { status_aktif: true },
      select: { id: true, nama: true, role: true, posisi: true },
      orderBy: { nama: 'asc' }
    })
  ]);

  return NextResponse.json(serializeDeep({
    booths,
    products,
    warehouses,
    employees,
    userRole: role,
    userId: user.id,
    startDate: periodStart?.toISOString() || null,
    endDate: periodEnd?.toISOString() || null,
  }));
}
