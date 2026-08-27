import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  try {
    const employees = await prisma.employee.findMany();
    for (const emp of employees) {
      if (emp.posisi) {
        let newRole = emp.posisi.toUpperCase();
        if (newRole === 'STAFF PRODUKSI') newRole = 'PRODUKSI';
        await prisma.employee.update({
          where: { id: emp.id },
          data: { role: newRole }
        });
        console.log(`Updated ${emp.nama} to role ${newRole}`);
      }
    }
    console.log('Success syncing roles');
  } catch (e) {
    console.error('Failed:', e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
