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

export async function resetOutletFinance(outletId: string) {
  const user = await verifySession();
  const role = (user?.role || '').toUpperCase();
  const isOwnerOrAdmin = role === 'OWNER' || role === 'ADMIN';

  if (!isOwnerOrAdmin) {
    throw new Error('Akses ditolak: Hanya OWNER atau ADMIN yang dapat mereset data keuangan & tagihan outlet.');
  }

  const outlet = await prisma.outlet.findUnique({ where: { id: outletId } });
  if (!outlet) throw new Error('Outlet tidak ditemukan');

  // Delete all financial transaction records for this outlet
  await prisma.outletTransaction.deleteMany({
    where: { outlet_id: outletId }
  });

  // Reset tagihan, payment, and sisa_tagihan to 0
  const updated = await prisma.outlet.update({
    where: { id: outletId },
    data: {
      tagihan: 0,
      payment: 0,
      sisa_tagihan: 0,
      order_baru: 0
    }
  });

  revalidatePath('/outlet');
  return updated;
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
  const totalStock = warehouse.stocks.reduce((acc, s) => acc + s.quantity + s.returned_qty, 0);
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
  quantity?: number;
  price_per_unit?: number;
  amount: number; 
  description?: string; 
  date?: string 
}) {
  const user = await verifySession();
  if (!user) throw new Error('Tidak terautentikasi');

  const role = (user.role || '').toUpperCase();
  const isOwnerOrAdmin = role === 'OWNER' || role === 'ADMIN';
  const isMarketing = role === 'MARKETING' || role.includes('MARKETING');

  if (!isOwnerOrAdmin && !isMarketing) {
    throw new Error('Akses ditolak: Hanya Marketing atau Admin/Owner yang dapat menambahkan transaksi personal buyer.');
  }

  const result = await prisma.personalBuyerTransaction.create({
    data: {
      employee_id: user.id,
      buyer_name: data.buyer_name,
      product_name: data.product_name || null,
      quantity: data.quantity && data.quantity > 0 ? data.quantity : 1,
      price_per_unit: data.price_per_unit || null,
      amount: data.amount,
      description: data.description || null,
      date: data.date ? new Date(data.date) : new Date(),
    }
  });

  revalidatePath('/marketing');
  revalidatePath('/overview');
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
  const user = await verifySession();
  if (!user) throw new Error('Tidak terautentikasi');

  const booth = await prisma.eventBooth.findUnique({
    where: { id: boothId },
    include: { stocks: { include: { product: true } } }
  });
  if (!booth) throw new Error('Booth tidak ditemukan');
  if (booth.status === 'SELESAI') throw new Error('Booth ini sudah berstatus selesai sebelumnya.');

  const targetWarehouse = await prisma.warehouse.findUnique({ where: { id: targetWarehouseId } });
  if (!targetWarehouse) throw new Error('Gudang tujuan pengembalian tidak ditemukan.');

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
      const product = await tx.product.findUnique({ where: { id: bs.product_id } });
      const newGlobalStock = (product?.stok || 0) + bs.quantity;
      await tx.product.update({
        where: { id: bs.product_id },
        data: { stok: newGlobalStock }
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
          employee_id: user.id,
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
  });

  revalidatePath('/booth');
  revalidatePath('/marketing');
  revalidatePath('/warehouse');
  revalidatePath('/produk');
}

