'use server'

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { verifySession } from '@/lib/auth';

// Karyawan
export async function createKaryawan(data: any, outletIds?: string[]) {
  if (data.posisi) {
    let newRole = data.posisi.toUpperCase();
    if (newRole === 'STAFF PRODUKSI' || newRole.includes('PRODUKSI')) newRole = 'PRODUKSI';
    else if (newRole === 'STAFF MARKETING' || newRole.includes('MARKETING')) newRole = 'MARKETING';
    data.role = newRole;
  }
  const employee = await prisma.employee.create({ data });

  // If role is MARKETING and outletIds provided, assign them to this employee
  if (outletIds && Array.isArray(outletIds) && outletIds.length > 0) {
    await prisma.outlet.updateMany({
      where: { id: { in: outletIds } },
      data: { pengelola_id: employee.id }
    });
  }

  revalidatePath('/karyawan');
  revalidatePath('/outlet');
  return employee;
}

export async function updateKaryawan(id: string, data: any, outletIds?: string[]) {
  if (data.posisi) {
    let newRole = data.posisi.toUpperCase();
    if (newRole === 'STAFF PRODUKSI' || newRole.includes('PRODUKSI')) newRole = 'PRODUKSI';
    else if (newRole === 'STAFF MARKETING' || newRole.includes('MARKETING')) newRole = 'MARKETING';
    data.role = newRole;
  }
  const employee = await prisma.employee.update({ where: { id }, data });

  // If outletIds is passed, sync the handled outlets for this employee
  if (outletIds !== undefined && Array.isArray(outletIds)) {
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

// Outlet
export async function createOutlet(data: any) {
  const user = await verifySession();
  const role = (user?.role || '').toUpperCase();
  const isOwnerOrAdmin = role === 'OWNER' || role === 'ADMIN';

  // Convert decimal fields if they come as strings
  if (data.tagihan !== undefined) data.tagihan = Number(data.tagihan);
  if (data.payment !== undefined) data.payment = Number(data.payment);
  if (data.sisa_tagihan !== undefined) data.sisa_tagihan = Number(data.sisa_tagihan);

  // Jika dibuat oleh Marketing, OTOMATIS kaitkan outlet ke user marketing yang login
  // Jika dibuat oleh Owner/Admin, gunakan pengelola_id yang dipilih di form
  let assignedPengelolaId = data.pengelola_id || null;
  if (!isOwnerOrAdmin && user && (role === 'MARKETING' || role.includes('MARKETING'))) {
    assignedPengelolaId = user.id;
  }

  // Anti-duplicate protection:
  // Cek apakah outlet dengan nama dan pengelola yang sama baru saja dibuat dalam 10 detik terakhir (mencegah double/multiple click)
  const trimmedNama = (data.nama || '').trim();
  const tenSecondsAgo = new Date(Date.now() - 10000);
  const existingRecent = await prisma.outlet.findFirst({
    where: {
      nama: { equals: trimmedNama, mode: 'insensitive' },
      pengelola_id: assignedPengelolaId,
      created_at: { gte: tenSecondsAgo }
    }
  });

  if (existingRecent) {
    console.log(`[Anti-Spam] Outlet '${trimmedNama}' baru saja dibuat, mengabaikan duplikasi submission.`);
    return existingRecent;
  }

  const res = await prisma.outlet.create({ 
    data: {
      nama: trimmedNama,
      tlp: data.tlp,
      alamat: data.alamat,
      wilayah: data.wilayah,
      status: data.status || 'Active',
      pic: data.pic,
      order_baru: data.order_baru || 0,
      tagihan: data.tagihan || 0,
      payment: data.payment || 0,
      sisa_tagihan: data.sisa_tagihan || 0,
      pengelola_id: assignedPengelolaId,
    } 
  });

  const activeProducts = await prisma.product.findMany({ where: { is_active: true } });
  if (activeProducts.length > 0) {
    await prisma.outletStock.createMany({
      data: activeProducts.map(p => ({
        outlet_id: res.id,
        product_id: p.id,
        quantity: 0
      }))
    });
  }

  revalidatePath('/outlet');
  revalidatePath('/karyawan');
  return res;
}

export async function updateOutlet(id: string, data: any) {
  const user = await verifySession();
  const role = (user?.role || '').toUpperCase();
  const isOwnerOrAdmin = role === 'OWNER' || role === 'ADMIN';

  const existingOutlet = await prisma.outlet.findUnique({ where: { id } });
  if (!existingOutlet) throw new Error('Outlet tidak ditemukan');

  // Marketing users can only update outlets they handle
  if (!isOwnerOrAdmin && (role === 'MARKETING' || role.includes('MARKETING'))) {
    if (existingOutlet.pengelola_id !== user?.id) {
      throw new Error(`Akses ditolak: Anda tidak memiliki izin mengubah data outlet "${existingOutlet.nama}".`);
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

  // Only Owner / Admin can change pengelola_id
  if (isOwnerOrAdmin && data.pengelola_id !== undefined) {
    updateData.pengelola_id = data.pengelola_id === '' ? null : data.pengelola_id;
  }
  
  if (data.tagihan !== undefined) updateData.tagihan = Number(data.tagihan);
  if (data.payment !== undefined) updateData.payment = Number(data.payment);
  if (data.sisa_tagihan !== undefined) updateData.sisa_tagihan = Number(data.sisa_tagihan);
  if (data.order_baru !== undefined) updateData.order_baru = Number(data.order_baru);
  
  // Clean undefined values
  Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);

  await prisma.outlet.update({ where: { id }, data: updateData });
  revalidatePath('/outlet');
}

export async function addPiutang(outletId: string, amount: number, description: string = '', dateString?: string) {
  const user = await verifySession();
  const role = (user?.role || '').toUpperCase();
  const isOwnerOrAdmin = role === 'OWNER' || role === 'ADMIN';

  const outlet = await prisma.outlet.findUnique({ where: { id: outletId } });
  if (!outlet) throw new Error('Outlet tidak ditemukan');

  // Marketing users can only add piutang to outlets they handle
  if (!isOwnerOrAdmin && (role === 'MARKETING' || role.includes('MARKETING'))) {
    if (outlet.pengelola_id !== user?.id) {
      throw new Error(`Akses ditolak: Anda tidak memiliki izin untuk menginput tagihan ke outlet "${outlet.nama}".`);
    }
  }

  const newTagihan = Number(outlet.tagihan) + amount;
  const newSisa = newTagihan - Number(outlet.payment);

  await prisma.$transaction([
    prisma.outletTransaction.create({
      data: {
        outlet_id: outletId,
        type: 'PIUTANG',
        amount: amount,
        description,
        date: dateString ? new Date(dateString) : new Date()
      }
    }),
    prisma.outlet.update({
      where: { id: outletId },
      data: { tagihan: newTagihan, sisa_tagihan: newSisa }
    })
  ]);
  revalidatePath('/outlet');
}

export async function addPelunasan(outletId: string, amount: number, description: string = '', dateString?: string) {
  const user = await verifySession();
  const role = (user?.role || '').toUpperCase();
  const isOwnerOrAdmin = role === 'OWNER' || role === 'ADMIN';

  const outlet = await prisma.outlet.findUnique({ where: { id: outletId } });
  if (!outlet) throw new Error('Outlet tidak ditemukan');

  // Marketing users can only add pelunasan to outlets they handle
  if (!isOwnerOrAdmin && (role === 'MARKETING' || role.includes('MARKETING'))) {
    if (outlet.pengelola_id !== user?.id) {
      throw new Error(`Akses ditolak: Anda tidak memiliki izin untuk menginput pelunasan ke outlet "${outlet.nama}".`);
    }
  }

  const newPayment = Number(outlet.payment) + amount;
  const newSisa = Number(outlet.tagihan) - newPayment;

  await prisma.$transaction([
    prisma.outletTransaction.create({
      data: {
        outlet_id: outletId,
        type: 'PELUNASAN',
        amount: amount,
        description,
        date: dateString ? new Date(dateString) : new Date()
      }
    }),
    prisma.outlet.update({
      where: { id: outletId },
      data: { payment: newPayment, sisa_tagihan: newSisa }
    })
  ]);
  revalidatePath('/outlet');
}

export async function deleteOutlet(id: string) {
  const user = await verifySession();
  const role = (user?.role || '').toUpperCase();
  if (role !== 'OWNER' && role !== 'ADMIN') {
    throw new Error('Akses ditolak: Hanya OWNER atau ADMIN yang dapat menghapus outlet.');
  }
  await prisma.outlet.delete({ where: { id } });
  revalidatePath('/outlet');
}

export async function adjustOutletStock(outletStockId: string, newQty: number, note: string) {
  const user = await verifySession();
  const role = (user?.role || '').toUpperCase();
  const isOwnerOrAdmin = role === 'OWNER' || role === 'ADMIN';

  const os = await prisma.outletStock.findUnique({ where: { id: outletStockId }, include: { product: true, outlet: true } });
  if (!os) throw new Error('Outlet stock tidak ditemukan');

  // Marketing users can only adjust stock for outlets they handle
  if (!isOwnerOrAdmin && (role === 'MARKETING' || role.includes('MARKETING'))) {
    if (os.outlet.pengelola_id !== user?.id) {
      throw new Error(`Akses ditolak: Anda tidak memiliki izin untuk mengubah stok outlet "${os.outlet.nama}".`);
    }
  }

  const diff = newQty - os.quantity;
  if (diff === 0) return;

  await prisma.$transaction(async (tx) => {
    await tx.outletStock.update({ where: { id: outletStockId }, data: { quantity: newQty } });
    
    await tx.stockTransaction.create({
      data: {
        product_id: os.product_id,
        type: 'OPNAME_OUTLET',
        flow: diff > 0 ? 'IN' : 'OUT',
        qty: Math.abs(diff),
        balance: newQty,
        description: `Penyesuaian Manual Stok Outlet ${os.outlet.nama}: ${note}`,
        date: new Date(),
        destination_id: os.outlet_id,
        destination_type: 'OUTLET',
        employee_id: user?.id
      }
    });
  });

  revalidatePath('/outlet');
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

// Warehouse
export async function updateWarehouse(id: string, data: any) {
  await prisma.warehouse.update({
    where: { id },
    data: {
      name: data.name,
      type: data.type,
      address: data.address
    }
  });
  revalidatePath('/warehouse');
}
