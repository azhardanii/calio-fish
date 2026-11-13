import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { recalculateOutletFinance } from './finance';
import { TRANSACTION_TYPES } from './constants';

export async function runConsignmentSeedAndBackfill() {
  console.log('[Consignment Migration] Starting seed & backfill...');

  // 1. Ensure ProductTypes exist
  const defaultTypes = [
    { code: 'G60', name: 'Calio 60gr', base_price: new Prisma.Decimal(20000) },
    { code: 'G20', name: 'Calio 20gr', base_price: new Prisma.Decimal(10000) },
    { code: 'ABON', name: 'Abon Ikan', base_price: new Prisma.Decimal(25000) },
  ];

  for (const t of defaultTypes) {
    await prisma.productType.upsert({
      where: { code: t.code },
      create: t,
      update: { name: t.name, base_price: t.base_price },
    });
  }

  const allTypes = await prisma.productType.findMany();
  const typeMapByCode = new Map(allTypes.map((t) => [t.code, t]));
  const g60 = typeMapByCode.get('G60')!;
  const g20 = typeMapByCode.get('G20')!;
  const abon = typeMapByCode.get('ABON')!;

  // 2. Link existing products to ProductType
  const products = await prisma.product.findMany();
  for (const p of products) {
    if (!p.product_type_id) {
      const lower = `${p.sku} ${p.name} ${p.short_name} ${p.category}`.toLowerCase();
      let matchedTypeId = g60.id; // default fallback

      if (lower.includes('abon')) {
        matchedTypeId = abon.id;
      } else if (lower.includes('20') || lower.includes('20g') || lower.includes('20 gr')) {
        matchedTypeId = g20.id;
      } else if (lower.includes('60') || lower.includes('60g') || lower.includes('60 gr')) {
        matchedTypeId = g60.id;
      }

      await prisma.product.update({
        where: { id: p.id },
        data: { product_type_id: matchedTypeId },
      });
    }
  }

  // 3. Backfill OutletTypeStock from OutletStock
  const outlets = await prisma.outlet.findMany({
    include: {
      stocks: {
        include: { product: true },
      },
    },
  });

  for (const outlet of outlets) {
    // Group stocks by product_type_id
    const grouped = new Map<string, { qty: number; hargaBeli?: number }>();

    for (const s of outlet.stocks) {
      const typeId = s.product.product_type_id || g60.id;
      const current = grouped.get(typeId) || { qty: 0 };
      current.qty += s.quantity;
      if (s.harga_beli !== null && s.harga_beli !== undefined) {
        current.hargaBeli = Number(s.harga_beli);
      }
      grouped.set(typeId, current);
    }

    for (const [typeId, data] of Array.from(grouped.entries())) {
      await prisma.outletTypeStock.upsert({
        where: {
          outlet_id_product_type_id: {
            outlet_id: outlet.id,
            product_type_id: typeId,
          },
        },
        create: {
          outlet_id: outlet.id,
          product_type_id: typeId,
          quantity: data.qty,
          harga_beli: data.hargaBeli ? new Prisma.Decimal(data.hargaBeli) : null,
        },
        update: {
          quantity: data.qty,
          harga_beli: data.hargaBeli ? new Prisma.Decimal(data.hargaBeli) : undefined,
        },
      });
    }
  }

  // 4. Update legacy transactions
  // PIUTANG -> PIUTANG_MANUAL (piutang_delta = amount)
  await prisma.outletTransaction.updateMany({
    where: {
      type: 'PIUTANG',
      piutang_delta: 0,
    },
    data: {
      type: TRANSACTION_TYPES.PIUTANG_MANUAL,
    },
  });

  // Backfill piutang_delta for PIUTANG_MANUAL
  const manualPiutangs = await prisma.outletTransaction.findMany({
    where: {
      type: { in: [TRANSACTION_TYPES.PIUTANG_MANUAL, 'PIUTANG'] },
    },
  });
  for (const tx of manualPiutangs) {
    if (Number(tx.piutang_delta || 0) === 0 && Number(tx.amount || 0) !== 0) {
      await prisma.outletTransaction.update({
        where: { id: tx.id },
        data: {
          piutang_delta: tx.amount,
          type: TRANSACTION_TYPES.PIUTANG_MANUAL,
        },
      });
    }
  }

  // PELUNASAN -> PAYMENT
  await prisma.outletTransaction.updateMany({
    where: {
      type: 'PELUNASAN',
    },
    data: {
      type: TRANSACTION_TYPES.PAYMENT,
    },
  });

  // 5. Recalculate finance for all outlets
  for (const outlet of outlets) {
    await recalculateOutletFinance(prisma, outlet.id);
  }

  console.log('[Consignment Migration] Migration and recalculation complete for', outlets.length, 'outlets.');
}

