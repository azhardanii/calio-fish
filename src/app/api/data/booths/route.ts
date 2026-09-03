import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifySession } from '@/lib/auth';
import { serializeDeep } from '@/lib/serialize';

export async function GET() {
  const user = await verifySession();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const role = (user.role || '').toUpperCase();

  // Fetch all event booths
  const booths = await prisma.eventBooth.findMany({
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
      sales: {
        orderBy: { date: 'desc' },
        take: 100
      },
      shipments: {
        orderBy: { date: 'desc' },
        take: 20
      }
    }
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
  }));
}
