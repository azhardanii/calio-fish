import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { serializeDeep } from '@/lib/serialize';
import { verifySession } from '@/lib/auth';

export async function GET() {
  const user = await verifySession();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  let whereClause: any = {};
  const role = (user?.role || '').toUpperCase();
  const isOwnerOrAdmin = role === 'OWNER' || role === 'ADMIN';

  if (!isOwnerOrAdmin) {
    if (role === 'DISTRIBUTOR') {
      whereClause = { distributor_id: user.id };
    } else {
      // Marketing, Mitra, and any non-admin staff
      whereClause = { pengelola_id: user.id };
    }
  }

  const outlets = await prisma.outlet.findMany({
    where: whereClause,
    include: { 
      stocks: { include: { product: true } },
      pengelola: { select: { id: true, nama: true } },
      distributor: { select: { id: true, nama: true, wilayah: true } },
      transactions: { orderBy: { date: 'desc' } },
      shipments: { orderBy: { date: 'desc' }, include: { items: { include: { product: true } } } }
    },
    orderBy: { created_at: 'desc' },
  });

  const outletIds = outlets.map(o => o.id);
  const stockTransactions = await prisma.stockTransaction.findMany({
    where: { 
      destination_type: 'OUTLET',
      destination_id: { in: outletIds }
    },
    include: { product: true, employee: { select: { nama: true } } },
    orderBy: { created_at: 'desc' }
  });

  const outletsWithHistory = outlets.map(o => ({
    ...o,
    stock_history: stockTransactions.filter(st => st.destination_id === o.id)
  }));

  return NextResponse.json(serializeDeep(outletsWithHistory));
}
