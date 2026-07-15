import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { serializeDeep } from '@/lib/serialize';

export async function GET() {
  const [outlets, affiliates, products, employees] = await Promise.all([
    prisma.outlet.findMany({ orderBy: { nama: 'asc' } }),
    prisma.affiliate.findMany({ orderBy: { nama: 'asc' } }),
    prisma.product.findMany({ where: { is_active: true }, orderBy: { short_name: 'asc' } }),
    prisma.employee.findMany({ where: { status_aktif: true }, orderBy: { nama: 'asc' } }),
  ]);

  return NextResponse.json(serializeDeep({ outlets, affiliates, products, employees }));
}
