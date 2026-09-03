import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { serializeDeep } from '@/lib/serialize';

export async function GET() {
  const [employees, attendances] = await Promise.all([
    prisma.employee.findMany({
      orderBy: { nama: 'asc' },
      include: {
        managed_outlets: {
          select: { id: true, nama: true, wilayah: true }
        }
      }
    }),
    prisma.attendance.findMany({
      orderBy: { waktu: 'desc' },
      include: { employee: true },
      take: 50,
    }),
  ]);

  return NextResponse.json(serializeDeep({ employees, attendances }));
}
