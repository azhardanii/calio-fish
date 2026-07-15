import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding warehouses...');
  
  const banyuwangi = await prisma.warehouse.create({
    data: {
      name: 'Banyuwangi (factory)',
      type: 'FACTORY'
    }
  });
  console.log('Created:', banyuwangi.name);

  const malang = await prisma.warehouse.create({
    data: {
      name: 'Malang (storage branch)',
      type: 'STORAGE'
    }
  });
  console.log('Created:', malang.name);

  // For existing active products, let's create WarehouseStock entries with 0 quantity
  const products = await prisma.product.findMany({ where: { is_active: true } });
  
  for (const product of products) {
    await prisma.warehouseStock.create({
      data: { warehouse_id: banyuwangi.id, product_id: product.id, quantity: 0 }
    });
    await prisma.warehouseStock.create({
      data: { warehouse_id: malang.id, product_id: product.id, quantity: 0 }
    });
  }

  // Same for existing Outlets, initialize OutletStock
  const outlets = await prisma.outlet.findMany();
  for (const outlet of outlets) {
    for (const product of products) {
      await prisma.outletStock.create({
        data: { outlet_id: outlet.id, product_id: product.id, quantity: 0 }
      });
    }
  }

  console.log('Seed completed.');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
