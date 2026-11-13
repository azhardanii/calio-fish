"use server";

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { recalculateOutletFinance, addPiutang, addPelunasan } from '@/app/actions';
import { postShipment } from '@/lib/consignment/finance';

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
  warehouseId?: string;
}

export async function submitWarehouseInput(input: WarehouseInput) {
  try {
    // Start transaction
    await prisma.$transaction(async (tx) => {
      // Resolve source warehouse for physical stock deduction
      let sourceWarehouse: any = null;
      if (input.warehouseId) {
        sourceWarehouse = await tx.warehouse.findUnique({ where: { id: input.warehouseId } });
      }
      if (!sourceWarehouse) {
        sourceWarehouse = await tx.warehouse.findFirst({
          where: { OR: [{ type: 'FACTORY' }, { type: 'STORAGE' }] },
          orderBy: { created_at: 'asc' }
        });
      }

      const shipment = await tx.outboundShipment.create({
        data: {
          date: new Date(),
          destination_type: input.destinationType,
          destination_name: ['E-Commerce', 'Influencer', 'Sample'].includes(input.destinationType) ? input.destinationName : null,
          outlet_id: input.destinationType === 'Outlet' ? input.outletId : null,
          affiliate_id: input.destinationType === 'Affiliate' ? input.affiliateId : null,
          source_type: 'WAREHOUSE',
          source_name: sourceWarehouse?.name || 'Gudang Utama',
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

        // Check stock in the selected source warehouse
        if (sourceWarehouse) {
          const ws = await tx.warehouseStock.findUnique({
            where: { warehouse_id_product_id: { warehouse_id: sourceWarehouse.id, product_id: item.productId } }
          });
          const avail = ws ? ws.quantity : 0;
          if (avail < item.qty) {
            throw new Error(`Stok produk "${product.name}" di gudang "${sourceWarehouse.name}" tidak mencukupi (Tersedia: ${avail} pcs, Diminta: ${item.qty} pcs).`);
          }
          await tx.warehouseStock.update({
            where: { id: ws!.id },
            data: { quantity: { decrement: item.qty } }
          });
        }
        
        const newBalance = Math.max(0, product.stok - item.qty);
        await tx.product.update({
          where: { id: item.productId },
          data: { stok: newBalance }
        });

        await tx.stockTransaction.create({
          data: {
            product_id: item.productId,
            type: input.destinationType === 'Affiliate' ? 'SAMPLE_AFFILIATE' : 'OUTBOUND',
            flow: 'OUT',
            qty: item.qty,
            balance: newBalance,
            description: `Pengiriman ${input.destinationType} ke ${input.destinationName || 'Tujuan'} dari ${sourceWarehouse?.name || 'Gudang'} (ID: ${shipment.id.slice(0, 8)})`,
            date: new Date(),
            source_type: 'WAREHOUSE',
            source_id: sourceWarehouse?.id,
            destination_type: input.destinationType === 'Affiliate' ? 'AFFILIATE' : input.destinationType.toUpperCase(),
            destination_id: input.destinationType === 'Affiliate' ? input.affiliateId : (input.destinationType === 'Outlet' ? input.outletId : null)
          }
        });
      }

      // If destination is Affiliate, also log to DistribusiSample
      if (input.destinationType === 'Affiliate' && input.affiliateId) {
        const aff = await tx.affiliate.findUnique({ where: { id: input.affiliateId } });
        const totalPcs = input.items.reduce((s, it) => s + it.qty, 0);
        await tx.distribusiSample.create({
          data: {
            date: new Date(),
            jenis_sample: `Affiliate - ${aff?.nama || input.destinationName || 'Affiliate'}`,
            total_produk: totalPcs,
            biaya_ekspedisi: 0,
          }
        });
      }

      // Automatically update Outlet Consignment Stock and Ledger via postShipment (Section 4.1)
      if (input.destinationType === 'Outlet' && input.outletId) {
        await tx.outlet.update({
          where: { id: input.outletId },
          data: {
            order_baru: { increment: 1 }
          }
        });

        await postShipment(tx, {
          outletId: input.outletId,
          items: input.items,
          date: new Date(),
          description: `Otomatis dari Pengiriman Gudang (ID: #${shipment.id.slice(0, 8)})`
        });
      }
    });

    revalidatePath('/warehouse');
    revalidatePath('/input');
    revalidatePath('/outlet');
    revalidatePath('/marketing');
    revalidatePath('/overview');
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

    if (data.orderBaru > 0) {
      await prisma.outlet.update({
        where: { id: outletId },
        data: { order_baru: { increment: data.orderBaru } }
      });
    }

    if (data.tagihanBaru > 0) {
      await addPiutang(outletId, data.tagihanBaru, 'Penambahan tagihan/piutang manual dari form input');
    }

    if (data.payment > 0) {
      await addPelunasan(outletId, data.payment, 'Pembayaran pelunasan manual dari form input');
    }

    revalidatePath('/outlet');
    revalidatePath('/input');
    revalidatePath('/marketing');
    revalidatePath('/overview');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
