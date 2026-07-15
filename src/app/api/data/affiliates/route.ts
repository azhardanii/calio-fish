import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { serializeDeep } from '@/lib/serialize';

export async function GET() {
  const affiliates = await prisma.affiliate.findMany({ orderBy: { created_at: 'desc' } });
  return NextResponse.json(serializeDeep(affiliates));
}
