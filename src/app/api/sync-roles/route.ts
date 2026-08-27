import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const employees = await prisma.employee.findMany();
    let count = 0;
    for (const emp of employees) {
      if (emp.posisi) {
        let newRole = emp.posisi.toUpperCase();
        if (newRole === 'STAFF PRODUKSI') newRole = 'PRODUKSI';
        await prisma.employee.update({
          where: { id: emp.id },
          data: { role: newRole }
        });
        count++;
      }
    }
    return NextResponse.json({ success: true, count });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
