import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { serializeDeep } from '@/lib/serialize';

export async function GET() {
  const reports = await prisma.distribusiSample.findMany({
    orderBy: { date: 'desc' },
    include: { employee: true },
  });
  return NextResponse.json(serializeDeep(reports));
}
