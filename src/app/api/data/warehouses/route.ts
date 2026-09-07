import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { serializeDeep } from '@/lib/serialize';
import { verifySession } from '@/lib/auth';

export async function GET() {
  const session = await verifySession();
  const role = (session?.role || '').toUpperCase();
  const isDistributor = role === 'DISTRIBUTOR';
  const distributorId = session?.id;

  const warehouseWhere: any = {};
  if (isDistributor && distributorId) {
    warehouseWhere.distributor_id = distributorId;
  }

  const [warehouses, shipments] = await Promise.all([
    prisma.warehouse.findMany({
      where: warehouseWhere,
      include: {
        stocks: { include: { product: true } },
        distributor: true,
      },
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

  const filteredShipments = isDistributor
    ? shipments.filter(s => s.destination_name?.toLowerCase().includes(session?.nama?.toLowerCase() || '') || warehouses.some(w => w.name === s.source_name || w.name === s.destination_name))
    : shipments;

  const totalShipments = filteredShipments.length;
  const totalItemsSent = filteredShipments.reduce(
    (acc, curr) => acc + curr.items.reduce((sum, item) => sum + item.qty, 0), 0
  );

  return NextResponse.json(serializeDeep({
    warehouses,
    shipments: filteredShipments,
    totalShipments,
    totalItemsSent,
  }));
}
