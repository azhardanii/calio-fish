import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { serializeDeep } from '@/lib/serialize';

export async function GET() {
  const produksiList = await prisma.produksi.findMany({
    orderBy: { date: 'desc' },
    include: { employee: true },
  });

  const data = produksiList.map(p => ({
    id: p.id,
    date: p.date,
    kegiatan: p.kegiatan,
    bahan_baku: p.bahan_baku ? Number(p.bahan_baku) : null,
    bahan_jadi: p.bahan_jadi ? Number(p.bahan_jadi) : null,
    total_hasil_pcs: p.total_hasil_pcs,
    employee_name: p.employee ? p.employee.nama : 'Sistem',
  }));

  return NextResponse.json(serializeDeep(data));
}
