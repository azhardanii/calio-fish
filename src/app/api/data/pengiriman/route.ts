import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { serializeDeep } from '@/lib/serialize';

export async function GET() {
  const shipments = await prisma.outboundShipment.findMany({
    orderBy: { date: 'desc' },
    include: {
      items: { include: { product: true } },
      outlet: true,
      affiliate: true,
      employee: true,
    },
  });

  const totalShipments = shipments.length;
  const totalItemsSent = shipments.reduce(
    (acc, curr) => acc + curr.items.reduce((sum, item) => sum + item.qty, 0), 0
  );

  return NextResponse.json(serializeDeep({
    shipments,
    totalShipments,
    totalItemsSent,
  }));
}
