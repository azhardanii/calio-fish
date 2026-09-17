import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { serializeDeep } from '@/lib/serialize';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const fromParam = searchParams.get('from');
    const toParam = searchParams.get('to');

    let shipmentDateFilter: any = undefined;
    if (fromParam && toParam) {
      shipmentDateFilter = {
        gte: new Date(`${fromParam}T00:00:00.000`),
        lte: new Date(`${toParam}T23:59:59.999`)
      };
    }

    const affiliates = await prisma.affiliate.findMany({
      orderBy: { created_at: 'desc' },
      include: {
        shipments: {
          where: shipmentDateFilter ? { date: shipmentDateFilter } : undefined,
          include: {
            items: {
              include: { product: true }
            }
          },
          orderBy: { date: 'desc' }
        },
        jadwal: {
          orderBy: { created_at: 'desc' }
        }
      }
    });

    return NextResponse.json(serializeDeep(affiliates));
  } catch (err: any) {
    console.error('Error fetching affiliates:', err);
    return NextResponse.json({ error: 'Gagal memuat data affiliator' }, { status: 500 });
  }
}
