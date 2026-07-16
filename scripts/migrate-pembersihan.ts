import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Fetching PembersihanKulit data...');
  const oldData = await prisma.pembersihanKulit.findMany({
    orderBy: { created_at: 'asc' }
  });

  console.log(`Found ${oldData.length} records.`);

  // Deduplicate based on date, bahan_beku, bahan_bersih, and employee_id
  const uniqueRecords = new Map<string, any>();
  const duplicateIds: string[] = [];

  for (const record of oldData) {
    const key = `${record.date.toISOString()}_${record.bahan_beku_kg}_${record.bahan_bersih_kg}_${record.employee_id}`;
    if (!uniqueRecords.has(key)) {
      uniqueRecords.set(key, record);
    } else {
      duplicateIds.push(record.id);
    }
  }

  console.log(`Found ${uniqueRecords.size} unique records, ${duplicateIds.length} duplicates.`);

  let migrated = 0;
  for (const [_, record] of uniqueRecords) {
    // Check if it already exists in Produksi to avoid re-running issues
    const existing = await prisma.produksi.findFirst({
      where: {
        date: record.date,
        kegiatan: 'Pembersihan',
        bahan_baku: record.bahan_beku_kg,
        bahan_jadi: record.bahan_bersih_kg,
        employee_id: record.employee_id
      }
    });

    if (!existing) {
      await prisma.produksi.create({
        data: {
          date: record.date,
          kegiatan: 'Pembersihan',
          jenis_produksi: null,
          bahan_baku: record.bahan_beku_kg,
          bahan_jadi: record.bahan_bersih_kg,
          total_hasil_pcs: null,
          hpp_batch: record.hpp_batch,
          employee_id: record.employee_id
        }
      });
      migrated++;
    }
  }

  console.log(`Migrated ${migrated} new records to Produksi.`);

  if (duplicateIds.length > 0) {
    console.log(`Duplicates can be safely ignored as we will drop the table.`);
  }

  console.log('Migration completed.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
