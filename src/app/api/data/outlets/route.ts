import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { serializeDeep } from '@/lib/serialize';
import { verifySession } from '@/lib/auth';

export async function GET() {
  const user = await verifySession();
  
  let whereClause = {};
  if (user && user.role === 'MITRA') {
    whereClause = { pengelola_id: user.id };
  }

  const outlets = await prisma.outlet.findMany({
    where: whereClause,
    include: { 
      stocks: { include: { product: true } },
      pengelola: { select: { id: true, nama: true } },
      transactions: { orderBy: { date: 'desc' } }
    },
    orderBy: { created_at: 'desc' },
  });
  return NextResponse.json(serializeDeep(outlets));
}
