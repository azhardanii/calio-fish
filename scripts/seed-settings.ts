import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {

  await prisma.reportSettings.upsert({
    where: { key: 'shopee_target_mtd' },
    update: {},
    create: { key: 'shopee_target_mtd', value: 10000000, label: 'Target MTD Shopee' },
  });

  await prisma.reportSettings.upsert({
    where: { key: 'tiktok_target_mtd' },
    update: {},
    create: { key: 'tiktok_target_mtd', value: 2000000, label: 'Target MTD TikTok' },
  });

  console.log('Settings seeded successfully!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
