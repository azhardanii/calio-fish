import { Prisma, PrismaClient } from '@prisma/client';
import { BREAKDOWN_STATUS, OPNAME_STATUS, TRANSACTION_TYPES } from './constants';
import {
  allocateVariants,
  ManualVariantInput,
  reconcileVariantQuantities,
  VariantStockInfo,
} from './variants';

export interface ConsignmentItemInput {
  productTypeId: string;
  qty: number;
  price?: number;
  variants?: ManualVariantInput[];
}

export interface PureStockInfo {
  productTypeId: string;
  quantity: number;
  price: number;
}

export interface ProcessedConsignmentItem {
  productTypeId: string;
  qty: number;
  price: number;
  total: number;
  variants?: ManualVariantInput[];
}

export interface PaymentModeAResult {
  status: string;
  isEstimated: boolean;
  needsReview: boolean;
  sold: number;
  valuasiDelta: number;
  piutangDelta: number;
  unallocated: number;
  processedItems: ProcessedConsignmentItem[];
}

/**
 * Pure calculation for Mode A (has_daily_sales = false) PAYMENT
 */
export function calculatePaymentModeA(params: {
  nominal: number;
  currentPiutang: number;
  items?: ConsignmentItemInput[];
  stocks: PureStockInfo[];
  settleOnly?: boolean;
}): PaymentModeAResult {
  const { nominal, currentPiutang, items, stocks, settleOnly } = params;

  // Case 1: settleOnly = true (pure piutang settlement, no sold items)
  if (settleOnly) {
    const sold = 0;
    const surplus = nominal;
    const settle = Math.min(surplus, Math.max(0, currentPiutang));
    const piutangDelta = -settle;
    const unallocated = surplus - settle;

    return {
      status: BREAKDOWN_STATUS.COMPLETE,
      isEstimated: false,
      needsReview: unallocated > 0,
      sold,
      valuasiDelta: 0,
      piutangDelta,
      unallocated,
      processedItems: [] as ProcessedConsignmentItem[],
    };
  }

  // Case 2: Items provided (breakdown_status = COMPLETE)
  if (items && items.length > 0) {
    const stockMap = new Map(stocks.map((s) => [s.productTypeId, s]));
    let sold = 0;
    const processedItems: ProcessedConsignmentItem[] = [];

    for (const item of items) {
      if (item.qty <= 0) continue;
      const stock = stockMap.get(item.productTypeId);
      const availableQty = stock ? stock.quantity : 0;
      if (item.qty > availableQty) {
        throw new Error(`Jumlah terjual (${item.qty}) melebihi stok outlet (${availableQty})`);
      }
      const price = item.price ?? (stock ? stock.price : 0);
      const total = item.qty * price;
      sold += total;
      processedItems.push({
        productTypeId: item.productTypeId,
        qty: item.qty,
        price,
        total,
        variants: item.variants,
      });
    }

    const valuasiDelta = -sold;
    const selisih = sold - nominal;

    if (selisih > 0) {
      // Sold more than nominal paid -> remainder becomes piutang
      return {
        status: BREAKDOWN_STATUS.COMPLETE,
        isEstimated: false,
        needsReview: true,
        sold,
        valuasiDelta,
        piutangDelta: selisih,
        unallocated: 0,
        processedItems,
      };
    } else {
      // selisih <= 0 -> nominal equals or exceeds sold
      const surplus = -selisih;
      const settle = Math.min(surplus, Math.max(0, currentPiutang));
      const piutangDelta = -settle;
      const unallocated = surplus - settle;

      return {
        status: BREAKDOWN_STATUS.COMPLETE,
        isEstimated: false,
        needsReview: unallocated > 0,
        sold,
        valuasiDelta,
        piutangDelta,
        unallocated,
        processedItems,
      };
    }
  }

  // Case 3: No items provided -> check available stocks
  const activeStocks = stocks.filter((s) => s.quantity > 0);

  if (activeStocks.length === 1) {
    // Single product type with stock -> estimate qty
    const single = activeStocks[0];
    const price = single.price > 0 ? single.price : 1;
    const qty = Math.floor(nominal / price);

    if (qty > single.quantity) {
      throw new Error(`Estimasi qty (${qty}) melebihi stok outlet (${single.quantity})`);
    }

    const estimatedItems: ConsignmentItemInput[] = [{ productTypeId: single.productTypeId, qty, price }];
    const res: PaymentModeAResult = calculatePaymentModeA({
      nominal,
      currentPiutang,
      items: estimatedItems,
      stocks,
      settleOnly: false,
    });

    return {
      ...res,
      status: BREAKDOWN_STATUS.ESTIMATED,
      isEstimated: true,
    };
  }

  // Multi-stock or 0 stock without details -> PENDING
  return {
    status: BREAKDOWN_STATUS.PENDING,
    isEstimated: false,
    needsReview: true,
    sold: 0,
    valuasiDelta: 0,
    piutangDelta: 0,
    unallocated: 0,
    processedItems: [] as ProcessedConsignmentItem[],
  };
}

/**
 * Pure calculation for Mode B (has_daily_sales = true) PAYMENT
 */
export function calculatePaymentModeB(params: {
  nominal: number;
  currentPiutang: number;
}) {
  const { nominal, currentPiutang } = params;
  const settle = Math.min(nominal, Math.max(0, currentPiutang));
  const piutangDelta = -settle;
  const unallocated = nominal - settle;

  return {
    status: BREAKDOWN_STATUS.COMPLETE,
    isEstimated: false,
    needsReview: unallocated > 0,
    valuasiDelta: 0,
    piutangDelta,
    unallocated,
  };
}

/**
 * Pure calculation for SALE (has_daily_sales = true only)
 */
export function calculateSale(params: {
  items: ConsignmentItemInput[];
  stocks: PureStockInfo[];
}) {
  const { items, stocks } = params;
  const stockMap = new Map(stocks.map((s) => [s.productTypeId, s]));
  let amount = 0;
  const processedItems: ProcessedConsignmentItem[] = [];

  for (const item of items) {
    if (item.qty <= 0) continue;
    const stock = stockMap.get(item.productTypeId);
    const availableQty = stock ? stock.quantity : 0;
    if (item.qty > availableQty) {
      throw new Error(`Stok jenis (${stock ? stock.productTypeId : item.productTypeId}) tidak mencukupi untuk sale (tersedia: ${availableQty}, diminta: ${item.qty})`);
    }
    const price = item.price ?? (stock ? stock.price : 0);
    const total = item.qty * price;
    amount += total;
    processedItems.push({
      productTypeId: item.productTypeId,
      qty: item.qty,
      price,
      total,
      variants: item.variants,
    });
  }

  return {
    amount,
    valuasiDelta: -amount,
    piutangDelta: +amount,
    processedItems,
  };
}

type TxClient = Prisma.TransactionClient | PrismaClient;

/**
 * Core recalculate function conforming to Section 5
 */
export async function recalculateOutletFinance(tx: TxClient, outletId: string) {
  // 1. Fetch outlet type stocks
  const typeStocks = await tx.outletTypeStock.findMany({
    where: { outlet_id: outletId },
    include: { product_type: true },
  });

  // 2. Fetch all transactions
  const transactions = await tx.outletTransaction.findMany({
    where: { outlet_id: outletId },
  });

  // Valuasi stok: Σ quantity * (harga_beli ?? base_price)
  const valuasiStok = typeStocks.reduce((sum, s) => {
    const price = s.harga_beli != null ? Number(s.harga_beli) : Number(s.product_type.base_price);
    return sum + s.quantity * price;
  }, 0);

  // Piutang: max(0, Σ piutang_delta)
  // Support legacy PIUTANG / PIUTANG_MANUAL transactions if piutang_delta is not yet backfilled
  const piutangSum = transactions.reduce((sum, t) => {
    const delta = Number(t.piutang_delta || 0);
    if (delta !== 0) return sum + delta;
    if (t.type === TRANSACTION_TYPES.PIUTANG_MANUAL || t.type === 'PIUTANG') {
      return sum + Number(t.amount || 0);
    }
    return sum;
  }, 0);
  const piutang = Math.max(0, piutangSum);

  // Payment: Σ transactions[type='PAYMENT'].amount
  // Also count legacy 'PELUNASAN' if present
  const payment = transactions.reduce((sum, t) => {
    if (t.type === TRANSACTION_TYPES.PAYMENT || t.type === 'PELUNASAN') {
      return sum + Number(t.amount || 0);
    }
    return sum;
  }, 0);

  // Valuasi Pending: Σ transactions[type='PAYMENT' && breakdown_status='PENDING'].amount
  const valuasiPending = transactions.reduce((sum, t) => {
    if (
      (t.type === TRANSACTION_TYPES.PAYMENT || t.type === 'PELUNASAN') &&
      t.breakdown_status === BREAKDOWN_STATUS.PENDING
    ) {
      return sum + Number(t.amount || 0);
    }
    return sum;
  }, 0);

  // Legacy mirrors
  const sisaTagihan = piutang;
  const tagihan = payment + piutang;

  const updatedOutlet = await tx.outlet.update({
    where: { id: outletId },
    data: {
      valuasi_stok: new Prisma.Decimal(valuasiStok),
      piutang: new Prisma.Decimal(piutang),
      payment: new Prisma.Decimal(payment),
      valuasi_pending: new Prisma.Decimal(valuasiPending),
      sisa_tagihan: new Prisma.Decimal(sisaTagihan),
      tagihan: new Prisma.Decimal(tagihan),
    },
  });

  return updatedOutlet;
}

/**
 * Post Shipment to Outlet (Hooked on warehouse outbound to outlet)
 */
export async function postShipment(
  tx: TxClient,
  params: {
    outletId: string;
    items: Array<{ productId: string; qty: number }>;
    date?: Date;
    description?: string;
  }
) {
  const { outletId, items, date = new Date(), description } = params;

  // 1. Fetch products to get product_type_id
  const productIds = items.map((i) => i.productId);
  const products = await tx.product.findMany({
    where: { id: { in: productIds } },
    include: { product_type: true },
  });
  const productMap = new Map(products.map((p) => [p.id, p]));

  // Verify all products have product_type_id
  for (const item of items) {
    const prod = productMap.get(item.productId);
    if (!prod) {
      throw new Error(`Produk dengan ID ${item.productId} tidak ditemukan.`);
    }
    if (!prod.product_type_id || !prod.product_type) {
      throw new Error(`Produk "${prod.name}" belum memiliki Jenis Produk (ProductType). Harap tautkan jenis produk terlebih dahulu.`);
    }
  }

  // 2. Group quantities by product_type_id
  const typeMap = new Map<string, { productTypeId: string; qty: number; basePrice: number }>();
  for (const item of items) {
    const prod = productMap.get(item.productId)!;
    const ptId = prod.product_type_id!;
    const existing = typeMap.get(ptId) || {
      productTypeId: ptId,
      qty: 0,
      basePrice: Number(prod.product_type!.base_price),
    };
    existing.qty += item.qty;
    typeMap.set(ptId, existing);
  }

  // 3. Update OutletStock (variant history) and OutletTypeStock (consignment stock)
  for (const item of items) {
    await tx.outletStock.upsert({
      where: {
        outlet_id_product_id: {
          outlet_id: outletId,
          product_id: item.productId,
        },
      },
      create: {
        outlet_id: outletId,
        product_id: item.productId,
        quantity: item.qty,
      },
      update: {
        quantity: { increment: item.qty },
      },
    });
  }

  let totalAmount = 0;
  const txItems: Array<{ product_type_id: string; qty: number; price: Prisma.Decimal; total: Prisma.Decimal }> = [];

  for (const group of Array.from(typeMap.values())) {
    const existingStock = await tx.outletTypeStock.findUnique({
      where: {
        outlet_id_product_type_id: {
          outlet_id: outletId,
          product_type_id: group.productTypeId,
        },
      },
    });

    const price = existingStock?.harga_beli != null ? Number(existingStock.harga_beli) : group.basePrice;
    const lineTotal = group.qty * price;
    totalAmount += lineTotal;

    await tx.outletTypeStock.upsert({
      where: {
        outlet_id_product_type_id: {
          outlet_id: outletId,
          product_type_id: group.productTypeId,
        },
      },
      create: {
        outlet_id: outletId,
        product_type_id: group.productTypeId,
        quantity: group.qty,
        harga_beli: new Prisma.Decimal(price),
      },
      update: {
        quantity: { increment: group.qty },
      },
    });

    txItems.push({
      product_type_id: group.productTypeId,
      qty: group.qty,
      price: new Prisma.Decimal(price),
      total: new Prisma.Decimal(lineTotal),
    });
  }

  // 4. Create OutletTransaction
  const txRecord = await tx.outletTransaction.create({
    data: {
      outlet_id: outletId,
      type: TRANSACTION_TYPES.SHIPMENT,
      amount: new Prisma.Decimal(totalAmount),
      valuasi_delta: new Prisma.Decimal(totalAmount),
      piutang_delta: new Prisma.Decimal(0),
      description: description || 'Pengiriman stok gudang ke outlet',
      date,
      items: {
        create: txItems,
      },
    },
  });

  // 5. Recalculate
  await recalculateOutletFinance(tx, outletId);

  return txRecord;
}

/**
 * Ambil bobot total kiriman per varian ke outlet (berdasarkan OutboundShipment tujuan OUTLET)
 */
async function getOutletVariantShipmentWeights(tx: TxClient, outletId: string): Promise<Map<string, number>> {
  const shippedRows = await tx.outboundItem.findMany({
    where: {
      shipment: {
        outlet_id: outletId,
        destination_type: 'OUTLET',
      },
    },
    select: { product_id: true, qty: true },
  });
  const weights = new Map<string, number>();
  for (const row of shippedRows) {
    weights.set(row.product_id, (weights.get(row.product_id) || 0) + Number(row.qty || 0));
  }
  return weights;
}

/**
 * Alokasikan qty terjual per kategori ke masing-masing varian rasa (manual jika diisi,
 * sisanya otomatis berdasarkan sisa stok & proporsi kiriman ke outlet), lalu kurangi
 * estimasi stok varian di OutletStock & catat histori di OutletTransactionVariant.
 */
async function applyCategoryVariantDeductions(
  tx: TxClient,
  outletId: string,
  transactionId: string,
  processedItems: ProcessedConsignmentItem[]
) {
  const nonZero = processedItems.filter((p) => p.qty > 0);
  if (nonZero.length === 0) return;

  const typeIds = Array.from(new Set(nonZero.map((p) => p.productTypeId)));
  const [products, outletStocks, shipmentWeights] = await Promise.all([
    tx.product.findMany({
      where: { product_type_id: { in: typeIds } },
      select: { id: true, product_type_id: true },
    }),
    tx.outletStock.findMany({
      where: { outlet_id: outletId },
      select: { id: true, product_id: true, quantity: true },
    }),
    getOutletVariantShipmentWeights(tx, outletId),
  ]);

  const stockByProductId = new Map(outletStocks.map((s) => [s.product_id, s]));
  const productIdsByType = new Map<string, string[]>();
  for (const p of products) {
    if (!p.product_type_id) continue;
    const list = productIdsByType.get(p.product_type_id) || [];
    list.push(p.id);
    productIdsByType.set(p.product_type_id, list);
  }

  for (const item of nonZero) {
    const typeProductIds = productIdsByType.get(item.productTypeId) || [];
    if (typeProductIds.length === 0) continue;

    const typeProductSet = new Set(typeProductIds);
    const validManual = (item.variants || []).filter((v) => typeProductSet.has(v.productId) && v.qty > 0);

    const variantInfos: VariantStockInfo[] = typeProductIds.map((pid) => {
      const os = stockByProductId.get(pid);
      return {
        productId: pid,
        remaining: os ? Math.max(0, os.quantity) : 0,
        shipped: shipmentWeights.get(pid) || 0,
      };
    });

    const { allocations } = allocateVariants({
      qty: item.qty,
      variants: variantInfos,
      manual: validManual,
    });

    for (const alloc of allocations) {
      if (alloc.qty <= 0) continue;
      const existingOs = stockByProductId.get(alloc.productId);
      if (existingOs) {
        const nextQty = Math.max(0, existingOs.quantity - alloc.qty);
        await tx.outletStock.update({
          where: { id: existingOs.id },
          data: { quantity: nextQty },
        });
        existingOs.quantity = nextQty;
      }

      await tx.outletTransactionVariant.create({
        data: {
          transaction_id: transactionId,
          product_id: alloc.productId,
          product_type_id: item.productTypeId,
          qty: alloc.qty,
          source: alloc.source,
        },
      });
    }
  }
}

/**
 * Post SALE (has_daily_sales = true)
 */
export async function postSale(
  tx: TxClient,
  params: {
    outletId: string;
    items: ConsignmentItemInput[];
    periodStart?: Date;
    periodEnd?: Date;
    date?: Date;
    description?: string;
  }
) {
  const { outletId, items, periodStart, periodEnd, date = new Date(), description } = params;

  const outlet = await tx.outlet.findUnique({
    where: { id: outletId },
    include: {
      type_stocks: {
        include: { product_type: true },
      },
    },
  });

  if (!outlet) throw new Error('Outlet tidak ditemukan');
  if (!outlet.has_daily_sales) {
    throw new Error('Fitur SALE hanya berlaku untuk outlet yang mengaktifkan mode Daily Sales.');
  }

  const stocks: PureStockInfo[] = outlet.type_stocks.map((s) => ({
    productTypeId: s.product_type_id,
    quantity: s.quantity,
    price: s.harga_beli != null ? Number(s.harga_beli) : Number(s.product_type.base_price),
  }));

  const calc = calculateSale({ items, stocks });

  // Deduct OutletTypeStock
  for (const item of calc.processedItems) {
    await tx.outletTypeStock.update({
      where: {
        outlet_id_product_type_id: {
          outlet_id: outletId,
          product_type_id: item.productTypeId,
        },
      },
      data: {
        quantity: { decrement: item.qty },
      },
    });
  }

  // Create transaction
  const txRecord = await tx.outletTransaction.create({
    data: {
      outlet_id: outletId,
      type: TRANSACTION_TYPES.SALE,
      amount: new Prisma.Decimal(calc.amount),
      valuasi_delta: new Prisma.Decimal(calc.valuasiDelta),
      piutang_delta: new Prisma.Decimal(calc.piutangDelta),
      description: description || 'Pencatatan Penjualan Harian (Daily Sales)',
      date,
      period_start: periodStart,
      period_end: periodEnd,
      items: {
        create: calc.processedItems.map((p: ProcessedConsignmentItem) => ({
          product_type_id: p.productTypeId,
          qty: p.qty,
          price: new Prisma.Decimal(p.price),
          total: new Prisma.Decimal(p.total),
        })),
      },
    },
  });

  await applyCategoryVariantDeductions(tx, outletId, txRecord.id, calc.processedItems);
  await recalculateOutletFinance(tx, outletId);

  return txRecord;
}

/**
 * Post PAYMENT (Handles Mode A and Mode B)
 */
export async function postPayment(
  tx: TxClient,
  params: {
    outletId: string;
    nominal: number;
    items?: ConsignmentItemInput[];
    settleOnly?: boolean;
    date?: Date;
    description?: string;
  }
) {
  const { outletId, nominal, items, settleOnly, date = new Date(), description } = params;

  const outlet = await tx.outlet.findUnique({
    where: { id: outletId },
    include: {
      type_stocks: {
        include: { product_type: true },
      },
    },
  });

  if (!outlet) throw new Error('Outlet tidak ditemukan');

  const currentPiutang = Number(outlet.piutang);
  const stocks: PureStockInfo[] = outlet.type_stocks.map((s) => ({
    productTypeId: s.product_type_id,
    quantity: s.quantity,
    price: s.harga_beli != null ? Number(s.harga_beli) : Number(s.product_type.base_price),
  }));

  if (outlet.has_daily_sales) {
    // Mode B: Modern Trade
    const calc = calculatePaymentModeB({ nominal, currentPiutang });

    const txRecord = await tx.outletTransaction.create({
      data: {
        outlet_id: outletId,
        type: TRANSACTION_TYPES.PAYMENT,
        amount: new Prisma.Decimal(nominal),
        valuasi_delta: new Prisma.Decimal(calc.valuasiDelta),
        piutang_delta: new Prisma.Decimal(calc.piutangDelta),
        unallocated: new Prisma.Decimal(calc.unallocated),
        needs_review: calc.needsReview,
        breakdown_status: calc.status,
        description: description || 'Pembayaran Penjualan Konsinyasi (Daily Sales)',
        date,
      },
    });

    await recalculateOutletFinance(tx, outletId);
    return txRecord;
  } else {
    // Mode A: Regular Outlet
    const calc = calculatePaymentModeA({
      nominal,
      currentPiutang,
      items,
      stocks,
      settleOnly,
    });

    // Deduct stocks if processed items exist
    for (const item of calc.processedItems) {
      await tx.outletTypeStock.update({
        where: {
          outlet_id_product_type_id: {
            outlet_id: outletId,
            product_type_id: item.productTypeId,
          },
        },
        data: {
          quantity: { decrement: item.qty },
        },
      });
    }

    const txRecord = await tx.outletTransaction.create({
      data: {
        outlet_id: outletId,
        type: TRANSACTION_TYPES.PAYMENT,
        amount: new Prisma.Decimal(nominal),
        valuasi_delta: new Prisma.Decimal(calc.valuasiDelta),
        piutang_delta: new Prisma.Decimal(calc.piutangDelta),
        unallocated: new Prisma.Decimal(calc.unallocated),
        needs_review: calc.needsReview,
        breakdown_status: calc.status,
        is_estimated: calc.isEstimated,
        description: description || (settleOnly ? 'Pelunasan Sisa Piutang' : 'Laporan Pembayaran Outlet'),
        date,
        items:
          calc.processedItems.length > 0
            ? {
                create: calc.processedItems.map((p: ProcessedConsignmentItem) => ({
                  product_type_id: p.productTypeId,
                  qty: p.qty,
                  price: new Prisma.Decimal(p.price),
                  total: new Prisma.Decimal(p.total),
                })),
              }
            : undefined,
      },
    });

    await applyCategoryVariantDeductions(tx, outletId, txRecord.id, calc.processedItems);
    await recalculateOutletFinance(tx, outletId);
    return txRecord;
  }
}

/**
 * Complete a PENDING payment with breakdown items (Section 4.3b)
 */
export async function completePendingPayment(
  tx: TxClient,
  params: {
    transactionId: string;
    items: ConsignmentItemInput[];
  }
) {
  const { transactionId, items } = params;

  const existingTx = await tx.outletTransaction.findUnique({
    where: { id: transactionId },
    include: {
      outlet: {
        include: {
          type_stocks: {
            include: { product_type: true },
          },
        },
      },
    },
  });

  if (!existingTx) throw new Error('Transaksi pembayaran tidak ditemukan');
  if (existingTx.breakdown_status !== BREAKDOWN_STATUS.PENDING) {
    throw new Error('Transaksi ini bukan transaksi dengan status PENDING');
  }

  const outlet = existingTx.outlet;
  const currentPiutang = Number(outlet.piutang);
  const nominal = Number(existingTx.amount);

  const stocks: PureStockInfo[] = outlet.type_stocks.map((s) => ({
    productTypeId: s.product_type_id,
    quantity: s.quantity,
    price: s.harga_beli != null ? Number(s.harga_beli) : Number(s.product_type.base_price),
  }));

  const calc = calculatePaymentModeA({
    nominal,
    currentPiutang,
    items,
    stocks,
    settleOnly: false,
  });

  // Deduct stocks
  for (const item of calc.processedItems) {
    await tx.outletTypeStock.update({
      where: {
        outlet_id_product_type_id: {
          outlet_id: outlet.id,
          product_type_id: item.productTypeId,
        },
      },
      data: {
        quantity: { decrement: item.qty },
      },
    });
  }

  // Delete existing items if any and replace
  await tx.outletTransactionItem.deleteMany({
    where: { transaction_id: transactionId },
  });

  const updatedTx = await tx.outletTransaction.update({
    where: { id: transactionId },
    data: {
      breakdown_status: BREAKDOWN_STATUS.COMPLETE,
      is_estimated: false,
      needs_review: calc.needsReview,
      valuasi_delta: new Prisma.Decimal(calc.valuasiDelta),
      piutang_delta: new Prisma.Decimal(calc.piutangDelta),
      unallocated: new Prisma.Decimal(calc.unallocated),
      items: {
        create: calc.processedItems.map((p: ProcessedConsignmentItem) => ({
          product_type_id: p.productTypeId,
          qty: p.qty,
          price: new Prisma.Decimal(p.price),
          total: new Prisma.Decimal(p.total),
        })),
      },
    },
  });

  await applyCategoryVariantDeductions(tx, outlet.id, updatedTx.id, calc.processedItems);
  await recalculateOutletFinance(tx, outlet.id);
  return updatedTx;
}

/**
 * Apply approved Stock Opname to OutletTypeStock (Section 4.5)
 */
export async function applyOpname(
  tx: TxClient,
  params: {
    opnameId: string;
  }
) {
  const { opnameId } = params;

  const opname = await tx.outletStockOpname.findUnique({
    where: { id: opnameId },
    include: {
      items: {
        include: { product_type: true },
      },
      outlet: {
        include: { type_stocks: true },
      },
    },
  });

  if (!opname) throw new Error('Data opname tidak ditemukan');
  if (opname.status === OPNAME_STATUS.APPROVED) {
    throw new Error('Opname ini sudah disetujui sebelumnya');
  }

  let totalSelisihValue = 0;
  const stockMap = new Map(opname.outlet.type_stocks.map((s) => [s.product_type_id, s]));
  const [outletStocks, typeProducts, shipmentWeights] = await Promise.all([
    tx.outletStock.findMany({
      where: { outlet_id: opname.outlet_id },
      include: { product: true },
    }),
    tx.product.findMany({
      where: { product_type_id: { in: opname.items.map((i) => i.product_type_id) } },
      select: { id: true, product_type_id: true },
    }),
    getOutletVariantShipmentWeights(tx, opname.outlet_id),
  ]);
  const weightRecord: Record<string, number> = {};
  shipmentWeights.forEach((v, k) => {
    weightRecord[k] = v;
  });

  for (const item of opname.items) {
    const existingStock = stockMap.get(item.product_type_id);
    const price = existingStock?.harga_beli != null ? Number(existingStock.harga_beli) : Number(item.product_type.base_price);
    const selisihQty = item.qty_actual - item.qty_system;
    const selisihVal = selisihQty * price;
    totalSelisihValue += selisihVal;

    await tx.outletTypeStock.upsert({
      where: {
        outlet_id_product_type_id: {
          outlet_id: opname.outlet_id,
          product_type_id: item.product_type_id,
        },
      },
      create: {
        outlet_id: opname.outlet_id,
        product_type_id: item.product_type_id,
        quantity: item.qty_actual,
        harga_beli: new Prisma.Decimal(price),
      },
      update: {
        quantity: item.qty_actual,
      },
    });

    // Selaraskan estimasi stok varian (OutletStock) dengan stok kategori hasil opname
    const prodIdsForType = typeProducts.filter((p) => p.product_type_id === item.product_type_id).map((p) => p.id);
    const currentVariantList = outletStocks
      .filter((s) => s.product?.product_type_id === item.product_type_id || prodIdsForType.includes(s.product_id))
      .map((s) => ({ productId: s.product_id, qty: s.quantity }));

    if (currentVariantList.length > 0) {
      const reconciled = reconcileVariantQuantities({
        current: currentVariantList,
        target: item.qty_actual,
        weights: weightRecord,
      });
      for (const r of reconciled) {
        await tx.outletStock.upsert({
          where: {
            outlet_id_product_id: {
              outlet_id: opname.outlet_id,
              product_id: r.productId,
            },
          },
          create: {
            outlet_id: opname.outlet_id,
            product_id: r.productId,
            quantity: r.qty,
          },
          update: {
            quantity: r.qty,
          },
        });
      }
    }
  }

  // Update Opname status
  await tx.outletStockOpname.update({
    where: { id: opnameId },
    data: { status: OPNAME_STATUS.APPROVED },
  });

  // Record ADJUSTMENT transaction
  await tx.outletTransaction.create({
    data: {
      outlet_id: opname.outlet_id,
      type: TRANSACTION_TYPES.ADJUSTMENT,
      amount: new Prisma.Decimal(Math.abs(totalSelisihValue)),
      valuasi_delta: new Prisma.Decimal(totalSelisihValue),
      piutang_delta: new Prisma.Decimal(0),
      description: `Penyesuaian Stok Opname Fisik (${opname.notes || 'Opname Berkala'})`,
      date: opname.date,
    },
  });

  await recalculateOutletFinance(tx, opname.outlet_id);
}

/**
 * Hapus transaksi outlet (PAYMENT, SALE, PIUTANG_MANUAL) & pulihkan stok kategori/varian yang terpotong
 */
export async function deleteOutletTransactionRecord(
  tx: TxClient,
  params: { transactionId: string }
) {
  const existing = await tx.outletTransaction.findUnique({
    where: { id: params.transactionId },
    include: { items: true, variants: true },
  });
  if (!existing) throw new Error('Transaksi tidak ditemukan');

  // Restore category stocks if SALE or PAYMENT deducted them
  if (
    existing.type === TRANSACTION_TYPES.SALE ||
    existing.type === TRANSACTION_TYPES.PAYMENT ||
    existing.type === TRANSACTION_TYPES.PELUNASAN
  ) {
    for (const item of existing.items) {
      await tx.outletTypeStock.upsert({
        where: {
          outlet_id_product_type_id: {
            outlet_id: existing.outlet_id,
            product_type_id: item.product_type_id,
          },
        },
        create: {
          outlet_id: existing.outlet_id,
          product_type_id: item.product_type_id,
          quantity: item.qty,
        },
        update: {
          quantity: { increment: item.qty },
        },
      });
    }

    for (const v of existing.variants) {
      await tx.outletStock.updateMany({
        where: {
          outlet_id: existing.outlet_id,
          product_id: v.product_id,
        },
        data: {
          quantity: { increment: v.qty },
        },
      });
    }
  }

  await tx.outletTransaction.delete({ where: { id: existing.id } });
  return await recalculateOutletFinance(tx, existing.outlet_id);
}
