import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { serializeDeep } from '@/lib/serialize';

export async function GET() {
  const outlets = await prisma.outlet.findMany({
    include: { stocks: { include: { product: true } } },
    orderBy: { created_at: 'desc' },
  });
  return NextResponse.json(serializeDeep(outlets));
}
