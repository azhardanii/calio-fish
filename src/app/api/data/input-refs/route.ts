import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { serializeDeep } from '@/lib/serialize';

export async function GET() {
  const [outlets, affiliates, products, employees, distributors, warehouses] = await Promise.all([
    prisma.outlet.findMany({ orderBy: { nama: 'asc' } }),
    prisma.affiliate.findMany({ orderBy: { nama: 'asc' } }),
    prisma.product.findMany({ where: { is_active: true }, orderBy: { short_name: 'asc' } }),
    prisma.employee.findMany({ where: { status_aktif: true }, orderBy: { nama: 'asc' } }),
    prisma.employee.findMany({ where: { role: 'DISTRIBUTOR', status_aktif: true }, orderBy: { nama: 'asc' } }),
    prisma.warehouse.findMany({ select: { id: true, name: true, type: true }, orderBy: { created_at: 'asc' } }),
  ]);

  return NextResponse.json(serializeDeep({ outlets, affiliates, products, employees, distributors, warehouses }));
}
