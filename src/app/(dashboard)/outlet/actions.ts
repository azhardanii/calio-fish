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
  ConsignmentItemInput 
} from '@/lib/consignment/finance';
import { OPNAME_STATUS } from '@/lib/consignment/constants';
import { Prisma } from '@prisma/client';

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
    return { success: true, updatedOutlet };
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

    const nominal = Number(amount);
    if (isNaN(nominal) || nominal <= 0) {
      return { success: false, error: 'Nominal pembayaran harus lebih besar dari 0.' };
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
    });

    revalidatePath('/outlet');
    revalidatePath('/marketing');
    revalidatePath('/overview');
    return { success: true, data: result };
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
    });

    revalidatePath('/outlet');
    revalidatePath('/marketing');
    revalidatePath('/overview');
    return { success: true, data: result };
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
    });

    revalidatePath('/outlet');
    revalidatePath('/marketing');
    revalidatePath('/overview');
    return { success: true, data: result };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function submitStockOpname(
  outletId: string,
  items: Array<{ productTypeId: string; qtyActual: number }>,
  notes?: string
) {
  try {
    const user = await verifySession();
    const role = (user?.role || '').toUpperCase();
    const isOwnerOrAdmin = role === 'OWNER' || role === 'ADMIN';

    if (!isOwnerOrAdmin) {
      return { success: false, error: 'Akses ditolak: Hanya OWNER atau ADMIN yang dapat mengajukan stok opname.' };
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

      // Auto approve for OWNER/ADMIN
      await applyOpname(tx, { opnameId: op.id });
      return op;
    });

    revalidatePath('/outlet');
    revalidatePath('/marketing');
    revalidatePath('/overview');
    return { success: true, data: opname };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
