import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { serializeDeep } from '@/lib/serialize';

export async function GET() {
  const [warehouses, shipments] = await Promise.all([
    prisma.warehouse.findMany({
      include: { stocks: { include: { product: true } } },
      orderBy: { created_at: 'asc' },
    }),
    prisma.outboundShipment.findMany({
      orderBy: { date: 'desc' },
      include: {
        items: { include: { product: true } },
        outlet: true,
        affiliate: true,
        employee: true,
      },
    }),
  ]);

  const totalShipments = shipments.length;
  const totalItemsSent = shipments.reduce(
    (acc, curr) => acc + curr.items.reduce((sum, item) => sum + item.qty, 0), 0
  );

  return NextResponse.json(serializeDeep({
    warehouses,
    shipments,
    totalShipments,
    totalItemsSent,
  }));
}
