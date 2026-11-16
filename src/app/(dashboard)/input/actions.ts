"use server";

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { recalculateOutletFinance, addPiutang, addPelunasan } from '@/app/actions';
import { postShipment } from '@/lib/consignment/finance';

export async function submitPresensiInput(employeeId: string, status: string, alasan: string, dateStr?: string) {
  try {
    const parsedDate = dateStr ? new Date(`${dateStr}T08:00:00`) : new Date();
    const targetDate = isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
    await prisma.attendance.create({
      data: {
        date: targetDate,
        waktu: targetDate,
        employee_id: employeeId,
        status_kehadiran: status,
        alasan: alasan?.trim() || null
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
  targetWarehouseId?: string;
  boothId?: string;
  date?: string;
  notes?: string;
  biayaEkspedisi?: number;
}

export async function submitWarehouseInput(input: WarehouseInput) {
  try {
    const txDate = input.date ? new Date(`${input.date}T10:00:00`) : new Date();
    const effectiveDate = isNaN(txDate.getTime()) ? new Date() : txDate;

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

      const targetWarehouse =
        input.destinationType === 'Warehouse' && input.targetWarehouseId
          ? await tx.warehouse.findUnique({ where: { id: input.targetWarehouseId } })
          : null;
      const targetBooth =
        input.destinationType === 'Booth' && input.boothId
          ? await tx.eventBooth.findUnique({ where: { id: input.boothId } })
          : null;

      if (input.destinationType === 'Warehouse' && !targetWarehouse) {
        throw new Error('Pilih gudang tujuan transfer!');
      }
      if (input.destinationType === 'Warehouse' && sourceWarehouse && targetWarehouse?.id === sourceWarehouse.id) {
        throw new Error('Gudang asal dan tujuan tidak boleh sama!');
      }
      if (input.destinationType === 'Booth' && !targetBooth) {
        throw new Error('Pilih Event Booth tujuan!');
      }

      const resolvedDestName =
        input.destinationType === 'Warehouse'
          ? targetWarehouse!.name
          : input.destinationType === 'Booth'
          ? targetBooth!.nama
          : ['E-Commerce', 'Influencer', 'Sample', 'Distributor'].includes(input.destinationType)
          ? input.destinationName
          : null;

      const shipmentType =
        input.destinationType === 'Booth'
          ? 'TRANSFER_BOOTH'
          : input.destinationType === 'Sample' || input.destinationType === 'Affiliate'
          ? 'SAMPLE'
          : input.destinationType === 'Outlet'
          ? 'PENGIRIMAN_OUTLET'
          : input.destinationType === 'Warehouse'
          ? 'TRANSFER_GUDANG'
          : 'DISTRIBUSI';

      const shipment = await tx.outboundShipment.create({
        data: {
          date: effectiveDate,
          destination_type: input.destinationType.toUpperCase(),
          destination_name: resolvedDestName,
          outlet_id: input.destinationType === 'Outlet' ? input.outletId : null,
          affiliate_id: input.destinationType === 'Affiliate' ? input.affiliateId : null,
          source_type: 'WAREHOUSE',
          source_name: sourceWarehouse?.name || 'Gudang Utama',
          shipment_type: shipmentType,
          notes: input.notes?.trim() || null,
          status: 'SHIPPED',
          items: {
            create: input.items.map(item => ({
              product_id: item.productId,
              qty: item.qty
            }))
          }
        }
      });

      // Deduct source stock & update target stock if Warehouse/Booth transfer
      for (const item of input.items) {
        const product = await tx.product.findUnique({ where: { id: item.productId } });
        if (!product) throw new Error(`Product ${item.productId} not found`);

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

        let newBalance = Math.max(0, product.stok - item.qty);

        if (input.destinationType === 'Warehouse' && targetWarehouse) {
          await tx.warehouseStock.upsert({
            where: { warehouse_id_product_id: { warehouse_id: targetWarehouse.id, product_id: item.productId } },
            create: { warehouse_id: targetWarehouse.id, product_id: item.productId, quantity: item.qty },
            update: { quantity: { increment: item.qty } }
          });
          // Internal warehouse transfer preserves total central/storage product stock
          newBalance = product.stok;
        } else {
          await tx.product.update({
            where: { id: item.productId },
            data: { stok: newBalance }
          });
        }

        if (input.destinationType === 'Booth' && targetBooth) {
          await tx.boothStock.upsert({
            where: { booth_id_product_id: { booth_id: targetBooth.id, product_id: item.productId } },
            create: { booth_id: targetBooth.id, product_id: item.productId, quantity: item.qty },
            update: { quantity: { increment: item.qty } }
          });
        }

        await tx.stockTransaction.create({
          data: {
            product_id: item.productId,
            type: input.destinationType === 'Affiliate' ? 'SAMPLE_AFFILIATE' : 'OUTBOUND',
            flow: 'OUT',
            qty: item.qty,
            balance: newBalance,
            description: `Pengiriman ${input.destinationType} ke ${resolvedDestName || 'Tujuan'} dari ${sourceWarehouse?.name || 'Gudang'} (ID: ${shipment.id.slice(0, 8)})${input.notes ? ` - ${input.notes.trim()}` : ''}`,
            date: effectiveDate,
            source_type: 'WAREHOUSE',
            source_id: sourceWarehouse?.id,
            destination_type: input.destinationType === 'Affiliate' ? 'AFFILIATE' : input.destinationType.toUpperCase(),
            destination_id: input.destinationType === 'Affiliate'
              ? input.affiliateId
              : input.destinationType === 'Outlet'
              ? input.outletId
              : input.destinationType === 'Warehouse'
              ? targetWarehouse?.id
              : input.destinationType === 'Booth'
              ? targetBooth?.id
              : null
          }
        });
      }

      // If destination is Affiliate or Sample, also log to DistribusiSample
      if (input.destinationType === 'Affiliate' && input.affiliateId) {
        const aff = await tx.affiliate.findUnique({ where: { id: input.affiliateId } });
        const totalPcs = input.items.reduce((s, it) => s + it.qty, 0);
        await tx.distribusiSample.create({
          data: {
            date: effectiveDate,
            jenis_sample: `Affiliate - ${aff?.nama || input.destinationName || 'Affiliate'}`,
            total_produk: totalPcs,
            biaya_ekspedisi: Number(input.biayaEkspedisi || 0),
          }
        });
      } else if (input.destinationType === 'Sample') {
        const totalPcs = input.items.reduce((s, it) => s + it.qty, 0);
        await tx.distribusiSample.create({
          data: {
            date: effectiveDate,
            jenis_sample: input.destinationName || 'Sample / Endorse',
            total_produk: totalPcs,
            biaya_ekspedisi: Number(input.biayaEkspedisi || 0),
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
          date: effectiveDate,
          description: `Otomatis dari Pengiriman Gudang (ID: #${shipment.id.slice(0, 8)})${input.notes ? ` - ${input.notes.trim()}` : ''}`
        });
      }
    });

    revalidatePath('/warehouse');
    revalidatePath('/input');
    revalidatePath('/outlet');
    revalidatePath('/booth');
    revalidatePath('/distribusi-sample');
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
