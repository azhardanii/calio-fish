"use server";

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export async function updateOutletProductPrice(outletStockId: string, hargaBeli: number) {
  try {
    await prisma.outletStock.update({
      where: { id: outletStockId },
      data: { harga_beli: hargaBeli }
    });
    
    revalidatePath('/outlet');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function submitOutletPayment(outletId: string, amount: number) {
  try {
    const outlet = await prisma.outlet.findUnique({ where: { id: outletId } });
    if (!outlet) throw new Error('Outlet not found');
    
    await prisma.$transaction(async (tx) => {
      await tx.outlet.update({
        where: { id: outletId },
        data: {
          payment: Number(outlet.payment) + amount,
          sisa_tagihan: Number(outlet.sisa_tagihan) - amount,
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
    });

    revalidatePath('/outlet');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
