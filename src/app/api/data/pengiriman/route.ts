import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { serializeDeep } from '@/lib/serialize';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  const dateFilter: any = {};
  if (startDate && endDate) {
    dateFilter.gte = new Date(startDate);
    dateFilter.lte = new Date(endDate + 'T23:59:59.999Z');
  }

  // 1. Formal Outbound Shipments (Outlets, KOL/Affiliates, Booths)
  const outboundShipments = await prisma.outboundShipment.findMany({
    where: startDate && endDate ? { date: dateFilter } : undefined,
    orderBy: { date: 'desc' },
    include: {
      items: { include: { product: true } },
      outlet: true,
      affiliate: true,
      employee: true,
      booth: true,
    },
  });

  // 2. Physical Stock Movements (OUT) from Warehouses
  const stockTxOut = await prisma.stockTransaction.findMany({
    where: {
      flow: 'OUT',
      ...(startDate && endDate ? { date: dateFilter } : {})
    },
    include: {
      product: true,
      employee: true,
    },
    orderBy: { date: 'desc' },
  });

  // 3. Personal Buyer Direct Sales / Shipments
  const personalBuyers = await prisma.personalBuyerTransaction.findMany({
    where: startDate && endDate ? { date: dateFilter } : undefined,
    include: { employee: true },
    orderBy: { date: 'desc' },
  });

  // 4. Sample Distributions (KOL / Affiliates / Promo)
  const sampleDistributions = await prisma.distribusiSample.findMany({
    where: startDate && endDate ? { date: dateFilter } : undefined,
    include: { employee: true },
    orderBy: { date: 'desc' },
  });

  // Harmonize all shipments into a unified list
  const unifiedShipments: any[] = [];
  const processedTxIds = new Set<string>();

  // Add formal shipments
  for (const s of outboundShipments) {
    const isRetur = s.shipment_type === 'RETUR' || s.status === 'RETURNED';
    let destName = s.destination_name;
    if (!destName) {
      if (s.outlet) destName = s.outlet.nama;
      else if (s.affiliate) destName = s.affiliate.nama;
      else if (s.booth) destName = s.booth.nama;
      else destName = s.destination_type || 'Tujuan';
    }

    unifiedShipments.push({
      id: s.id,
      date: s.date,
      created_at: s.created_at,
      shipment_type: isRetur ? 'RETUR' : (s.shipment_type || (s.outlet ? 'PENGIRIMAN_OUTLET' : s.booth ? 'TRANSFER_BOOTH' : 'PENGIRIMAN')),
      destination_type: s.destination_type || (s.outlet ? 'OUTLET' : s.affiliate ? 'AFFILIATE' : s.booth ? 'BOOTH' : 'GENERAL'),
      destination_name: destName,
      source_name: s.source_name || 'Gudang Pusat',
      source_type: s.source_type || 'WAREHOUSE',
      notes: s.notes || (s.outlet ? `Kirim ke outlet: ${s.outlet.nama}` : s.booth ? `Transfer ke booth: ${s.booth.nama}` : null),
      status: s.status,
      employee: s.employee ? { id: s.employee.id, nama: s.employee.nama, role: s.employee.role } : null,
      items: s.items.map(it => ({
        id: it.id,
        qty: it.qty,
        product: {
          id: it.product.id,
          name: it.product.name,
          sku: it.product.sku,
          base_price: Number(it.product.base_price || 0),
        }
      })),
    });
  }

  // Add stock transactions OUT that don't belong to existing outbound shipments
  for (const tx of stockTxOut) {
    // Check if covered by formal outbound shipment
    const isCovered = outboundShipments.some(s => {
      const sDate = new Date(s.date).toISOString().split('T')[0];
      const txDate = new Date(tx.date).toISOString().split('T')[0];
      return sDate === txDate && s.items.some(it => it.product_id === tx.product_id);
    });

    if (!isCovered && !processedTxIds.has(tx.id)) {
      processedTxIds.add(tx.id);
      const isRetur = tx.type.includes('RETUR');
      const isBooth = tx.type.includes('BOOTH');
      const isSample = tx.type.includes('SAMPLE');

      unifiedShipments.push({
        id: `TX-${tx.id}`,
        date: tx.date,
        created_at: tx.created_at,
        shipment_type: isRetur ? 'RETUR' : isBooth ? 'TRANSFER_BOOTH' : isSample ? 'SAMPLE' : (tx.type || 'PENGIRIMAN'),
        destination_type: tx.destination_type || (isBooth ? 'BOOTH' : 'DISTRIBUSI'),
        destination_name: tx.destination_id || tx.description || 'Pengiriman Distribusi',
        source_name: tx.source_type || 'Gudang Asal',
        source_type: 'WAREHOUSE',
        notes: tx.description || `Mutasi keluar: ${tx.type}`,
        status: 'SHIPPED',
        employee: tx.employee ? { id: tx.employee.id, nama: tx.employee.nama, role: tx.employee.role } : null,
        items: [{
          id: `ITEM-${tx.id}`,
          qty: tx.qty,
          product: {
            id: tx.product.id,
            name: tx.product.name,
            sku: tx.product.sku,
            base_price: Number(tx.product.base_price || 0),
          }
        }],
      });
    }
  }

  // Add Personal Buyer Transactions as customer delivery shipments
  for (const pb of personalBuyers) {
    unifiedShipments.push({
      id: `PB-${pb.id}`,
      date: pb.date,
      created_at: pb.created_at,
      shipment_type: 'PERSONAL_BUYER',
      destination_type: 'ENDUSER',
      destination_name: pb.buyer_name || 'Pembeli Personal',
      source_name: 'Gudang Calio',
      source_type: 'WAREHOUSE',
      notes: pb.description || `Pengiriman customer personal: ${pb.buyer_name} (Rp ${Number(pb.amount).toLocaleString('id-ID')})`,
      status: 'DELIVERED',
      employee: pb.employee ? { id: pb.employee.id, nama: pb.employee.nama, role: pb.employee.role } : null,
      items: [{
        id: `PBITEM-${pb.id}`,
        qty: pb.quantity || 1,
        product: {
          id: pb.id,
          name: pb.product_name || 'Produk CalioFish',
          sku: 'PB-DIRECT',
          base_price: Number(pb.price_per_unit || pb.amount || 0),
        }
      }],
    });
  }

  // Add Sample Distributions
  for (const sm of sampleDistributions) {
    unifiedShipments.push({
      id: `SMPL-${sm.id}`,
      date: sm.date,
      created_at: sm.created_at,
      shipment_type: 'SAMPLE',
      destination_type: 'AFFILIATE',
      destination_name: sm.jenis_sample || 'Distribusi Sample',
      source_name: 'Gudang Pusat',
      source_type: 'WAREHOUSE',
      notes: `Kirim sample promosi / endorsement (Ekspedisi: Rp ${Number(sm.biaya_ekspedisi).toLocaleString('id-ID')})`,
      status: 'SHIPPED',
      employee: sm.employee ? { id: sm.employee.id, nama: sm.employee.nama, role: sm.employee.role } : null,
      items: [{
        id: `SMPLITEM-${sm.id}`,
        qty: sm.total_produk || 1,
        product: {
          id: sm.id,
          name: sm.jenis_sample || 'Sample Produk Calio',
          sku: 'SAMPLE-PROMO',
          base_price: 0,
        }
      }],
    });
  }

  // Sort overall by date DESC
  unifiedShipments.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const totalShipments = unifiedShipments.length;
  const totalItemsSent = unifiedShipments.reduce(
    (acc, curr) => acc + curr.items.reduce((sum: number, item: any) => sum + item.qty, 0), 0
  );

  return NextResponse.json(serializeDeep({
    shipments: unifiedShipments,
    totalShipments,
    totalItemsSent,
  }));
}
