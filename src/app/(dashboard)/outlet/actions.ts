"use server";

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { verifySession } from '@/lib/auth';
import { 
  postPayment, 
  postSale, 
  completePendingPayment, 
  applyOpname, 
  recalculateOutletFinance,
  deleteOutletTransactionRecord,
  ConsignmentItemInput 
} from '@/lib/consignment/finance';
import { OPNAME_STATUS } from '@/lib/consignment/constants';
import { Prisma } from '@prisma/client';
import { serializeDeep } from '@/lib/serialize';

export async function updateOutletProductPrice(outletStockId: string, hargaBeli: number) {
  try {
    const user = await verifySession();
    const role = (user?.role || '').toUpperCase();
    if (role !== 'OWNER' && role !== 'ADMIN') {
      return { success: false, error: 'Akses ditolak: Hanya OWNER atau ADMIN yang dapat mengubah harga outlet.' };
    }

    const priceNum = Number(hargaBeli);
    if (isNaN(priceNum) || priceNum < 0) {
      return { success: false, error: 'Harga harus berupa angka valid dan tidak boleh negatif.' };
    }

    const updatedOutlet = await prisma.$transaction(async (tx) => {
      const updatedStock = await tx.outletStock.update({
        where: { id: outletStockId },
        data: { harga_beli: priceNum },
        include: { product: true },
      });

      // Also sync to OutletTypeStock if product has product_type_id
      if (updatedStock.product?.product_type_id) {
        await tx.outletTypeStock.upsert({
          where: {
            outlet_id_product_type_id: {
              outlet_id: updatedStock.outlet_id,
              product_type_id: updatedStock.product.product_type_id,
            },
          },
          create: {
            outlet_id: updatedStock.outlet_id,
            product_type_id: updatedStock.product.product_type_id,
            harga_beli: new Prisma.Decimal(priceNum),
            quantity: 0,
          },
          update: {
            harga_beli: new Prisma.Decimal(priceNum),
          },
        });
      }

      return await recalculateOutletFinance(tx, updatedStock.outlet_id);
    });
    
    revalidatePath('/outlet');
    revalidatePath('/marketing');
    revalidatePath('/overview');
    return {
      success: true,
      tagihan: updatedOutlet ? Number(updatedOutlet.tagihan) : undefined,
      sisa_tagihan: updatedOutlet ? Number(updatedOutlet.sisa_tagihan) : undefined,
      payment: updatedOutlet ? Number(updatedOutlet.payment) : undefined,
      valuasi_stok: updatedOutlet ? Number(updatedOutlet.valuasi_stok) : undefined,
      piutang: updatedOutlet ? Number(updatedOutlet.piutang) : undefined,
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function updateOutletTypePrice(outletTypeStockId: string, hargaBeli: number, outletId?: string, productTypeId?: string) {
  try {
    const user = await verifySession();
    const role = (user?.role || '').toUpperCase();
    if (role !== 'OWNER' && role !== 'ADMIN') {
      return { success: false, error: 'Akses ditolak: Hanya OWNER atau ADMIN yang dapat mengubah harga outlet.' };
    }

    const priceNum = Number(hargaBeli);
    if (isNaN(priceNum) || priceNum < 0) {
      return { success: false, error: 'Harga harus berupa angka valid dan tidak boleh negatif.' };
    }

    const updatedOutlet = await prisma.$transaction(async (tx) => {
      let targetOutletId = outletId;
      if (outletTypeStockId && outletTypeStockId !== 'new') {
        const ots = await tx.outletTypeStock.update({
          where: { id: outletTypeStockId },
          data: { harga_beli: new Prisma.Decimal(priceNum) },
        });
        targetOutletId = ots.outlet_id;
      } else if (outletId && productTypeId) {
        const ots = await tx.outletTypeStock.upsert({
          where: {
            outlet_id_product_type_id: {
              outlet_id: outletId,
              product_type_id: productTypeId,
            },
          },
          create: {
            outlet_id: outletId,
            product_type_id: productTypeId,
            harga_beli: new Prisma.Decimal(priceNum),
            quantity: 0,
          },
          update: {
            harga_beli: new Prisma.Decimal(priceNum),
          },
        });
        targetOutletId = ots.outlet_id;
      } else {
        throw new Error('ID atau data jenis produk tidak valid');
      }

      return await recalculateOutletFinance(tx, targetOutletId!);
    });

    revalidatePath('/outlet');
    revalidatePath('/marketing');
    revalidatePath('/overview');
    return { success: true, updatedOutlet: serializeDeep(updatedOutlet) };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function submitOutletPayment(
  outletId: string,
  amount: number,
  items?: ConsignmentItemInput[],
  settleOnly?: boolean,
  description?: string,
  dateString?: string
) {
  try {
    const user = await verifySession();
    const role = (user?.role || '').toUpperCase();
    if (role !== 'OWNER' && role !== 'ADMIN') {
      return { success: false, error: 'Akses ditolak: Hanya OWNER atau ADMIN yang dapat menginput pembayaran outlet manual.' };
    }

    const nominal = Number(amount || 0);
    if (isNaN(nominal) || nominal < 0) {
      return { success: false, error: 'Nominal pembayaran tidak boleh negatif.' };
    }
    if (nominal === 0 && (settleOnly || !items || items.length === 0)) {
      return { success: false, error: 'Masukkan nominal pembayaran > 0 atau isi minimal 1 rincian produk terjual.' };
    }

    const date = dateString ? new Date(dateString) : new Date();

    const result = await prisma.$transaction(async (tx) => {
      return await postPayment(tx, {
        outletId,
        nominal,
        items,
        settleOnly,
        date,
        description: description || (settleOnly ? 'Pelunasan Sisa Piutang' : 'Laporan Pembayaran Outlet'),
      });
    }, { maxWait: 10000, timeout: 30000 });

    revalidatePath('/outlet');
    revalidatePath('/marketing');
    revalidatePath('/overview');
    return { success: true, data: serializeDeep(result) };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function submitOutletSale(
  outletId: string,
  items: ConsignmentItemInput[],
  periodStart?: string,
  periodEnd?: string,
  description?: string
) {
  try {
    const user = await verifySession();
    const role = (user?.role || '').toUpperCase();
    if (role !== 'OWNER' && role !== 'ADMIN') {
      return { success: false, error: 'Akses ditolak: Hanya OWNER atau ADMIN yang dapat menginput penjualan daily sales.' };
    }

    if (!items || items.length === 0) {
      return { success: false, error: 'Pilih minimal 1 jenis barang yang terjual.' };
    }

    const pStart = periodStart ? new Date(periodStart) : undefined;
    const pEnd = periodEnd ? new Date(periodEnd) : undefined;

    const result = await prisma.$transaction(async (tx) => {
      return await postSale(tx, {
        outletId,
        items,
        periodStart: pStart,
        periodEnd: pEnd,
        description: description || 'Pencatatan Daily Sales Modern Trade',
      });
    }, { maxWait: 10000, timeout: 30000 });

    revalidatePath('/outlet');
    revalidatePath('/marketing');
    revalidatePath('/overview');
    return { success: true, data: serializeDeep(result) };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function completePendingPaymentAction(
  transactionId: string,
  items: ConsignmentItemInput[]
) {
  try {
    const user = await verifySession();
    const role = (user?.role || '').toUpperCase();
    if (role !== 'OWNER' && role !== 'ADMIN') {
      return { success: false, error: 'Akses ditolak: Hanya OWNER atau ADMIN yang dapat melengkapi pembayaran pending.' };
    }

    if (!items || items.length === 0) {
      return { success: false, error: 'Rincian produk terjual wajib diisi.' };
    }

    const result = await prisma.$transaction(async (tx) => {
      return await completePendingPayment(tx, {
        transactionId,
        items,
      });
    }, { maxWait: 10000, timeout: 30000 });

    revalidatePath('/outlet');
    revalidatePath('/marketing');
    revalidatePath('/overview');
    return { success: true, data: serializeDeep(result) };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function submitStockOpname(
  outletId: string,
  items: Array<{ productTypeId: string; qtyActual: number }>,
  notes?: string,
  saveAsDraft: boolean = false
) {
  try {
    const user = await verifySession();
    const role = (user?.role || '').toUpperCase();
    const isOwnerOrAdmin = role === 'OWNER' || role === 'ADMIN';

    if (!isOwnerOrAdmin && !saveAsDraft) {
      return { success: false, error: 'Akses ditolak: Hanya OWNER atau ADMIN yang dapat langsung menyetujui stok opname.' };
    }

    const outlet = await prisma.outlet.findUnique({
      where: { id: outletId },
      include: {
        type_stocks: { include: { product_type: true } },
      },
    });

    if (!outlet) return { success: false, error: 'Outlet tidak ditemukan' };

    const typeStockMap = new Map(outlet.type_stocks.map((s) => [s.product_type_id, s]));

    const opname = await prisma.$transaction(async (tx) => {
      const op = await tx.outletStockOpname.create({
        data: {
          outlet_id: outletId,
          date: new Date(),
          status: OPNAME_STATUS.DRAFT,
          notes: notes || 'Stok Opname Berkala',
          items: {
            create: items.map((it) => {
              const currentStock = typeStockMap.get(it.productTypeId);
              const qtySystem = currentStock ? currentStock.quantity : 0;
              const price = currentStock?.harga_beli != null 
                ? Number(currentStock.harga_beli) 
                : Number(currentStock?.product_type.base_price || 0);
              const selisih = it.qtyActual - qtySystem;
              const selisihVal = selisih * price;

              return {
                product_type_id: it.productTypeId,
                qty_system: qtySystem,
                qty_actual: it.qtyActual,
                selisih,
                selisih_value: new Prisma.Decimal(selisihVal),
              };
            }),
          },
        },
      });

      if (!saveAsDraft && isOwnerOrAdmin) {
        await applyOpname(tx, { opnameId: op.id });
      }
      return op;
    }, { maxWait: 10000, timeout: 30000 });

    revalidatePath('/outlet');
    revalidatePath('/marketing');
    revalidatePath('/overview');
    return { success: true, data: serializeDeep(opname) };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function approveStockOpnameAction(opnameId: string) {
  try {
    const user = await verifySession();
    const role = (user?.role || '').toUpperCase();
    if (role !== 'OWNER' && role !== 'ADMIN') {
      return { success: false, error: 'Hanya OWNER atau ADMIN yang dapat menyetujui stok opname.' };
    }

    await prisma.$transaction(async (tx) => {
      await applyOpname(tx, { opnameId });
    });

    revalidatePath('/outlet');
    revalidatePath('/marketing');
    revalidatePath('/overview');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function rejectStockOpnameAction(opnameId: string) {
  try {
    const user = await verifySession();
    const role = (user?.role || '').toUpperCase();
    if (role !== 'OWNER' && role !== 'ADMIN') {
      return { success: false, error: 'Hanya OWNER atau ADMIN yang dapat menolak stok opname.' };
    }

    await prisma.outletStockOpname.update({
      where: { id: opnameId },
      data: { status: OPNAME_STATUS.REJECTED },
    });

    revalidatePath('/outlet');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function updateOutletTransactionAction(
  transactionId: string,
  data: { description?: string; date?: string; amount?: number }
) {
  try {
    const user = await verifySession();
    const role = (user?.role || '').toUpperCase();
    if (role !== 'OWNER' && role !== 'ADMIN') {
      return { success: false, error: 'Hanya OWNER atau ADMIN yang dapat mengedit transaksi outlet.' };
    }

    const updated = await prisma.$transaction(async (tx) => {
      const existing = await tx.outletTransaction.findUnique({ where: { id: transactionId } });
      if (!existing) throw new Error('Transaksi tidak ditemukan');

      const updatePayload: any = {};
      if (data.description !== undefined) updatePayload.description = data.description;
      if (data.date) updatePayload.date = new Date(data.date);
      if (data.amount !== undefined && existing.type === 'PIUTANG_MANUAL') {
        const amt = Number(data.amount) || 0;
        updatePayload.amount = new Prisma.Decimal(amt);
        updatePayload.piutang_delta = new Prisma.Decimal(amt);
      }

      const txRec = await tx.outletTransaction.update({
        where: { id: transactionId },
        data: updatePayload,
      });

      await recalculateOutletFinance(tx, existing.outlet_id);
      return txRec;
    }, { maxWait: 10000, timeout: 30000 });

    revalidatePath('/outlet');
    revalidatePath('/marketing');
    revalidatePath('/overview');
    return { success: true, data: serializeDeep(updated) };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function deleteOutletTransactionAction(transactionId: string) {
  try {
    const user = await verifySession();
    const role = (user?.role || '').toUpperCase();
    if (role !== 'OWNER' && role !== 'ADMIN') {
      return { success: false, error: 'Hanya OWNER atau ADMIN yang dapat menghapus transaksi outlet.' };
    }

    await prisma.$transaction(async (tx) => {
      await deleteOutletTransactionRecord(tx, { transactionId });
    });

    revalidatePath('/outlet');
    revalidatePath('/marketing');
    revalidatePath('/overview');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function batchUpdateOutletProducts(params: {
  outletId: string;
  warehouseId?: string;
  note?: string;
  items: Array<{
    productId: string;
    targetQty?: number;
    hargaBeli?: number;
  }>;
}) {
  try {
    const user = await verifySession();
    const role = (user?.role || '').toUpperCase();
    if (role !== 'OWNER' && role !== 'ADMIN') {
      return { success: false, error: 'Akses ditolak: Hanya OWNER atau ADMIN yang dapat mengubah stok & harga outlet.' };
    }

    const { outletId, warehouseId, note, items } = params;
    if (!outletId || !Array.isArray(items) || items.length === 0) {
      return { success: false, error: 'Pilih minimal 1 produk untuk diperbarui.' };
    }

    for (const it of items) {
      if (it.targetQty !== undefined && (isNaN(Number(it.targetQty)) || Number(it.targetQty) < 0)) {
        return { success: false, error: 'Stok akhir tidak boleh kurang dari 0 pcs.' };
      }
      if (it.hargaBeli !== undefined && (isNaN(Number(it.hargaBeli)) || Number(it.hargaBeli) < 0)) {
        return { success: false, error: 'Harga jual tidak boleh negatif.' };
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const outlet = await tx.outlet.findUnique({ where: { id: outletId } });
      if (!outlet) throw new Error('Outlet tidak ditemukan.');

      const productIds = Array.from(new Set(items.map((it) => it.productId)));
      const [products, existingStocks] = await Promise.all([
        tx.product.findMany({
          where: { id: { in: productIds } },
          include: { product_type: true },
        }),
        tx.outletStock.findMany({
          where: { outlet_id: outletId, product_id: { in: productIds } },
        }),
      ]);

      const productMap = new Map(products.map((p) => [p.id, p]));
      const stockMap = new Map(existingStocks.map((s) => [s.product_id, s]));

      const parsedItems = items.map((it) => {
        const prod = productMap.get(it.productId);
        if (!prod) throw new Error('Salah satu produk tidak ditemukan di database.');
        const existing = stockMap.get(it.productId);
        const currentQty = existing ? existing.quantity : 0;
        const targetQty = it.targetQty !== undefined ? Math.round(Number(it.targetQty)) : currentQty;
        const diff = targetQty - currentQty;
        const nextPrice = it.hargaBeli !== undefined ? Number(it.hargaBeli) : undefined;
        return { prod, existing, currentQty, targetQty, diff, nextPrice };
      });

      const hasStockChanges = parsedItems.some((p) => p.diff !== 0);
      let targetWarehouse: any = null;
      if (hasStockChanges) {
        if (warehouseId) {
          targetWarehouse = await tx.warehouse.findUnique({ where: { id: warehouseId } });
        }
        if (!targetWarehouse) {
          targetWarehouse = await tx.warehouse.findFirst({
            where: { OR: [{ type: 'FACTORY' }, { type: 'STORAGE' }] },
            orderBy: { created_at: 'asc' },
          });
        }
        if (!targetWarehouse) {
          throw new Error('Gudang asal/tujuan barang tidak ditemukan.');
        }

        const outboundNeeds = parsedItems.filter((p) => p.diff > 0);
        if (outboundNeeds.length > 0) {
          const whStocks = await tx.warehouseStock.findMany({
            where: {
              warehouse_id: targetWarehouse.id,
              product_id: { in: outboundNeeds.map((o) => o.prod.id) },
            },
          });
          const whMap = new Map(whStocks.map((ws) => [ws.product_id, ws.quantity]));
          for (const need of outboundNeeds) {
            const avail = whMap.get(need.prod.id) ?? 0;
            if (avail < need.diff) {
              throw new Error(
                `Stok "${need.prod.name}" di gudang "${targetWarehouse.name}" tidak mencukupi (Tersedia: ${avail} pcs, Dibutuhkan: ${need.diff} pcs).`
              );
            }
          }
        }
      }

      const typeAdjustments = new Map<string, { qtyDelta: number; hargaBeli?: number; fallbackPrice: number }>();
      const outShipmentItems: Array<{ productId: string; prodName: string; qty: number; balance: number }> = [];
      const retShipmentItems: Array<{ productId: string; prodName: string; qty: number; balance: number }> = [];

      for (const item of parsedItems) {
        const effectivePrice =
          item.nextPrice !== undefined
            ? item.nextPrice
            : item.existing?.harga_beli != null
              ? Number(item.existing.harga_beli)
              : Number(item.prod.base_price);

        await tx.outletStock.upsert({
          where: {
            outlet_id_product_id: {
              outlet_id: outletId,
              product_id: item.prod.id,
            },
          },
          create: {
            outlet_id: outletId,
            product_id: item.prod.id,
            quantity: item.targetQty,
            harga_beli: effectivePrice,
          },
          update: {
            ...(item.diff !== 0 ? { quantity: item.targetQty } : {}),
            ...(item.nextPrice !== undefined ? { harga_beli: item.nextPrice } : {}),
          },
        });

        if (item.prod.product_type_id) {
          const cur = typeAdjustments.get(item.prod.product_type_id) || {
            qtyDelta: 0,
            fallbackPrice: effectivePrice,
          };
          cur.qtyDelta += item.diff;
          if (item.nextPrice !== undefined) {
            cur.hargaBeli = item.nextPrice;
          }
          typeAdjustments.set(item.prod.product_type_id, cur);
        }

        if (item.diff > 0 && targetWarehouse) {
          await tx.warehouseStock.update({
            where: {
              warehouse_id_product_id: {
                warehouse_id: targetWarehouse.id,
                product_id: item.prod.id,
              },
            },
            data: { quantity: { decrement: item.diff } },
          });
          outShipmentItems.push({
            productId: item.prod.id,
            prodName: item.prod.name,
            qty: item.diff,
            balance: item.targetQty,
          });
        } else if (item.diff < 0 && targetWarehouse) {
          const returnQty = Math.abs(item.diff);
          await tx.warehouseStock.upsert({
            where: {
              warehouse_id_product_id: {
                warehouse_id: targetWarehouse.id,
                product_id: item.prod.id,
              },
            },
            update: { quantity: { increment: returnQty } },
            create: {
              warehouse_id: targetWarehouse.id,
              product_id: item.prod.id,
              quantity: returnQty,
              returned_qty: 0,
            },
          });
          retShipmentItems.push({
            productId: item.prod.id,
            prodName: item.prod.name,
            qty: returnQty,
            balance: item.targetQty,
          });
        }
      }

      for (const [productTypeId, adj] of Array.from(typeAdjustments.entries())) {
        if (adj.qtyDelta === 0 && adj.hargaBeli === undefined) continue;
        await tx.outletTypeStock.upsert({
          where: {
            outlet_id_product_type_id: {
              outlet_id: outletId,
              product_type_id: productTypeId,
            },
          },
          create: {
            outlet_id: outletId,
            product_type_id: productTypeId,
            quantity: Math.max(0, adj.qtyDelta),
            harga_beli: new Prisma.Decimal(adj.hargaBeli ?? adj.fallbackPrice),
          },
          update: {
            ...(adj.qtyDelta !== 0 ? { quantity: { increment: adj.qtyDelta } } : {}),
            ...(adj.hargaBeli !== undefined ? { harga_beli: new Prisma.Decimal(adj.hargaBeli) } : {}),
          },
        });
      }

      if (outShipmentItems.length > 0 && targetWarehouse) {
        const shipment = await tx.outboundShipment.create({
          data: {
            date: new Date(),
            shipment_type: 'PENGIRIMAN_OUTLET',
            source_type: 'WAREHOUSE',
            source_name: targetWarehouse.name,
            destination_type: 'OUTLET',
            destination_name: outlet.nama,
            outlet_id: outletId,
            status: 'SHIPPED',
            employee_id: user?.id,
            notes: note || `Penyesuaian stok batch (${outShipmentItems.length} produk) dari ${targetWarehouse.name}`,
            items: {
              create: outShipmentItems.map((it) => ({ product_id: it.productId, qty: it.qty })),
            },
          },
        });
        await tx.stockTransaction.createMany({
          data: outShipmentItems.map((it) => ({
            product_id: it.productId,
            type: 'PENGIRIMAN_OUTLET',
            flow: 'IN',
            qty: it.qty,
            balance: it.balance,
            description: `Ambil Stok (+${it.qty} pcs) ke Outlet ${outlet.nama} dari ${targetWarehouse.name} (${shipment.id.slice(0, 8)})${note ? `: ${note}` : ''}`,
            date: new Date(),
            source_type: 'WAREHOUSE',
            source_id: targetWarehouse.id,
            destination_id: outletId,
            destination_type: 'OUTLET',
            employee_id: user?.id,
          })),
        });
      }

      if (retShipmentItems.length > 0 && targetWarehouse) {
        const shipment = await tx.outboundShipment.create({
          data: {
            date: new Date(),
            shipment_type: 'PENGEMBALIAN_OUTLET',
            source_type: 'OUTLET',
            source_name: outlet.nama,
            destination_type: 'WAREHOUSE',
            destination_name: targetWarehouse.name,
            outlet_id: outletId,
            status: 'SHIPPED',
            employee_id: user?.id,
            notes: note || `Pengembalian stok batch (${retShipmentItems.length} produk) ke ${targetWarehouse.name}`,
            items: {
              create: retShipmentItems.map((it) => ({ product_id: it.productId, qty: it.qty })),
            },
          },
        });
        await tx.stockTransaction.createMany({
          data: retShipmentItems.map((it) => ({
            product_id: it.productId,
            type: 'OPNAME_OUTLET',
            flow: 'OUT',
            qty: it.qty,
            balance: it.balance,
            description: `Kembalikan Stok (-${it.qty} pcs) dari Outlet ${outlet.nama} ke ${targetWarehouse.name} (${shipment.id.slice(0, 8)})${note ? `: ${note}` : ''}`,
            date: new Date(),
            source_type: 'OUTLET',
            source_id: outletId,
            destination_id: outletId,
            destination_type: 'OUTLET',
            employee_id: user?.id,
          })),
        });
      }

      const updatedOutlet = await recalculateOutletFinance(tx, outletId);
      const [freshStocks, freshTypeStocks] = await Promise.all([
        tx.outletStock.findMany({
          where: { outlet_id: outletId },
          include: {
            product: {
              select: { id: true, sku: true, name: true, short_name: true, base_price: true, product_type_id: true, is_active: true },
            },
          },
        }),
        tx.outletTypeStock.findMany({
          where: { outlet_id: outletId },
          include: {
            product_type: {
              select: { id: true, code: true, name: true, base_price: true },
            },
          },
        }),
      ]);

      return { updatedOutlet, freshStocks, freshTypeStocks };
    }, { maxWait: 10000, timeout: 30000 });

    revalidatePath('/outlet');
    revalidatePath('/warehouse');
    revalidatePath('/marketing');
    revalidatePath('/overview');

    return {
      success: true,
      valuasi_stok: Number(result.updatedOutlet.valuasi_stok),
      piutang: Number(result.updatedOutlet.piutang),
      payment: Number(result.updatedOutlet.payment),
      tagihan: Number(result.updatedOutlet.tagihan),
      sisa_tagihan: Number(result.updatedOutlet.sisa_tagihan),
      stocks: serializeDeep(result.freshStocks),
      type_stocks: serializeDeep(result.freshTypeStocks),
    };
  } catch (error: any) {
    return { success: false, error: error.message || 'Gagal menyimpan perubahan massal produk outlet.' };
  }
}
