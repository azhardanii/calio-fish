'use server'

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { verifySession } from '@/lib/auth';
import { Prisma } from '@prisma/client';
import {
  recalculateOutletFinance as consignmentRecalculate,
  postPayment,
  postSale,
  postShipment,
} from '@/lib/consignment/finance';
import { TRANSACTION_TYPES } from '@/lib/consignment/constants';

// Karyawan
export async function createKaryawan(data: any, outletIds?: string[]) {
  if (data.posisi) {
    const rawPos = data.posisi.toUpperCase();
    if (rawPos === 'OWNER' || rawPos.includes('OWNER')) {
      data.role = 'OWNER';
    } else if (rawPos === 'ADMIN' || rawPos.includes('ADMIN')) {
      data.role = 'ADMIN';
    } else if (rawPos.includes('DISTRIBUTOR')) {
      data.role = 'DISTRIBUTOR';
    } else if (rawPos === 'STAFF MARKETING' || rawPos.includes('MARKETING')) {
      data.role = 'MARKETING';
    } else if (rawPos === 'STAFF PRODUKSI' || rawPos.includes('PRODUKSI')) {
      data.role = 'PRODUKSI';
    } else {
      data.role = rawPos || 'STAFF';
    }
  }
  const employee = await prisma.employee.create({ data });

  // If role is MARKETING and outletIds provided, assign them to this employee
  if (data.role === 'MARKETING' && outletIds && Array.isArray(outletIds) && outletIds.length > 0) {
    await prisma.outlet.updateMany({
      where: { id: { in: outletIds } },
      data: { pengelola_id: employee.id }
    });
  }

  revalidatePath('/karyawan');
  revalidatePath('/outlet');
  revalidatePath('/marketing');
  revalidatePath('/overview');
  return employee;
}

export async function updateKaryawan(id: string, data: any, outletIds?: string[]) {
  if (data.posisi) {
    const rawPos = data.posisi.toUpperCase();
    if (rawPos === 'OWNER' || rawPos.includes('OWNER')) {
      data.role = 'OWNER';
    } else if (rawPos === 'ADMIN' || rawPos.includes('ADMIN')) {
      data.role = 'ADMIN';
    } else if (rawPos.includes('DISTRIBUTOR')) {
      data.role = 'DISTRIBUTOR';
    } else if (rawPos === 'STAFF MARKETING' || rawPos.includes('MARKETING')) {
      data.role = 'MARKETING';
    } else if (rawPos === 'STAFF PRODUKSI' || rawPos.includes('PRODUKSI')) {
      data.role = 'PRODUKSI';
    } else {
      data.role = rawPos || 'STAFF';
    }
  }
  const employee = await prisma.employee.update({ where: { id }, data });

  // If role is changed to ADMIN or OWNER or PRODUKSI, clear any outlets previously managed by this employee
  if (data.role === 'ADMIN' || data.role === 'OWNER' || data.role === 'PRODUKSI') {
    await prisma.outlet.updateMany({
      where: { pengelola_id: id },
      data: { pengelola_id: null }
    });
  } else if (outletIds !== undefined && Array.isArray(outletIds)) {
    // If outletIds is passed for marketing, sync the handled outlets for this employee
    // 1. Remove pengelola_id for outlets unselected
    await prisma.outlet.updateMany({
      where: {
        pengelola_id: id,
        id: { notIn: outletIds }
      },
      data: { pengelola_id: null }
    });

    // 2. Set pengelola_id for selected outlets
    if (outletIds.length > 0) {
      await prisma.outlet.updateMany({
        where: { id: { in: outletIds } },
        data: { pengelola_id: id }
      });
    }
  }

  revalidatePath('/karyawan');
  revalidatePath('/outlet');
  revalidatePath('/marketing');
  revalidatePath('/overview');
  return employee;
}

export async function deleteKaryawan(id: string) {
  // Clear pengelola_id on any outlets managed by this employee before deleting
  await prisma.outlet.updateMany({
    where: { pengelola_id: id },
    data: { pengelola_id: null }
  });
  await prisma.employee.delete({ where: { id } });
  revalidatePath('/karyawan');
  revalidatePath('/outlet');
}

// Helper: Sinkronisasi otomatis Valuasi Stok, Piutang, dan Payment Outlet sesuai aturan bisnis baru
export async function recalculateOutletFinance(tx: any, outletId: string) {
  return await consignmentRecalculate(tx, outletId);
}

// Outlet
export async function createOutlet(
  data: any, 
  initialStocks?: { product_id: string; qty: number }[], 
  warehouseId?: string
) {
  const user = await verifySession();
  const role = (user?.role || '').toUpperCase();
  const isOwnerOrAdmin = role === 'OWNER' || role === 'ADMIN';
  const isDistributor = role === 'DISTRIBUTOR';

  if (!user || (!isOwnerOrAdmin && !isDistributor)) {
    throw new Error('Akses ditolak: Hanya OWNER, ADMIN, atau DISTRIBUTOR yang dapat menambah outlet.');
  }

  // Convert decimal fields if they come as strings
  if (data.tagihan !== undefined) data.tagihan = Number(data.tagihan);
  if (data.payment !== undefined) data.payment = Number(data.payment);
  if (data.sisa_tagihan !== undefined) data.sisa_tagihan = Number(data.sisa_tagihan);

  const assignedPengelolaId = isDistributor ? null : (data.pengelola_id || null);
  const assignedDistributorId = isDistributor ? user?.id : (data.distributor_id || null);

  // Anti-duplicate protection:
  const trimmedNama = (data.nama || '').trim();
  const tenSecondsAgo = new Date(Date.now() - 10000);
  const existingRecent = await prisma.outlet.findFirst({
    where: {
      nama: { equals: trimmedNama, mode: 'insensitive' },
      distributor_id: assignedDistributorId,
      created_at: { gte: tenSecondsAgo }
    }
  });

  if (existingRecent) {
    console.log(`[Anti-Spam] Outlet '${trimmedNama}' baru saja dibuat, mengabaikan duplikasi submission.`);
    return existingRecent;
  }

  // If initialStocks contains items > 0, validate warehouse and check sufficient stock
  const validInitialItems = (initialStocks || []).filter(item => item.qty > 0);
  let resolvedWarehouse: any = null;

  if (validInitialItems.length > 0) {
    if (warehouseId) {
      resolvedWarehouse = await prisma.warehouse.findUnique({ where: { id: warehouseId } });
    }
    if (!resolvedWarehouse) {
      resolvedWarehouse = await prisma.warehouse.findFirst({
        where: { OR: [{ type: 'FACTORY' }, { type: 'STORAGE' }] },
        orderBy: { created_at: 'asc' }
      });
    }

    if (!resolvedWarehouse) {
      throw new Error('Gudang asal barang tidak ditemukan.');
    }

    // Verify stock availability in the selected warehouse
    for (const item of validInitialItems) {
      const ws = await prisma.warehouseStock.findUnique({
        where: { warehouse_id_product_id: { warehouse_id: resolvedWarehouse.id, product_id: item.product_id } },
        include: { product: true }
      });
      const avail = ws ? ws.quantity : 0;
      if (avail < item.qty) {
        const prod = ws?.product || await prisma.product.findUnique({ where: { id: item.product_id } });
        throw new Error(`Stok produk "${prod?.name || item.product_id}" di gudang "${resolvedWarehouse.name}" tidak mencukupi (Tersedia: ${avail} pcs, Diminta: ${item.qty} pcs).`);
      }
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    const res = await tx.outlet.create({ 
      data: {
        nama: trimmedNama,
        tlp: data.tlp,
        alamat: data.alamat,
        wilayah: data.wilayah || (isDistributor ? user?.wilayah : null),
        status: data.status || 'Active',
        pic: data.pic,
        order_baru: data.order_baru || 0,
        tagihan: data.tagihan || 0,
        payment: data.payment || 0,
        sisa_tagihan: data.sisa_tagihan || 0,
        pengelola_id: assignedPengelolaId,
        distributor_id: assignedDistributorId,
      } 
    });

    const activeProducts = await tx.product.findMany({ where: { is_active: true } });
    const stockMap = new Map<string, number>();
    validInitialItems.forEach(it => stockMap.set(it.product_id, it.qty));

    // Create outlet stocks for all active products
    for (const p of activeProducts) {
      const initialQty = stockMap.get(p.id) || 0;
      await tx.outletStock.create({
        data: {
          outlet_id: res.id,
          product_id: p.id,
          quantity: initialQty,
        }
      });
    }

    // Deduct warehouse stocks and record transactions if initial stocks provided
    if (validInitialItems.length > 0 && resolvedWarehouse) {
      const shipment = await tx.outboundShipment.create({
        data: {
          date: new Date(),
          shipment_type: 'PENGIRIMAN_OUTLET',
          source_type: 'WAREHOUSE',
          source_name: resolvedWarehouse.name,
          destination_type: 'OUTLET',
          destination_name: res.nama,
          outlet_id: res.id,
          status: 'SHIPPED',
          employee_id: user.id,
          notes: `Stok awal outlet langsung dari gudang ${resolvedWarehouse.name}`,
          items: {
            create: validInitialItems.map(it => ({
              product_id: it.product_id,
              qty: it.qty,
            }))
          }
        }
      });

      for (const item of validInitialItems) {
        const ws = await tx.warehouseStock.findUnique({
          where: { warehouse_id_product_id: { warehouse_id: resolvedWarehouse.id, product_id: item.product_id } }
        });
        if (ws) {
          await tx.warehouseStock.update({
            where: { id: ws.id },
            data: { quantity: { decrement: item.qty } }
          });
        }

        await tx.stockTransaction.create({
          data: {
            product_id: item.product_id,
            type: 'PENGIRIMAN_OUTLET',
            flow: 'IN',
            qty: item.qty,
            balance: item.qty,
            description: `Stok Awal Outlet ${res.nama} dari gudang ${resolvedWarehouse.name} (Shipment: #${shipment.id.slice(0, 8)})`,
            date: new Date(),
            source_type: 'WAREHOUSE',
            source_id: resolvedWarehouse.id,
            destination_type: 'OUTLET',
            destination_id: res.id,
            employee_id: user.id,
          }
        });
      }

      await recalculateOutletFinance(tx, res.id);
    }

    return res;
  });

  revalidatePath('/outlet');
  revalidatePath('/karyawan');
  revalidatePath('/warehouse');
  revalidatePath('/pengiriman');
  revalidatePath('/marketing');
  revalidatePath('/overview');
  return result;
}

export async function updateOutlet(id: string, data: any) {
  const user = await verifySession();
  const role = (user?.role || '').toUpperCase();
  const isOwnerOrAdmin = role === 'OWNER' || role === 'ADMIN';
  const isDistributor = role === 'DISTRIBUTOR';

  const existingOutlet = await prisma.outlet.findUnique({ where: { id } });
  if (!existingOutlet) throw new Error('Outlet tidak ditemukan');

  if (!isOwnerOrAdmin) {
    if (!isDistributor || !user || existingOutlet.distributor_id !== user.id) {
      throw new Error('Akses ditolak: Anda hanya dapat mengubah data outlet milik Anda sendiri.');
    }
  }

  const updateData: any = {
    nama: data.nama,
    tlp: data.tlp,
    alamat: data.alamat,
    wilayah: data.wilayah,
    status: data.status,
    pic: data.pic,
  };

  // Only Owner / Admin can change pengelola_id, distributor_id, and finance figures
  if (isOwnerOrAdmin) {
    if (data.pengelola_id !== undefined) {
      updateData.pengelola_id = data.pengelola_id === '' ? null : data.pengelola_id;
    }
    if (data.distributor_id !== undefined) {
      updateData.distributor_id = data.distributor_id === '' ? null : data.distributor_id;
    }
    if (data.tagihan !== undefined) updateData.tagihan = Number(data.tagihan);
    if (data.payment !== undefined) updateData.payment = Number(data.payment);
    if (data.sisa_tagihan !== undefined) updateData.sisa_tagihan = Number(data.sisa_tagihan);
    if (data.order_baru !== undefined) updateData.order_baru = Number(data.order_baru);
  }
  
  // Clean undefined values
  Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);

  await prisma.outlet.update({ where: { id }, data: updateData });
  revalidatePath('/outlet');
  revalidatePath('/marketing');
  revalidatePath('/overview');
}

export async function addPiutang(outletId: string, amount: number, description: string = '', dateString?: string) {
  const user = await verifySession();
  const role = (user?.role || '').toUpperCase();
  const isOwnerOrAdmin = role === 'OWNER' || role === 'ADMIN';

  if (!isOwnerOrAdmin) {
    throw new Error('Akses ditolak: Hanya OWNER atau ADMIN yang dapat menginput tagihan secara manual via web dashboard.');
  }

  const outlet = await prisma.outlet.findUnique({ where: { id: outletId } });
  if (!outlet) throw new Error('Outlet tidak ditemukan');

  const updated = await prisma.$transaction(async (tx) => {
    await tx.outletTransaction.create({
      data: {
        outlet_id: outletId,
        type: TRANSACTION_TYPES.PIUTANG_MANUAL,
        amount: new Prisma.Decimal(amount),
        piutang_delta: new Prisma.Decimal(amount),
        valuasi_delta: new Prisma.Decimal(0),
        description: description || 'Penambahan Piutang Manual',
        date: dateString ? new Date(dateString) : new Date()
      }
    });
    return await consignmentRecalculate(tx, outletId);
  });

  revalidatePath('/outlet');
  revalidatePath('/marketing');
  revalidatePath('/overview');
  return updated ? { 
    tagihan: Number(updated.tagihan), 
    sisa_tagihan: Number(updated.sisa_tagihan), 
    payment: Number(updated.payment),
    piutang: Number(updated.piutang),
    valuasi_stok: Number(updated.valuasi_stok)
  } : null;
}

export async function addPelunasan(outletId: string, amount: number, description: string = '', dateString?: string) {
  const user = await verifySession();
  const role = (user?.role || '').toUpperCase();
  const isOwnerOrAdmin = role === 'OWNER' || role === 'ADMIN';

  if (!isOwnerOrAdmin) {
    throw new Error('Akses ditolak: Hanya OWNER atau ADMIN yang dapat menginput pelunasan secara manual via web dashboard.');
  }

  const outlet = await prisma.outlet.findUnique({ where: { id: outletId } });
  if (!outlet) throw new Error('Outlet tidak ditemukan');

  await prisma.$transaction(async (tx) => {
    return await postPayment(tx, {
      outletId,
      nominal: amount,
      settleOnly: true,
      description: description || 'Pelunasan Piutang Manual',
      date: dateString ? new Date(dateString) : new Date()
    });
  });

  const updated = await prisma.outlet.findUnique({ where: { id: outletId } });

  revalidatePath('/outlet');
  revalidatePath('/marketing');
  revalidatePath('/overview');
  return updated ? { 
    tagihan: Number(updated.tagihan), 
    sisa_tagihan: Number(updated.sisa_tagihan), 
    payment: Number(updated.payment),
    piutang: Number(updated.piutang),
    valuasi_stok: Number(updated.valuasi_stok)
  } : null;
}

export async function resetOutletFinance(outletId: string) {
  const user = await verifySession();
  const role = (user?.role || '').toUpperCase();
  const isOwnerOrAdmin = role === 'OWNER' || role === 'ADMIN';

  if (!isOwnerOrAdmin) {
    throw new Error('Akses ditolak: Hanya OWNER atau ADMIN yang dapat mereset data keuangan & tagihan outlet.');
  }

  const outlet = await prisma.outlet.findUnique({ where: { id: outletId } });
  if (!outlet) throw new Error('Outlet tidak ditemukan');

  // Reset OutletTransactionItem, OutletTransaction, and OutletTypeStock for this outlet
  const updated = await prisma.$transaction(async (tx) => {
    await tx.outletTransactionItem.deleteMany({
      where: { transaction: { outlet_id: outletId } }
    });
    await tx.outletTransaction.deleteMany({
      where: { outlet_id: outletId }
    });
    await tx.outletTypeStock.deleteMany({
      where: { outlet_id: outletId }
    });
    return await tx.outlet.update({
      where: { id: outletId },
      data: {
        tagihan: 0,
        payment: 0,
        sisa_tagihan: 0,
        order_baru: 0,
        valuasi_stok: 0,
        piutang: 0,
        valuasi_pending: 0,
      }
    });
  });

  revalidatePath('/outlet');
  revalidatePath('/marketing');
  revalidatePath('/overview');
  return updated;
}

export async function deleteOutlet(id: string) {
  const user = await verifySession();
  const role = (user?.role || '').toUpperCase();
  const isOwnerOrAdmin = role === 'OWNER' || role === 'ADMIN';
  const isDistributor = role === 'DISTRIBUTOR';

  const existingOutlet = await prisma.outlet.findUnique({ where: { id } });
  if (!existingOutlet) throw new Error('Outlet tidak ditemukan');

  if (!isOwnerOrAdmin) {
    if (!isDistributor || !user || existingOutlet.distributor_id !== user.id) {
      throw new Error('Akses ditolak: Anda hanya dapat menghapus outlet milik Anda sendiri.');
    }
  }

  await prisma.outlet.delete({ where: { id } });
  revalidatePath('/outlet');
  revalidatePath('/marketing');
  revalidatePath('/overview');
}

export async function adjustOutletStock(outletStockId: string, newQty: number, note: string, warehouseId?: string) {
  const user = await verifySession();
  const role = (user?.role || '').toUpperCase();
  const isOwnerOrAdmin = role === 'OWNER' || role === 'ADMIN';

  if (!isOwnerOrAdmin) {
    throw new Error('Akses ditolak: Hanya OWNER atau ADMIN yang dapat mengubah stok outlet.');
  }

  if (newQty < 0) {
    throw new Error('Stok akhir di outlet tidak boleh kurang dari 0 pcs.');
  }

  const os = await prisma.outletStock.findUnique({ 
    where: { id: outletStockId }, 
    include: { product: true, outlet: true } 
  });
  if (!os) throw new Error('Outlet stock tidak ditemukan');

  const diff = newQty - os.quantity;
  if (diff === 0) return null;

  // Resolve target warehouse (both for adding stock from warehouse and returning stock to warehouse)
  let targetWarehouse: any = null;
  if (warehouseId) {
    targetWarehouse = await prisma.warehouse.findUnique({ where: { id: warehouseId } });
  }
  if (!targetWarehouse && diff > 0) {
    // Find first warehouse that has enough stock for this product
    targetWarehouse = await prisma.warehouse.findFirst({
      where: {
        stocks: { some: { product_id: os.product_id, quantity: { gte: diff } } }
      }
    });
  }
  if (!targetWarehouse) {
    targetWarehouse = await prisma.warehouse.findFirst({
      where: { OR: [{ type: 'FACTORY' }, { type: 'STORAGE' }] },
      orderBy: { created_at: 'asc' }
    });
  }

  if (!targetWarehouse) {
    throw new Error('Gudang asal/tujuan barang tidak ditemukan.');
  }

  if (diff > 0) {
    const ws = await prisma.warehouseStock.findUnique({
      where: { warehouse_id_product_id: { warehouse_id: targetWarehouse.id, product_id: os.product_id } }
    });
    const avail = ws ? ws.quantity : 0;
    if (avail < diff) {
      throw new Error(`Stok produk "${os.product.name}" di gudang "${targetWarehouse.name}" tidak mencukupi (Tersedia: ${avail} pcs, Dibutuhkan: ${diff} pcs).`);
    }
  }

  const updatedOutlet = await prisma.$transaction(async (tx) => {
    await tx.outletStock.update({ where: { id: outletStockId }, data: { quantity: newQty } });

    // Sync OutletTypeStock for consignment valuation
    if (os.product?.product_type_id) {
      await tx.outletTypeStock.upsert({
        where: {
          outlet_id_product_type_id: {
            outlet_id: os.outlet_id,
            product_type_id: os.product.product_type_id,
          },
        },
        create: {
          outlet_id: os.outlet_id,
          product_type_id: os.product.product_type_id,
          quantity: Math.max(0, newQty),
          harga_beli: os.harga_beli ?? os.product.base_price,
        },
        update: {
          quantity: { increment: diff },
        },
      });
    }
    
    if (diff > 0 && targetWarehouse) {
      // Deduct warehouse stock
      await tx.warehouseStock.update({
        where: { warehouse_id_product_id: { warehouse_id: targetWarehouse.id, product_id: os.product_id } },
        data: { quantity: { decrement: diff } }
      });

      // Create OutboundShipment for this stock delivery
      const shipment = await tx.outboundShipment.create({
        data: {
          date: new Date(),
          shipment_type: 'PENGIRIMAN_OUTLET',
          source_type: 'WAREHOUSE',
          source_name: targetWarehouse.name,
          destination_type: 'OUTLET',
          destination_name: os.outlet.nama,
          outlet_id: os.outlet_id,
          status: 'SHIPPED',
          employee_id: user?.id,
          notes: note || `Penambahan stok outlet langsung dari gudang ${targetWarehouse.name}`,
          items: {
            create: [
              { product_id: os.product_id, qty: diff }
            ]
          }
        }
      });

      await tx.stockTransaction.create({
        data: {
          product_id: os.product_id,
          type: 'PENGIRIMAN_OUTLET',
          flow: 'IN',
          qty: diff,
          balance: newQty,
          description: `Ambil Stok (+${diff} pcs) ke Outlet ${os.outlet.nama} dari ${targetWarehouse.name} (${shipment.id.slice(0, 8)})${note ? `: ${note}` : ''}`,
          date: new Date(),
          source_type: 'WAREHOUSE',
          source_id: targetWarehouse.id,
          destination_id: os.outlet_id,
          destination_type: 'OUTLET',
          employee_id: user?.id
        }
      });
    } else if (diff < 0 && targetWarehouse) {
      // Return stock back to selected warehouse
      const returnQty = Math.abs(diff);
      await tx.warehouseStock.upsert({
        where: { warehouse_id_product_id: { warehouse_id: targetWarehouse.id, product_id: os.product_id } },
        update: { quantity: { increment: returnQty } },
        create: {
          warehouse_id: targetWarehouse.id,
          product_id: os.product_id,
          quantity: returnQty,
          returned_qty: 0,
        }
      });

      const shipment = await tx.outboundShipment.create({
        data: {
          date: new Date(),
          shipment_type: 'PENGEMBALIAN_OUTLET',
          source_type: 'OUTLET',
          source_name: os.outlet.nama,
          destination_type: 'WAREHOUSE',
          destination_name: targetWarehouse.name,
          outlet_id: os.outlet_id,
          status: 'SHIPPED',
          employee_id: user?.id,
          notes: note || `Pengembalian stok (-${returnQty} pcs) dari outlet ${os.outlet.nama} ke gudang ${targetWarehouse.name}`,
          items: {
            create: [
              { product_id: os.product_id, qty: returnQty }
            ]
          }
        }
      });

      await tx.stockTransaction.create({
        data: {
          product_id: os.product_id,
          type: 'OPNAME_OUTLET',
          flow: 'OUT',
          qty: returnQty,
          balance: newQty,
          description: `Kembalikan Stok (-${returnQty} pcs) dari Outlet ${os.outlet.nama} ke ${targetWarehouse.name} (${shipment.id.slice(0, 8)})${note ? `: ${note}` : ''}`,
          date: new Date(),
          source_type: 'OUTLET',
          source_id: os.outlet_id,
          destination_id: os.outlet_id,
          destination_type: 'OUTLET',
          employee_id: user?.id
        }
      });
    }

    return await recalculateOutletFinance(tx, os.outlet_id);
  });

  revalidatePath('/outlet');
  revalidatePath('/warehouse');
  revalidatePath('/pengiriman');
  revalidatePath('/marketing');
  revalidatePath('/overview');
  return updatedOutlet ? {
    tagihan: Number(updatedOutlet.tagihan),
    sisa_tagihan: Number(updatedOutlet.sisa_tagihan),
    payment: Number(updatedOutlet.payment),
    newQty,
  } : null;
}

// Affiliator (Affiliate table)
export async function createAffiliator(data: any) {
  if (data.ratecard !== undefined) data.ratecard = Number(data.ratecard);
  await prisma.affiliate.create({ data });
  revalidatePath('/affiliator');
}
export async function updateAffiliator(id: string, data: any) {
  if (data.ratecard !== undefined) data.ratecard = Number(data.ratecard);
  await prisma.affiliate.update({ where: { id }, data });
  revalidatePath('/affiliator');
}
export async function deleteAffiliator(id: string) {
  await prisma.affiliate.delete({ where: { id } });
  revalidatePath('/affiliator');
}

// Product
export async function createProduct(data: any) {
  if (data.base_price !== undefined) data.base_price = Number(data.base_price);
  if (data.stok !== undefined) data.stok = Number(data.stok);
  await prisma.product.create({ data });
  revalidatePath('/produk');
}
export async function updateProduct(id: string, data: any) {
  if (data.base_price !== undefined) data.base_price = Number(data.base_price);
  
  // Pisahkan stok dari data utama agar tidak ter-update sembarangan tanpa lewat ledger
  const { stok, ...updateData } = data;
  
  await prisma.product.update({ where: { id }, data: updateData });
  revalidatePath('/produk');
}
export async function deleteProduct(id: string) {
  await prisma.product.delete({ where: { id } });
  revalidatePath('/produk');
}

export async function getProductHistory(product_id: string) {
  return await prisma.stockTransaction.findMany({
    where: { product_id },
    orderBy: { created_at: 'desc' }
  });
}

export async function adjustStockOpname(id: string, newStok: number, note: string) {
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) return;
  
  const diff = newStok - product.stok;
  if (diff === 0) return; // No change
  
  // Update Product Stock
  await prisma.product.update({
    where: { id },
    data: { stok: newStok }
  });
  
  // Create Ledger Entry
  await prisma.stockTransaction.create({
    data: {
      product_id: id,
      type: 'OPNAME',
      flow: diff > 0 ? 'IN' : 'OUT',
      qty: Math.abs(diff),
      balance: newStok,
      description: note || 'Penyesuaian Manual (Stock Opname)',
      date: new Date()
    }
  });
  
  revalidatePath('/produk');
}

// Warehouse CRUD (Admin/Owner only)
export async function createWarehouse(data: { name: string; type: string; address?: string }) {
  const user = await verifySession();
  const role = (user?.role || '').toUpperCase();
  if (role !== 'OWNER' && role !== 'ADMIN') {
    throw new Error('Akses ditolak: Hanya OWNER atau ADMIN yang dapat menambahkan warehouse baru.');
  }

  const name = (data.name || '').trim();
  if (!name) {
    throw new Error('Nama warehouse wajib diisi.');
  }

  const type = (data.type || 'STORAGE').toUpperCase();
  if (type !== 'FACTORY' && type !== 'STORAGE') {
    throw new Error('Tipe warehouse harus FACTORY (Pabrik) atau STORAGE (Gudang Cabang).');
  }

  // Check duplicate name
  const existing = await prisma.warehouse.findFirst({
    where: { name: { equals: name, mode: 'insensitive' } }
  });
  if (existing) {
    throw new Error(`Warehouse dengan nama "${name}" sudah terdaftar.`);
  }

  const warehouse = await prisma.$transaction(async (tx) => {
    const created = await tx.warehouse.create({
      data: {
        name,
        type,
        address: (data.address || '').trim() || null,
      }
    });

    // Automatically initialize stock records for all products
    const products = await tx.product.findMany();
    for (const p of products) {
      await tx.warehouseStock.create({
        data: {
          warehouse_id: created.id,
          product_id: p.id,
          quantity: 0,
          returned_qty: 0,
        }
      });
    }

    return created;
  });

  revalidatePath('/warehouse');
  revalidatePath('/booth');
  revalidatePath('/pengiriman');
  return warehouse;
}

export async function updateWarehouse(id: string, data: { name: string; type: string; address?: string }) {
  const user = await verifySession();
  const role = (user?.role || '').toUpperCase();
  if (role !== 'OWNER' && role !== 'ADMIN') {
    throw new Error('Akses ditolak: Hanya OWNER atau ADMIN yang dapat mengedit warehouse.');
  }

  const name = (data.name || '').trim();
  if (!name) {
    throw new Error('Nama warehouse wajib diisi.');
  }

  const type = (data.type || 'STORAGE').toUpperCase();
  if (type !== 'FACTORY' && type !== 'STORAGE') {
    throw new Error('Tipe warehouse harus FACTORY (Pabrik) atau STORAGE (Gudang Cabang).');
  }

  // Check duplicate name on other warehouse
  const existing = await prisma.warehouse.findFirst({
    where: { 
      name: { equals: name, mode: 'insensitive' },
      id: { not: id }
    }
  });
  if (existing) {
    throw new Error(`Warehouse dengan nama "${name}" sudah digunakan oleh fasilitas lain.`);
  }

  const updated = await prisma.$transaction(async (tx) => {
    const res = await tx.warehouse.update({
      where: { id },
      data: {
        name,
        type,
        address: (data.address || '').trim() || null
      }
    });

    // Ensure all products have a stock record for this warehouse
    const products = await tx.product.findMany();
    for (const p of products) {
      await tx.warehouseStock.upsert({
        where: {
          warehouse_id_product_id: {
            warehouse_id: id,
            product_id: p.id
          }
        },
        update: {},
        create: {
          warehouse_id: id,
          product_id: p.id,
          quantity: 0,
          returned_qty: 0
        }
      });
    }

    return res;
  });

  revalidatePath('/warehouse');
  revalidatePath('/booth');
  revalidatePath('/pengiriman');
  return updated;
}

export async function deleteWarehouse(id: string) {
  const user = await verifySession();
  const role = (user?.role || '').toUpperCase();
  if (role !== 'OWNER' && role !== 'ADMIN') {
    throw new Error('Akses ditolak: Hanya OWNER atau ADMIN yang dapat menghapus warehouse.');
  }

  const warehouse = await prisma.warehouse.findUnique({
    where: { id },
    include: { stocks: true }
  });

  if (!warehouse) {
    throw new Error('Warehouse tidak ditemukan.');
  }

  // Check if warehouse has active stock
  const totalStock = warehouse.stocks.reduce((acc, s) => acc + s.quantity, 0);
  if (totalStock > 0) {
    throw new Error(`Gudang "${warehouse.name}" tidak dapat dihapus karena masih memiliki stok produk sebanyak ${totalStock} pcs. Silakan mutasikan atau kosongkan stok fisik terlebih dahulu.`);
  }

  // Check if this is the only warehouse
  const count = await prisma.warehouse.count();
  if (count <= 1) {
    throw new Error('Tidak dapat menghapus warehouse. Sistem memerlukan minimal satu fasilitas gudang.');
  }

  await prisma.warehouse.delete({
    where: { id }
  });

  revalidatePath('/warehouse');
  revalidatePath('/booth');
  revalidatePath('/pengiriman');
  return { success: true };
}

// Toggle Outlet Daily Sales mode (Modern Trade vs Regular)
export async function toggleOutletDailySales(outletId: string, hasDailySales: boolean) {
  const user = await verifySession();
  const role = (user?.role || '').toUpperCase();
  if (role !== 'OWNER' && role !== 'ADMIN') {
    throw new Error('Akses ditolak: Hanya OWNER atau ADMIN yang dapat mengubah mode outlet.');
  }

  const updated = await prisma.outlet.update({
    where: { id: outletId },
    data: { has_daily_sales: hasDailySales }
  });

  revalidatePath('/outlet');
  return updated;
}

// Warehouse Return Management (Layak Pakai vs Reject)
export async function createWarehouseReturn(data: {
  date: string;
  warehouseId: string;
  sourceType: string;
  sourceName?: string;
  sourceId?: string;
  notes?: string;
  items: Array<{ productId: string; qtyReturned: number; qtyReusable: number; qtyReject: number }>;
}) {
  const user = await verifySession();
  const role = (user?.role || '').toUpperCase();
  if (role !== 'OWNER' && role !== 'ADMIN' && role !== 'PRODUKSI' && role !== 'GUDANG') {
    throw new Error('Akses ditolak: Tidak memiliki wewenang untuk input retur gudang.');
  }

  for (const it of data.items) {
    if (it.qtyReusable + it.qtyReject !== it.qtyReturned) {
      throw new Error(`Total retur layak (${it.qtyReusable}) + reject (${it.qtyReject}) harus sama dengan total kembali (${it.qtyReturned})`);
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    const warehouse = await tx.warehouse.findUnique({ where: { id: data.warehouseId } });
    if (!warehouse) throw new Error('Warehouse tidak ditemukan');

    const retRecord = await tx.warehouseReturn.create({
      data: {
        date: new Date(data.date),
        warehouse_id: data.warehouseId,
        source_type: data.sourceType,
        source_name: data.sourceName || (data.sourceType === 'OUTLET' ? 'Outlet' : 'Pihak Luar'),
        source_id: data.sourceId,
        notes: data.notes,
        items: {
          create: data.items.map((it) => ({
            product_id: it.productId,
            qty_returned: it.qtyReturned,
            qty_reusable: it.qtyReusable,
            qty_reject: it.qtyReject,
          })),
        },
      },
    });

    for (const it of data.items) {
      // 1. Update WarehouseStock: reusable adds to quantity, reject adds to returned_qty
      const ws = await tx.warehouseStock.upsert({
        where: {
          warehouse_id_product_id: {
            warehouse_id: data.warehouseId,
            product_id: it.productId,
          },
        },
        create: {
          warehouse_id: data.warehouseId,
          product_id: it.productId,
          quantity: it.qtyReusable,
          returned_qty: it.qtyReject,
        },
        update: {
          quantity: { increment: it.qtyReusable },
          returned_qty: { increment: it.qtyReject },
        },
      });

      // 2. Product total stock increment by reusable
      if (it.qtyReusable > 0) {
        await tx.product.update({
          where: { id: it.productId },
          data: { stok: { increment: it.qtyReusable } },
        });

        await tx.stockTransaction.create({
          data: {
            product_id: it.productId,
            type: 'RETURN_REUSABLE',
            flow: 'IN',
            qty: it.qtyReusable,
            balance: ws.quantity + it.qtyReusable,
            description: `Retur Layak Pakai dari ${data.sourceName || data.sourceType} ke ${warehouse.name}`,
            date: new Date(data.date),
            destination_type: 'WAREHOUSE',
            destination_id: data.warehouseId,
            employee_id: user?.id,
          },
        });
      }

      if (it.qtyReject > 0) {
        await tx.stockTransaction.create({
          data: {
            product_id: it.productId,
            type: 'RETURN_REJECT',
            flow: 'LOSS',
            qty: it.qtyReject,
            balance: ws.quantity,
            description: `Retur Rusak/Reject (Kerugian) dari ${data.sourceName || data.sourceType} di ${warehouse.name}`,
            date: new Date(data.date),
            destination_type: 'WAREHOUSE',
            destination_id: data.warehouseId,
            employee_id: user?.id,
          },
        });
      }

      // If source is outlet, deduct outlet stocks and record tx RETURN
      if (data.sourceType === 'OUTLET' && data.sourceId) {
        const prod = await tx.product.findUnique({
          where: { id: it.productId },
          include: { product_type: true },
        });

        // Deduct variant stock
        await tx.outletStock.updateMany({
          where: { outlet_id: data.sourceId, product_id: it.productId },
          data: { quantity: { decrement: it.qtyReturned } },
        });

        if (prod?.product_type_id) {
          const ots = await tx.outletTypeStock.findUnique({
            where: {
              outlet_id_product_type_id: {
                outlet_id: data.sourceId,
                product_type_id: prod.product_type_id,
              },
            },
          });
          const price = ots?.harga_beli != null ? Number(ots.harga_beli) : Number(prod.product_type?.base_price || 0);
          const totalVal = it.qtyReturned * price;

          await tx.outletTypeStock.updateMany({
            where: {
              outlet_id: data.sourceId,
              product_type_id: prod.product_type_id,
            },
            data: { quantity: { decrement: it.qtyReturned } },
          });

          await tx.outletTransaction.create({
            data: {
              outlet_id: data.sourceId,
              type: TRANSACTION_TYPES.RETURN,
              amount: new Prisma.Decimal(totalVal),
              valuasi_delta: new Prisma.Decimal(-totalVal),
              piutang_delta: new Prisma.Decimal(0),
              description: `Retur Barang (${it.qtyReturned} pcs) ke Gudang ${warehouse.name}`,
              date: new Date(data.date),
            },
          });
        }
      }
    }

    if (data.sourceType === 'OUTLET' && data.sourceId) {
      await consignmentRecalculate(tx, data.sourceId);
    }

    return retRecord;
  });

  revalidatePath('/warehouse');
  revalidatePath('/overview');
  return { success: true, data: result };
}

// Tambah Stok / Produksi Manual (Section 4.7)
export async function createProductionEntry(data: {
  date: string;
  warehouseId: string;
  productId: string;
  qty: number;
  notes?: string;
}) {
  const user = await verifySession();
  const role = (user?.role || '').toUpperCase();
  if (role !== 'OWNER' && role !== 'ADMIN' && role !== 'PRODUKSI' && role !== 'GUDANG') {
    throw new Error('Akses ditolak: Tidak memiliki wewenang untuk input produksi.');
  }

  if (data.qty <= 0) {
    throw new Error('Jumlah produksi harus lebih dari 0.');
  }

  const result = await prisma.$transaction(async (tx) => {
    const warehouse = await tx.warehouse.findUnique({ where: { id: data.warehouseId } });
    if (!warehouse) throw new Error('Warehouse tidak ditemukan');
    const product = await tx.product.findUnique({ where: { id: data.productId } });
    if (!product) throw new Error('Produk tidak ditemukan');

    const entry = await tx.productionEntry.create({
      data: {
        date: new Date(data.date),
        warehouse_id: data.warehouseId,
        product_id: data.productId,
        qty: data.qty,
        notes: data.notes,
      },
    });

    const ws = await tx.warehouseStock.upsert({
      where: {
        warehouse_id_product_id: {
          warehouse_id: data.warehouseId,
          product_id: data.productId,
        },
      },
      create: {
        warehouse_id: data.warehouseId,
        product_id: data.productId,
        quantity: data.qty,
      },
      update: {
        quantity: { increment: data.qty },
      },
    });

    await tx.product.update({
      where: { id: data.productId },
      data: { stok: { increment: data.qty } },
    });

    await tx.stockTransaction.create({
      data: {
        product_id: data.productId,
        type: 'PRODUCTION',
        flow: 'IN',
        qty: data.qty,
        balance: ws.quantity + data.qty,
        description: `Tambah Stok Produksi di ${warehouse.name} (${data.notes || 'Produksi Manual'})`,
        date: new Date(data.date),
        destination_type: 'WAREHOUSE',
        destination_id: data.warehouseId,
        employee_id: user?.id,
      },
    });

    return entry;
  });

  revalidatePath('/warehouse');
  revalidatePath('/overview');
  return { success: true, data: result };
  return { success: true };
}

// Marketing Targets (Admin/Owner only)
export async function setMarketingTarget(employeeId: string, bulan: number, tahun: number, targetOmset: number) {
  const user = await verifySession();
  const role = (user?.role || '').toUpperCase();
  if (role !== 'OWNER' && role !== 'ADMIN') {
    throw new Error('Akses ditolak: Hanya OWNER atau ADMIN yang dapat mengatur target marketing.');
  }

  await prisma.marketingTarget.upsert({
    where: {
      employee_id_bulan_tahun: { employee_id: employeeId, bulan, tahun }
    },
    update: { target_omset: targetOmset },
    create: {
      employee_id: employeeId,
      bulan,
      tahun,
      target_omset: targetOmset,
    }
  });

  revalidatePath('/marketing');
  revalidatePath('/overview');
}

// Personal Buyer Transactions
export async function createPersonalBuyerTransaction(data: { 
  buyer_name: string; 
  product_name?: string;
  product_id?: string;
  quantity?: number;
  price_per_unit?: number;
  amount: number; 
  description?: string; 
  date?: string;
  warehouse_id?: string;
}) {
  const user = await verifySession();
  if (!user) throw new Error('Tidak terautentikasi');

  const role = (user.role || '').toUpperCase();
  const isOwnerOrAdmin = role === 'OWNER' || role === 'ADMIN';
  const isMarketing = role === 'MARKETING' || role.includes('MARKETING');

  if (!isOwnerOrAdmin && !isMarketing) {
    throw new Error('Akses ditolak: Hanya Marketing atau Admin/Owner yang dapat menambahkan transaksi personal buyer.');
  }

  const requestedQty = data.quantity && data.quantity > 0 ? data.quantity : 1;

  const result = await prisma.$transaction(async (tx) => {
    // 1. Check product & deduct stock if product is selected
    let resolvedProductName = data.product_name || 'Produk Personal';
    if (data.product_id) {
      const product = await tx.product.findUnique({ where: { id: data.product_id } });
      if (!product) throw new Error('Produk tidak ditemukan di database.');
      resolvedProductName = product.name;

      // Find warehouse (use supplied or first warehouse with enough stock or central warehouse)
      let targetWarehouse = data.warehouse_id 
        ? await tx.warehouse.findUnique({ where: { id: data.warehouse_id } })
        : await tx.warehouse.findFirst({
            where: {
              stocks: { some: { product_id: product.id, quantity: { gte: requestedQty } } }
            }
          });

      if (!targetWarehouse) {
        targetWarehouse = await tx.warehouse.findFirst({
          where: { OR: [{ type: 'FACTORY' }, { type: 'STORAGE' }] },
          orderBy: { created_at: 'asc' }
        });
      }

      if (targetWarehouse) {
        const ws = await tx.warehouseStock.findUnique({
          where: { warehouse_id_product_id: { warehouse_id: targetWarehouse.id, product_id: product.id } }
        });
        const currentQty = ws?.quantity || 0;
        if (currentQty < requestedQty) {
          throw new Error(`Stok produk "${product.name}" di gudang "${targetWarehouse.name}" tidak mencukupi (Tersedia: ${currentQty} pcs, Diminta: ${requestedQty} pcs). Transaksi Personal Buyer dibatalkan.`);
        }

        // Deduct warehouse stock
        await tx.warehouseStock.update({
          where: { id: ws!.id },
          data: { quantity: currentQty - requestedQty }
        });

        // Deduct global product stock
        const newStock = product.stok - requestedQty;
        await tx.product.update({
          where: { id: product.id },
          data: { stok: newStock }
        });

        // Create StockTransaction for audit trail
        await tx.stockTransaction.create({
          data: {
            product_id: product.id,
            type: 'PENJUALAN',
            flow: 'OUT',
            qty: requestedQty,
            balance: newStock,
            description: `Personal Buyer: ${data.buyer_name} (${data.description || 'Penjualan langsung'})`,
            date: data.date ? new Date(data.date) : new Date(),
            source_type: 'WAREHOUSE',
            source_id: targetWarehouse.id,
            destination_type: 'ENDUSER',
            employee_id: user.id
          }
        });
      }
    }

    // 2. Create PersonalBuyerTransaction record
    return await tx.personalBuyerTransaction.create({
      data: {
        employee_id: user.id,
        buyer_name: data.buyer_name,
        product_name: resolvedProductName,
        quantity: requestedQty,
        price_per_unit: data.price_per_unit || null,
        amount: data.amount,
        description: data.description || null,
        date: data.date ? new Date(data.date) : new Date(),
      }
    });
  });

  revalidatePath('/marketing');
  revalidatePath('/overview');
  revalidatePath('/warehouse');
  revalidatePath('/produk');
  return result;
}

export async function deletePersonalBuyerTransaction(id: string) {
  const user = await verifySession();
  if (!user) throw new Error('Tidak terautentikasi');

  const role = (user.role || '').toUpperCase();
  const isOwnerOrAdmin = role === 'OWNER' || role === 'ADMIN';

  const tx = await prisma.personalBuyerTransaction.findUnique({ where: { id } });
  if (!tx) throw new Error('Transaksi tidak ditemukan');

  // Marketing can only delete their own transactions
  if (!isOwnerOrAdmin && tx.employee_id !== user.id) {
    throw new Error('Akses ditolak: Anda hanya dapat menghapus transaksi milik Anda sendiri.');
  }

  await prisma.personalBuyerTransaction.delete({ where: { id } });
  revalidatePath('/marketing');
  revalidatePath('/overview');
}

// ═══════════════════════════════════════════════════════════
// PENGELUARAN / EXPENSES (CalioFish & Marketing)
// ═══════════════════════════════════════════════════════════
export async function createExpense(data: {
  category: string;
  title: string;
  amount: number;
  date?: string;
  description?: string;
  employee_id?: string;
}) {
  const user = await verifySession();
  if (!user) throw new Error('Tidak terautentikasi');

  const role = (user.role || '').toUpperCase();
  const isOwnerOrAdmin = role === 'OWNER' || role === 'ADMIN';
  const isMarketing = role === 'MARKETING' || role.includes('MARKETING');

  if (!isOwnerOrAdmin && !isMarketing) {
    throw new Error('Akses ditolak untuk mencatat pengeluaran.');
  }

  const assignedEmployeeId = isMarketing && !isOwnerOrAdmin ? user.id : (data.employee_id || user.id);

  const expense = await prisma.expense.create({
    data: {
      category: data.category || (isMarketing ? 'MARKETING' : 'OPERASIONAL'),
      title: data.title,
      amount: data.amount,
      date: data.date ? new Date(data.date) : new Date(),
      description: data.description || null,
      employee_id: assignedEmployeeId,
    }
  });

  revalidatePath('/marketing');
  revalidatePath('/overview');
  return expense;
}

export async function deleteExpense(id: string) {
  const user = await verifySession();
  if (!user) throw new Error('Tidak terautentikasi');

  const role = (user.role || '').toUpperCase();
  const isOwnerOrAdmin = role === 'OWNER' || role === 'ADMIN';

  const exp = await prisma.expense.findUnique({ where: { id } });
  if (!exp) throw new Error('Pengeluaran tidak ditemukan');

  if (!isOwnerOrAdmin && exp.employee_id !== user.id) {
    throw new Error('Akses ditolak: Anda hanya dapat menghapus pengeluaran milik Anda sendiri.');
  }

  await prisma.expense.delete({ where: { id } });
  revalidatePath('/marketing');
  revalidatePath('/overview');
}

// ═══════════════════════════════════════════════════════════
// EVENT & OPEN BOOTH / PAMERAN
// ═══════════════════════════════════════════════════════════

export async function createEventBooth(data: {
  nama: string;
  lokasi?: string;
  tanggal_mulai: string;
  tanggal_selesai: string;
  pic_id?: string;
  catatan?: string;
}) {
  const user = await verifySession();
  if (!user) throw new Error('Tidak terautentikasi');

  const role = (user.role || '').toUpperCase();
  const isOwnerOrAdmin = role === 'OWNER' || role === 'ADMIN';
  const isMarketing = role === 'MARKETING' || role.includes('MARKETING');

  if (!isOwnerOrAdmin && !isMarketing) {
    throw new Error('Akses ditolak: Hanya Admin/Owner atau Marketing yang dapat membuka booth.');
  }

  const picId = isOwnerOrAdmin ? (data.pic_id || user.id) : user.id;

  const booth = await prisma.eventBooth.create({
    data: {
      nama: data.nama.trim(),
      lokasi: data.lokasi?.trim() || null,
      tanggal_mulai: new Date(data.tanggal_mulai),
      tanggal_selesai: new Date(data.tanggal_selesai),
      status: 'AKTIF',
      pic_id: picId,
      catatan: data.catatan?.trim() || null,
    }
  });

  revalidatePath('/booth');
  revalidatePath('/marketing');
  return booth;
}

export async function updateEventBooth(id: string, data: {
  nama?: string;
  lokasi?: string;
  tanggal_mulai?: string;
  tanggal_selesai?: string;
  pic_id?: string;
  status?: string;
  catatan?: string;
}) {
  const user = await verifySession();
  if (!user) throw new Error('Tidak terautentikasi');

  const updateData: any = {};
  if (data.nama !== undefined) updateData.nama = data.nama.trim();
  if (data.lokasi !== undefined) updateData.lokasi = data.lokasi.trim();
  if (data.tanggal_mulai !== undefined) updateData.tanggal_mulai = new Date(data.tanggal_mulai);
  if (data.tanggal_selesai !== undefined) updateData.tanggal_selesai = new Date(data.tanggal_selesai);
  if (data.pic_id !== undefined) updateData.pic_id = data.pic_id;
  if (data.status !== undefined) updateData.status = data.status;
  if (data.catatan !== undefined) updateData.catatan = data.catatan;

  const booth = await prisma.eventBooth.update({
    where: { id },
    data: updateData,
  });

  revalidatePath('/booth');
  revalidatePath('/marketing');
  return booth;
}

export async function createBoothBundle(boothId: string, data: {
  nama: string;
  sku?: string;
  harga_jual: number;
  items: { product_id: string; qty: number }[];
}) {
  const user = await verifySession();
  if (!user) throw new Error('Tidak terautentikasi');

  if (!data.items || data.items.length === 0) {
    throw new Error('Paket bundling harus memiliki minimal 1 produk penyusun.');
  }

  const bundle = await prisma.boothBundle.create({
    data: {
      booth_id: boothId,
      nama: data.nama.trim(),
      sku: data.sku?.trim() || null,
      harga_jual: Number(data.harga_jual),
      items: {
        create: data.items.map(it => ({
          product_id: it.product_id,
          qty: Number(it.qty) || 1,
        }))
      }
    },
    include: {
      items: { include: { product: true } }
    }
  });

  revalidatePath('/booth');
  return bundle;
}

export async function deleteBoothBundle(bundleId: string) {
  const user = await verifySession();
  if (!user) throw new Error('Tidak terautentikasi');

  await prisma.boothBundle.delete({ where: { id: bundleId } });
  revalidatePath('/booth');
}

export async function transferStockToBooth(warehouseId: string, boothId: string, items: { product_id: string; qty: number }[], notes?: string) {
  const user = await verifySession();
  if (!user) throw new Error('Tidak terautentikasi');

  const booth = await prisma.eventBooth.findUnique({ where: { id: boothId } });
  if (!booth) throw new Error('Booth tidak ditemukan');
  if (booth.status !== 'AKTIF') throw new Error('Booth sudah selesai, tidak dapat menambah stok.');

  const warehouse = await prisma.warehouse.findUnique({ where: { id: warehouseId } });
  if (!warehouse) throw new Error('Gudang asal tidak ditemukan');

  await prisma.$transaction(async (tx) => {
    // 1. Create OutboundShipment
    const shipment = await tx.outboundShipment.create({
      data: {
        date: new Date(),
        destination_type: 'BOOTH',
        destination_name: booth.nama,
        source_type: 'WAREHOUSE',
        source_name: warehouse.name,
        status: 'SHIPPED',
        employee_id: user.id,
        notes: notes || `Transfer ke Booth ${booth.nama}`,
        shipment_type: 'PENGIRIMAN_BOOTH',
        booth_id: booth.id,
      }
    });

    for (const item of items) {
      if (item.qty <= 0) continue;

      // Check warehouse stock
      const ws = await tx.warehouseStock.findUnique({
        where: { warehouse_id_product_id: { warehouse_id: warehouseId, product_id: item.product_id } }
      });
      if (!ws || ws.quantity < item.qty) {
        const prod = await tx.product.findUnique({ where: { id: item.product_id } });
        throw new Error(`Stok produk "${prod?.name || item.product_id}" di ${warehouse.name} tidak mencukupi (Tersedia: ${ws?.quantity || 0}, Diminta: ${item.qty}).`);
      }

      // Decrement warehouse stock
      await tx.warehouseStock.update({
        where: { id: ws.id },
        data: { quantity: ws.quantity - item.qty }
      });

      // Decrement global product stock (holding transferred to booth)
      const product = await tx.product.findUnique({ where: { id: item.product_id } });
      const newGlobalStock = (product?.stok || 0) - item.qty;
      await tx.product.update({
        where: { id: item.product_id },
        data: { stok: newGlobalStock }
      });

      // Upsert Booth Stock
      await tx.boothStock.upsert({
        where: { booth_id_product_id: { booth_id: boothId, product_id: item.product_id } },
        update: { quantity: { increment: item.qty } },
        create: {
          booth_id: boothId,
          product_id: item.product_id,
          quantity: item.qty,
        }
      });

      // Create OutboundItem
      await tx.outboundItem.create({
        data: {
          shipment_id: shipment.id,
          product_id: item.product_id,
          qty: item.qty,
        }
      });

      // Create StockTransaction
      await tx.stockTransaction.create({
        data: {
          product_id: item.product_id,
          type: 'DISTRIBUSI_BOOTH',
          flow: 'OUT',
          qty: item.qty,
          balance: newGlobalStock,
          description: `Transfer dari ${warehouse.name} ke Booth ${booth.nama}: ${notes || ''}`,
          date: new Date(),
          source_type: 'WAREHOUSE',
          source_id: warehouseId,
          destination_type: 'BOOTH',
          destination_id: boothId,
          employee_id: user.id,
        }
      });
    }
  });

  revalidatePath('/booth');
  revalidatePath('/warehouse');
  revalidatePath('/produk');
}

export async function recordBoothSale(boothId: string, data: {
  bundle_id?: string;
  product_id?: string;
  item_name: string;
  qty: number;
  unit_price: number;
  metode_pembayaran: string;
  catatan?: string;
}) {
  const user = await verifySession();
  if (!user) throw new Error('Tidak terautentikasi');

  const booth = await prisma.eventBooth.findUnique({ where: { id: boothId } });
  if (!booth) throw new Error('Booth tidak ditemukan');
  if (booth.status !== 'AKTIF') throw new Error('Booth sudah selesai, tidak dapat mencatat penjualan.');

  const saleQty = Number(data.qty) || 1;
  const unitPrice = Number(data.unit_price) || 0;
  const totalPrice = saleQty * unitPrice;

  await prisma.$transaction(async (tx) => {
    // Deduct stock components
    if (data.bundle_id) {
      const bundle = await tx.boothBundle.findUnique({
        where: { id: data.bundle_id },
        include: { items: { include: { product: true } } }
      });
      if (!bundle) throw new Error('Paket bundling tidak ditemukan');

      for (const item of bundle.items) {
        const requiredQty = item.qty * saleQty;
        const bs = await tx.boothStock.findUnique({
          where: { booth_id_product_id: { booth_id: boothId, product_id: item.product_id } }
        });
        if (!bs || bs.quantity < requiredQty) {
          throw new Error(`Stok booth untuk "${item.product.name}" tidak mencukupi untuk paket "${bundle.nama}" (Tersedia: ${bs?.quantity || 0}, Dibutuhkan: ${requiredQty}).`);
        }
        await tx.boothStock.update({
          where: { id: bs.id },
          data: { quantity: bs.quantity - requiredQty }
        });
      }
    } else if (data.product_id) {
      const bs = await tx.boothStock.findUnique({
        where: { booth_id_product_id: { booth_id: boothId, product_id: data.product_id } },
        include: { product: true }
      });
      if (!bs || bs.quantity < saleQty) {
        throw new Error(`Stok booth untuk "${bs?.product.name || 'Produk'}" tidak mencukupi (Tersedia: ${bs?.quantity || 0}, Diminta: ${saleQty}).`);
      }
      await tx.boothStock.update({
        where: { id: bs.id },
        data: { quantity: bs.quantity - saleQty }
      });
    }

    // Create Sale record
    await tx.boothSale.create({
      data: {
        booth_id: boothId,
        bundle_id: data.bundle_id || null,
        product_id: data.product_id || null,
        item_name: data.item_name,
        qty: saleQty,
        unit_price: unitPrice,
        total_price: totalPrice,
        metode_pembayaran: data.metode_pembayaran || 'TUNAI',
        catatan: data.catatan || null,
        employee_id: user.id,
      }
    });

    // Increment Booth totals
    await tx.eventBooth.update({
      where: { id: boothId },
      data: {
        total_penjualan: { increment: totalPrice },
        kas_masuk: { increment: totalPrice },
      }
    });
  });

  revalidatePath('/booth');
  revalidatePath('/marketing');
}

export async function completeEventBooth(boothId: string, targetWarehouseId: string, notes?: string) {
  try {
    const user = await verifySession();
    if (!user) return { success: false, error: 'Sesi login telah berakhir. Silakan login kembali.' };

    const booth = await prisma.eventBooth.findUnique({
      where: { id: boothId },
      include: { stocks: { include: { product: true } } }
    });
    if (!booth) return { success: false, error: 'Booth tidak ditemukan' };
    if (booth.status === 'SELESAI') return { success: false, error: 'Booth ini sudah berstatus selesai sebelumnya.' };

    const targetWarehouse = await prisma.warehouse.findUnique({ where: { id: targetWarehouseId } });
    if (!targetWarehouse) return { success: false, error: 'Gudang tujuan pengembalian tidak ditemukan.' };

    const emp = user?.id ? await prisma.employee.findUnique({ where: { id: user.id }, select: { id: true } }) : null;
    const validEmployeeId = emp ? emp.id : null;

    await prisma.$transaction(async (tx) => {
      // 1. Process Return of good unsold inventory to active warehouse stock
      const remainingStocks = booth.stocks.filter(s => s.quantity > 0);

      for (const bs of remainingStocks) {
        // Return quantity directly to active warehouse stock (Bukan retur rusak!)
        await tx.warehouseStock.upsert({
          where: { warehouse_id_product_id: { warehouse_id: targetWarehouseId, product_id: bs.product_id } },
          update: { quantity: { increment: bs.quantity } },
          create: {
            warehouse_id: targetWarehouseId,
            product_id: bs.product_id,
            quantity: bs.quantity,
          }
        });

        // Increment global product.stok back into available system inventory
        const newGlobalStock = (bs.product?.stok || 0) + bs.quantity;
        await tx.product.update({
          where: { id: bs.product_id },
          data: { stok: { increment: bs.quantity } }
        });

        // Create StockTransaction for audit trail
        await tx.stockTransaction.create({
          data: {
            product_id: bs.product_id,
            type: 'PENGEMBALIAN_BOOTH',
            flow: 'IN',
            qty: bs.quantity,
            balance: newGlobalStock,
            description: `Pengembalian Sisa Stok Layak Jual dari Booth ${booth.nama} ke ${targetWarehouse.name} (${notes || 'Event Selesai'})`,
            date: new Date(),
            source_type: 'BOOTH',
            source_id: boothId,
            destination_type: 'WAREHOUSE',
            destination_id: targetWarehouseId,
            employee_id: validEmployeeId,
          }
        });

        // Clear remaining booth stock to 0
        await tx.boothStock.update({
          where: { id: bs.id },
          data: { quantity: 0 }
        });
      }

      // 2. Mark Booth as SELESAI
      await tx.eventBooth.update({
        where: { id: boothId },
        data: {
          status: 'SELESAI',
          catatan: notes ? (booth.catatan ? `${booth.catatan} | ${notes}` : notes) : booth.catatan,
        }
      });
    }, { timeout: 60000, maxWait: 15000 });

    revalidatePath('/booth');
    revalidatePath('/marketing');
    revalidatePath('/warehouse');
    revalidatePath('/produk');

    return { success: true };
  } catch (err: any) {
    console.error('Error completing event booth:', err);
    return { success: false, error: err.message || 'Gagal menyelesaikan event booth.' };
  }
}

export async function sendAffiliateSample(data: {
  affiliateId: string;
  warehouseId?: string;
  items: { productId: string; qty: number }[];
  notes?: string;
  biayaEkspedisi?: number;
}) {
  const user = await verifySession();
  if (!user) return { success: false, error: 'Sesi login telah berakhir' };

  try {
    // 1. Resolve Warehouse (default to Central/FACTORY or first warehouse)
    let targetWhId = data.warehouseId;
    if (!targetWhId) {
      const central = await prisma.warehouse.findFirst({
        where: { OR: [{ type: 'FACTORY' }, { type: 'STORAGE' }] },
        orderBy: { created_at: 'asc' }
      });
      targetWhId = central?.id;
    }
    if (!targetWhId) return { success: false, error: 'Gudang pusat asal tidak ditemukan' };

    const warehouse = await prisma.warehouse.findUnique({ where: { id: targetWhId } });
    if (!warehouse) return { success: false, error: 'Gudang pusat tidak ditemukan' };

    const affiliate = await prisma.affiliate.findUnique({ where: { id: data.affiliateId } });
    if (!affiliate) return { success: false, error: 'Affiliator tidak ditemukan' };

    const emp = user?.id ? await prisma.employee.findUnique({ where: { id: user.id }, select: { id: true } }) : null;
    const validEmployeeId = emp ? emp.id : null;

    await prisma.$transaction(async (tx) => {
      // Create OutboundShipment
      await tx.outboundShipment.create({
        data: {
          date: new Date(),
          shipment_type: 'SAMPLE',
          source_type: 'WAREHOUSE',
          source_name: warehouse.name,
          destination_type: 'AFFILIATE',
          destination_name: affiliate.nama,
          affiliate_id: affiliate.id,
          status: 'SHIPPED',
          employee_id: validEmployeeId,
          notes: data.notes || `Sample Affiliate ke ${affiliate.nama}`,
          items: {
            create: data.items.map(it => ({
              product_id: it.productId,
              qty: it.qty,
            }))
          }
        }
      });

      // Deduct warehouse stock & global stock
      for (const it of data.items) {
        const prod = await tx.product.findUnique({ where: { id: it.productId } });
        if (!prod) throw new Error('Produk tidak ditemukan');

        const ws = await tx.warehouseStock.findUnique({
          where: { warehouse_id_product_id: { warehouse_id: warehouse.id, product_id: it.productId } }
        });
        const currentWsQty = ws ? ws.quantity : 0;
        if (currentWsQty < it.qty) {
          throw new Error(`Stok ${prod.name} di ${warehouse.name} tidak cukup (tersedia ${currentWsQty} pcs, diminta ${it.qty} pcs)`);
        }

        // Decrement warehouseStock
        await tx.warehouseStock.update({
          where: { id: ws!.id },
          data: { quantity: { decrement: it.qty } }
        });

        // Decrement global product stok
        const newBalance = Math.max(0, prod.stok - it.qty);
        await tx.product.update({
          where: { id: it.productId },
          data: { stok: newBalance }
        });

        // Create StockTransaction
        await tx.stockTransaction.create({
          data: {
            product_id: it.productId,
            type: 'SAMPLE_AFFILIATE',
            flow: 'OUT',
            qty: it.qty,
            balance: newBalance,
            description: `Pengiriman Sample Affiliate ke ${affiliate.nama} (@${affiliate.akun_medsos}) dari ${warehouse.name}`,
            date: new Date(),
            source_type: 'WAREHOUSE',
            source_id: warehouse.id,
            destination_type: 'AFFILIATE',
            destination_id: affiliate.id,
            employee_id: validEmployeeId,
          }
        });
      }

      // Record to DistribusiSample
      const totalPcs = data.items.reduce((s, it) => s + it.qty, 0);
      await tx.distribusiSample.create({
        data: {
          date: new Date(),
          jenis_sample: `Affiliate - ${affiliate.nama}`,
          total_produk: totalPcs,
          biaya_ekspedisi: data.biayaEkspedisi || 0,
          employee_id: validEmployeeId
        }
      });
    }, { timeout: 60000, maxWait: 15000 });

    revalidatePath('/affiliator');
    revalidatePath('/warehouse');
    revalidatePath('/produk');
    revalidatePath('/pengiriman');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Gagal mengirim sample affiliate' };
  }
}

export async function deleteEventBooth(boothId: string) {
  const user = await verifySession();
  if (!user) throw new Error('Tidak terautentikasi');

  const role = (user.role || '').toUpperCase();
  const isOwnerOrAdmin = role === 'OWNER' || role === 'ADMIN';
  if (!isOwnerOrAdmin) throw new Error('Akses ditolak: Hanya Admin/Owner yang dapat menghapus Event/Booth.');

  const booth = await prisma.eventBooth.findUnique({
    where: { id: boothId },
    include: { stocks: true, sales: true }
  });
  if (!booth) throw new Error('Booth tidak ditemukan');

  // If booth has unsold active stock, return it to central warehouse before deleting
  const activeStocks = booth.stocks.filter(s => s.quantity > 0);
  if (activeStocks.length > 0) {
    const centralWarehouse = await prisma.warehouse.findFirst({
      where: { OR: [{ type: 'FACTORY' }, { type: 'STORAGE' }] },
      orderBy: { created_at: 'asc' }
    });
    if (centralWarehouse) {
      for (const bs of activeStocks) {
        await prisma.warehouseStock.upsert({
          where: { warehouse_id_product_id: { warehouse_id: centralWarehouse.id, product_id: bs.product_id } },
          update: { quantity: { increment: bs.quantity } },
          create: { warehouse_id: centralWarehouse.id, product_id: bs.product_id, quantity: bs.quantity }
        });
        await prisma.product.update({
          where: { id: bs.product_id },
          data: { stok: { increment: bs.quantity } }
        });
      }
    }
  }

  await prisma.eventBooth.delete({ where: { id: boothId } });
  revalidatePath('/booth');
  revalidatePath('/overview');
}

export async function updateBoothBundlePrice(bundleId: string, hargaJual: number) {
  const user = await verifySession();
  if (!user) throw new Error('Tidak terautentikasi');

  const role = (user.role || '').toUpperCase();
  const isOwnerOrAdmin = role === 'OWNER' || role === 'ADMIN';
  const isMarketing = role === 'MARKETING' || role.includes('MARKETING');
  if (!isOwnerOrAdmin && !isMarketing) throw new Error('Akses ditolak: Hanya Admin/Owner atau Marketing yang dapat mengubah harga bundle.');

  const bundle = await prisma.boothBundle.update({
    where: { id: bundleId },
    data: { harga_jual: hargaJual }
  });

  revalidatePath('/booth');
  return bundle;
}

// ═══════════════════════════════════════════════════════════
// DISTRIBUTOR ACTIONS
// ═══════════════════════════════════════════════════════════
export async function createDistributor(data: {
  nama: string;
  no_hp: string;
  wilayah?: string;
  warehouse_name?: string;
  address?: string;
}) {
  const user = await verifySession();
  if (!user) throw new Error('Tidak terautentikasi');

  const role = (user.role || '').toUpperCase();
  const isOwnerOrAdmin = role === 'OWNER' || role === 'ADMIN';
  if (!isOwnerOrAdmin) throw new Error('Akses ditolak: Hanya Admin/Owner yang dapat mendaftarkan distributor.');

  const cleanPhone = (data.no_hp || '').replace(/\D/g, '');

  const result = await prisma.$transaction(async (tx) => {
    const distributor = await tx.employee.create({
      data: {
        nama: data.nama,
        role: 'DISTRIBUTOR',
        posisi: 'Distributor',
        no_hp: cleanPhone || null,
        wilayah: data.wilayah || null,
        status_aktif: true,
      }
    });

    const warehouse = await tx.warehouse.create({
      data: {
        name: data.warehouse_name || `Gudang Distributor - ${data.nama}`,
        type: 'DISTRIBUTOR',
        address: data.address || data.wilayah || null,
        distributor_id: distributor.id,
      }
    });

    return { distributor, warehouse };
  });

  revalidatePath('/karyawan');
  revalidatePath('/warehouse');
  revalidatePath('/marketing');
  return result;
}

export async function updateDistributor(id: string, data: {
  nama?: string;
  no_hp?: string;
  wilayah?: string;
  status_aktif?: boolean;
}) {
  const user = await verifySession();
  if (!user) throw new Error('Tidak terautentikasi');

  const role = (user.role || '').toUpperCase();
  const isOwnerOrAdmin = role === 'OWNER' || role === 'ADMIN';
  if (!isOwnerOrAdmin) throw new Error('Akses ditolak: Hanya Admin/Owner yang dapat mengedit distributor.');

  const updated = await prisma.employee.update({
    where: { id },
    data: {
      ...(data.nama ? { nama: data.nama } : {}),
      ...(data.no_hp !== undefined ? { no_hp: data.no_hp.replace(/\D/g, '') || null } : {}),
      ...(data.wilayah !== undefined ? { wilayah: data.wilayah } : {}),
      ...(data.status_aktif !== undefined ? { status_aktif: data.status_aktif } : {}),
    }
  });

  revalidatePath('/karyawan');
  revalidatePath('/warehouse');
  revalidatePath('/marketing');
  return updated;
}

export async function setOnlineTarget(platform: string, target: number) {
  const user = await verifySession();
  if (!user) throw new Error('Tidak terautentikasi');

  const role = (user.role || '').toUpperCase();
  const isOwnerOrAdmin = role === 'OWNER' || role === 'ADMIN';
  if (!isOwnerOrAdmin) throw new Error('Akses ditolak: Hanya Admin/Owner yang dapat mengatur target e-commerce.');

  const key = `${platform.toLowerCase()}_target_mtd`;
  const label = `Target MTD ${platform.toUpperCase()}`;

  const updated = await prisma.reportSettings.upsert({
    where: { key },
    update: { value: target },
    create: { key, value: target, label }
  });

  revalidatePath('/ecommerce');
  revalidatePath('/overview');
  return updated;
}

export async function createProduksiKegiatan(data: {
  date: string;
  kegiatan: string;
  jenis_produksi?: string;
  bahan_baku?: number | null;
  bahan_jadi?: number | null;
  total_hasil_pcs?: number | null;
  product_id?: string;
  warehouse_id?: string;
}) {
  const user = await verifySession();
  if (!user) throw new Error('Tidak terautentikasi');

  if (!data.kegiatan || !data.kegiatan.trim()) {
    throw new Error('Nama kegiatan produksi wajib diisi');
  }

  const isPengemasan = /kemas|pengemasan|packing/i.test(data.kegiatan.trim());
  const pcs = data.total_hasil_pcs && !isNaN(Number(data.total_hasil_pcs)) ? Number(data.total_hasil_pcs) : 0;

  const result = await prisma.$transaction(async (tx) => {
    let resolvedProductName = data.jenis_produksi;
    let targetProduct: any = null;
    let targetWarehouse: any = null;

    if (isPengemasan && pcs > 0) {
      if (data.product_id) {
        targetProduct = await tx.product.findUnique({ where: { id: data.product_id } });
        if (targetProduct) resolvedProductName = targetProduct.name;
      }
      if (!targetProduct) {
        targetProduct = await tx.product.findFirst({ where: { is_active: true } });
      }

      if (data.warehouse_id) {
        targetWarehouse = await tx.warehouse.findUnique({ where: { id: data.warehouse_id } });
      }
      if (!targetWarehouse) {
        targetWarehouse = await tx.warehouse.findFirst({
          where: { OR: [{ type: 'FACTORY' }, { type: 'STORAGE' }] },
          orderBy: { created_at: 'asc' }
        });
      }
    }

    const prod = await tx.produksi.create({
      data: {
        date: data.date ? new Date(data.date) : new Date(),
        kegiatan: data.kegiatan.trim(),
        jenis_produksi: resolvedProductName?.trim() || null,
        bahan_baku: data.bahan_baku !== null && data.bahan_baku !== undefined && !isNaN(Number(data.bahan_baku)) ? Number(data.bahan_baku) : null,
        bahan_jadi: data.bahan_jadi !== null && data.bahan_jadi !== undefined && !isNaN(Number(data.bahan_jadi)) ? Number(data.bahan_jadi) : null,
        total_hasil_pcs: pcs > 0 ? pcs : null,
        employee_id: user.id,
      }
    });

    // Pengemasan (bahan kering -> bahan jadi pcs) masuk ke stok
    if (isPengemasan && pcs > 0 && targetProduct && targetWarehouse) {
      const newBalance = targetProduct.stok + pcs;
      await tx.product.update({
        where: { id: targetProduct.id },
        data: { stok: newBalance }
      });

      const ws = await tx.warehouseStock.findUnique({
        where: { warehouse_id_product_id: { warehouse_id: targetWarehouse.id, product_id: targetProduct.id } }
      });
      if (ws) {
        await tx.warehouseStock.update({
          where: { id: ws.id },
          data: { quantity: { increment: pcs } }
        });
      } else {
        await tx.warehouseStock.create({
          data: {
            warehouse_id: targetWarehouse.id,
            product_id: targetProduct.id,
            quantity: pcs
          }
        });
      }

      await tx.stockTransaction.create({
        data: {
          product_id: targetProduct.id,
          type: 'PRODUKSI',
          flow: 'IN',
          qty: pcs,
          balance: newBalance,
          description: `Hasil Pengemasan Produksi (+${pcs} pcs) ke gudang ${targetWarehouse.name}`,
          date: data.date ? new Date(data.date) : new Date(),
          source_type: 'FACTORY',
          destination_type: 'WAREHOUSE',
          destination_id: targetWarehouse.id,
          employee_id: user.id,
        }
      });
    }

    return prod;
  });

  revalidatePath('/produksi');
  revalidatePath('/overview');
  revalidatePath('/warehouse');
  revalidatePath('/produk');
  return result;
}

export async function deleteProduksiKegiatan(id: string) {
  const user = await verifySession();
  if (!user) throw new Error('Tidak terautentikasi');

  await prisma.produksi.delete({ where: { id } });

  revalidatePath('/produksi');
  revalidatePath('/overview');
  return { success: true };
}


