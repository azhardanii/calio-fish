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

  const [warehouses, shipments, returns, productions, outlets, totalShipmentCount, totalItemAgg] = await Promise.all([
    prisma.warehouse.findMany({
      where: warehouseWhere,
      include: {
        stocks: { include: { product: true } },
        distributor: { select: { id: true, nama: true, wilayah: true } },
      },
      orderBy: { created_at: 'asc' },
    }),
    prisma.outboundShipment.findMany({
      orderBy: { date: 'desc' },
      take: 100,
      include: {
        items: { include: { product: { select: { id: true, sku: true, name: true, short_name: true } } } },
        outlet: { select: { id: true, nama: true } },
        affiliate: { select: { id: true, nama: true } },
        employee: { select: { id: true, nama: true } },
      },
    }),
    prisma.warehouseReturn.findMany({
      orderBy: { date: 'desc' },
      include: {
        warehouse: { select: { id: true, name: true } },
        items: { include: { product: { select: { id: true, sku: true, name: true, short_name: true } } } },
      },
      take: 50,
    }),
    prisma.productionEntry.findMany({
      orderBy: { date: 'desc' },
      include: {
        warehouse: { select: { id: true, name: true } },
        product: { select: { id: true, sku: true, name: true, short_name: true } },
      },
      take: 100,
    }),
    prisma.outlet.findMany({
      select: { id: true, nama: true },
      orderBy: { nama: 'asc' },
    }),
    prisma.outboundShipment.count(),
    prisma.outboundItem.aggregate({ _sum: { qty: true } }),
  ]);

  const filteredShipments = isDistributor
    ? shipments.filter(s => s.destination_name?.toLowerCase().includes(session?.nama?.toLowerCase() || '') || warehouses.some(w => w.name === s.source_name || w.name === s.destination_name))
    : shipments;

  const totalShipments = isDistributor ? filteredShipments.length : totalShipmentCount;
  const totalItemsSent = isDistributor
    ? filteredShipments.reduce((acc, curr) => acc + curr.items.reduce((sum, item) => sum + item.qty, 0), 0)
    : Number(totalItemAgg._sum.qty || 0);

  return NextResponse.json(serializeDeep({
    warehouses,
    shipments: filteredShipments,
    returns,
    productions,
    outlets,
    totalShipments,
    totalItemsSent,
  }));
}
