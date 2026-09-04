"use server";

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export async function submitPresensiInput(employeeId: string, status: string, alasan: string) {
  try {
    await prisma.attendance.create({
      data: {
        date: new Date(),
        employee_id: employeeId,
        status_kehadiran: status,
        alasan: status !== 'HADIR' ? alasan : null
      }
    });
    revalidatePath('/karyawan');
    revalidatePath('/input');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

interface WarehouseInput {
  destinationType: string;
  destinationName: string;
  outletId: string;
  affiliateId: string;
  items: { productId: string; qty: number }[];
}

export async function submitWarehouseInput(input: WarehouseInput) {
  try {
    // Start transaction
    await prisma.$transaction(async (tx) => {
      const shipment = await tx.outboundShipment.create({
        data: {
          date: new Date(),
          destination_type: input.destinationType,
          destination_name: ['E-Commerce', 'Influencer', 'Sample'].includes(input.destinationType) ? input.destinationName : null,
          outlet_id: input.destinationType === 'Outlet' ? input.outletId : null,
          affiliate_id: input.destinationType === 'Affiliate' ? input.affiliateId : null,
          status: 'SHIPPED',
          items: {
            create: input.items.map(item => ({
              product_id: item.productId,
              qty: item.qty
            }))
          }
        }
      });

      // Deduct stock for each item
      for (const item of input.items) {
        const product = await tx.product.findUnique({ where: { id: item.productId } });
        if (!product) throw new Error(`Product ${item.productId} not found`);
        if (product.stok < item.qty) {
          throw new Error(`Stok tidak mencukupi untuk ${product.name} (Tersedia: ${product.stok} pcs, Diminta: ${item.qty} pcs).`);
        }
        
        const newBalance = product.stok - item.qty;
        
        await tx.product.update({
          where: { id: item.productId },
          data: { stok: newBalance }
        });

        await tx.stockTransaction.create({
          data: {
            product_id: item.productId,
            type: 'OUTBOUND',
            flow: 'OUT',
            qty: item.qty,
            balance: newBalance,
            description: `Pengiriman ${input.destinationType} (ID: ${shipment.id})`,
            date: new Date()
          }
        });
      }

      // Automatically update Outlet Stock and Billing if destination is Outlet
      if (input.destinationType === 'Outlet' && input.outletId) {
        let totalBilling = 0;
        
        for (const item of input.items) {
          const product = await tx.product.findUnique({ where: { id: item.productId } });
          if (!product) continue;
          
          // Find or create OutletStock
          const existingOutletStock = await tx.outletStock.findUnique({
            where: {
              outlet_id_product_id: {
                outlet_id: input.outletId,
                product_id: item.productId
              }
            }
          });

          let hargaBeli = product.base_price;
          if (existingOutletStock) {
            await tx.outletStock.update({
              where: { id: existingOutletStock.id },
              data: { quantity: existingOutletStock.quantity + item.qty }
            });
            if (existingOutletStock.harga_beli) {
              hargaBeli = existingOutletStock.harga_beli;
            }
          } else {
            await tx.outletStock.create({
              data: {
                outlet_id: input.outletId,
                product_id: item.productId,
                quantity: item.qty,
                harga_beli: product.base_price
              }
            });
          }

          totalBilling += (Number(hargaBeli) * item.qty);
        }

        if (totalBilling > 0) {
          const outlet = await tx.outlet.findUnique({ where: { id: input.outletId } });
          if (outlet) {
            const newTagihan = Number(outlet.tagihan) + totalBilling;
            const newSisaTagihan = Number(outlet.sisa_tagihan) + totalBilling;
            
            await tx.outlet.update({
              where: { id: input.outletId },
              data: {
                tagihan: newTagihan,
                sisa_tagihan: newSisaTagihan,
                order_baru: outlet.order_baru + 1
              }
            });

            await tx.outletTransaction.create({
              data: {
                outlet_id: input.outletId,
                type: 'BILLING',
                amount: totalBilling,
                description: `Otomatis dari Pengiriman (ID: ${shipment.id})`,
                date: new Date()
              }
            });
          }
        }
      }
    });

    revalidatePath('/warehouse');
    revalidatePath('/input');
    return { success: true };
  } catch (error: any) {
    console.error('Warehouse Submit Error:', error);
    return { success: false, error: error.message };
  }
}

export async function updateOutletInput(outletId: string, data: { orderBaru: number; tagihanBaru: number; payment: number }) {
  try {
    const outlet = await prisma.outlet.findUnique({ where: { id: outletId } });
    if (!outlet) throw new Error('Outlet tidak ditemukan');

    const newTagihan = Number(outlet.tagihan) + data.tagihanBaru;
    const newPayment = Number(outlet.payment) + data.payment;
    const newSisaTagihan = newTagihan - newPayment;

    await prisma.outlet.update({
      where: { id: outletId },
      data: {
        order_baru: outlet.order_baru + data.orderBaru,
        tagihan: newTagihan,
        payment: newPayment,
        sisa_tagihan: newSisaTagihan,
        updated_at: new Date()
      }
    });

    revalidatePath('/outlet');
    revalidatePath('/input');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
