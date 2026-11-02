"use server";

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { verifySession } from '@/lib/auth';
import { recalculateOutletFinance } from '@/app/actions';

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
        data: { harga_beli: priceNum }
      });

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
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function submitOutletPayment(outletId: string, amount: number) {
  try {
    const user = await verifySession();
    const role = (user?.role || '').toUpperCase();
    if (role !== 'OWNER' && role !== 'ADMIN') {
      return { success: false, error: 'Akses ditolak: Hanya OWNER atau ADMIN yang dapat menginput pembayaran outlet manual.' };
    }

    const outlet = await prisma.outlet.findUnique({ where: { id: outletId } });
    if (!outlet) throw new Error('Outlet not found');
    
    await prisma.$transaction(async (tx) => {
      await tx.outlet.update({
        where: { id: outletId },
        data: {
          payment: Number(outlet.payment) + amount,
        }
      });
      
      await tx.outletTransaction.create({
        data: {
          outlet_id: outletId,
          type: 'PAYMENT',
          amount: amount,
          description: 'Pembayaran manual',
          date: new Date()
        }
      });

      await recalculateOutletFinance(tx, outletId);
    });

    revalidatePath('/outlet');
    revalidatePath('/marketing');
    revalidatePath('/overview');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
