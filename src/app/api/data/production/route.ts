import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { serializeDeep } from '@/lib/serialize';

export async function GET() {
  const [produksiList, stokBahanList, products, warehouses] = await Promise.all([
    prisma.produksi.findMany({
      orderBy: { date: 'desc' },
      include: { employee: true },
    }),
    prisma.stokBahan.findMany({
      orderBy: { tanggal: 'desc' },
      include: { employee: { select: { id: true, nama: true } } },
    }),
    prisma.product.findMany({
      where: { is_active: true },
      select: { id: true, name: true, short_name: true, sku: true, stok: true },
      orderBy: { name: 'asc' },
    }),
    prisma.warehouse.findMany({
      select: { id: true, name: true, type: true },
      orderBy: { created_at: 'asc' },
    }),
  ]);

  const data = produksiList.map(p => ({
    id: p.id,
    date: p.date,
    kegiatan: p.kegiatan,
    jenis_produksi: p.jenis_produksi,
    bahan_baku: p.bahan_baku ? Number(p.bahan_baku) : null,
    bahan_jadi: p.bahan_jadi ? Number(p.bahan_jadi) : null,
    total_hasil_pcs: p.total_hasil_pcs,
    hpp_batch: p.hpp_batch ? Number(p.hpp_batch) : null,
    employee_id: p.employee_id,
    employee_name: p.employee ? p.employee.nama : 'Sistem',
  }));

  const stokBahan = stokBahanList.map(sb => ({
    id: sb.id,
    tanggal: sb.tanggal,
    kategori: sb.kategori,
    jenis_ukuran: sb.jenis_ukuran,
    masuk: sb.masuk,
    keluar: sb.keluar,
    employee_id: sb.employee_id,
    employee_name: sb.employee ? sb.employee.nama : 'Sistem',
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

  return NextResponse.json(serializeDeep({ data, stokBahan, targetPcs, targetKg, products, warehouses }));
}
