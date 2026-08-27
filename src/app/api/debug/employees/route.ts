import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
export async function GET() {
  const employees = await prisma.employee.findMany({
    select: { id: true, nama: true, posisi: true, role: true },
    orderBy: { nama: 'asc' }
  });
  return NextResponse.json(employees);
}
