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

  const settings = await prisma.systemSetting.findMany({
    where: { key: { in: ['target_produksi_pcs', 'target_produksi_kg'] } }
  });
  
  let targetPcs = 200;
  let targetKg = 50;
  for (const s of settings) {
    if (s.key === 'target_produksi_pcs') targetPcs = Number(s.value);
    if (s.key === 'target_produksi_kg') targetKg = Number(s.value);
  }

  return NextResponse.json(serializeDeep({ data, targetPcs, targetKg }));
}
