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
  if (data.order_baru !== undefined) data.order_baru = Number(data.order_baru);
  if (data.sisa_stok !== undefined) data.sisa_stok = Number(data.sisa_stok);

  await prisma.outlet.create({ data });
  revalidatePath('/outlet');
}
export async function updateOutlet(id: string, data: any) {
  if (data.tagihan !== undefined) data.tagihan = Number(data.tagihan);
  if (data.payment !== undefined) data.payment = Number(data.payment);
  if (data.sisa_tagihan !== undefined) data.sisa_tagihan = Number(data.sisa_tagihan);
  if (data.order_baru !== undefined) data.order_baru = Number(data.order_baru);
  if (data.sisa_stok !== undefined) data.sisa_stok = Number(data.sisa_stok);

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
