'use server'

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

// Karyawan
export async function createKaryawan(data: any) {
  await prisma.employee.create({ data });
  revalidatePath('/karyawan');
}
export async function updateKaryawan(id: string, data: any) {
  await prisma.employee.update({ where: { id }, data });
  revalidatePath('/karyawan');
}
export async function deleteKaryawan(id: string) {
  await prisma.employee.delete({ where: { id } });
  revalidatePath('/karyawan');
}

// Outlet
export async function createOutlet(data: any) {
  // Convert decimal fields if they come as strings
  if (data.tagihan !== undefined) data.tagihan = Number(data.tagihan);
  if (data.payment !== undefined) data.payment = Number(data.payment);
  if (data.sisa_tagihan !== undefined) data.sisa_tagihan = Number(data.sisa_tagihan);
  if (data.tagihan !== undefined) data.tagihan = Number(data.tagihan);
  if (data.payment !== undefined) data.payment = Number(data.payment);
  if (data.sisa_tagihan !== undefined) data.sisa_tagihan = Number(data.sisa_tagihan);

  const res = await prisma.outlet.create({ 
    data: {
      nama: data.nama,
      tlp: data.tlp,
      alamat: data.alamat,
      status: data.status,
      pic: data.pic,
      order_baru: data.order_baru,
      tagihan: data.tagihan,
      payment: data.payment,
      sisa_tagihan: data.sisa_tagihan,
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
  return res;
}
export async function updateOutlet(id: string, data: any) {
  if (data.tagihan !== undefined) data.tagihan = Number(data.tagihan);
  if (data.payment !== undefined) data.payment = Number(data.payment);
  if (data.sisa_tagihan !== undefined) data.sisa_tagihan = Number(data.sisa_tagihan);
  if (data.order_baru !== undefined) data.order_baru = Number(data.order_baru);

  await prisma.outlet.update({ where: { id }, data });
  revalidatePath('/outlet');
}
export async function deleteOutlet(id: string) {
  await prisma.outlet.delete({ where: { id } });
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
