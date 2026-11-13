import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { serializeDeep } from '@/lib/serialize';
import { verifySession } from '@/lib/auth';

export async function GET() {
  const user = await verifySession();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  let whereClause: any = {};
  const role = (user?.role || '').toUpperCase();
  const isOwnerOrAdmin = role === 'OWNER' || role === 'ADMIN';

  if (!isOwnerOrAdmin) {
    if (role === 'DISTRIBUTOR') {
      whereClause = { distributor_id: user.id };
    } else {
      // Marketing, Mitra, and any non-admin staff
      whereClause = { pengelola_id: user.id };
    }
  }

  const outlets = await prisma.outlet.findMany({
    where: whereClause,
    include: { 
      stocks: { include: { product: true } },
      type_stocks: { include: { product_type: true } },
      pengelola: { select: { id: true, nama: true } },
      distributor: { select: { id: true, nama: true, wilayah: true } },
      transactions: { 
        orderBy: { date: 'desc' },
        include: { items: { include: { product_type: true } } }
      },
      stock_opnames: {
        orderBy: { date: 'desc' },
        include: { items: { include: { product_type: true } } }
      },
      shipments: { orderBy: { date: 'desc' }, include: { items: { include: { product: true } } } }
    },
    orderBy: { created_at: 'desc' },
  });

  const outletIds = outlets.map(o => o.id);
  const stockTransactions = await prisma.stockTransaction.findMany({
    where: { 
      destination_type: 'OUTLET',
      destination_id: { in: outletIds }
    },
    include: { product: true, employee: { select: { nama: true } } },
    orderBy: { created_at: 'desc' }
  });

  const outletsWithHistory = outlets.map(o => {
    // Dynamic stock valuation based on type_stocks (harga_beli ?? base_price)
    const typeValuation = (o.type_stocks || []).reduce((sum, s) => {
      const price = s.harga_beli !== null && s.harga_beli !== undefined
        ? Number(s.harga_beli)
        : Number(s.product_type?.base_price || 0);
      return sum + (Number(s.quantity || 0) * price);
    }, 0);

    const valuasiStok = typeValuation > 0 ? typeValuation : Number(o.valuasi_stok || 0);
    const valuasiPending = Number(o.valuasi_pending || 0);
    const valuasiTampil = Math.max(0, valuasiStok - valuasiPending);
    const piutang = Number(o.piutang || 0);
    const payment = Number(o.payment || 0);
    const tagihan = payment + piutang;
    const sisaTagihan = piutang;
    const needsReview = (o.transactions || []).some(t => t.needs_review);

    return {
      ...o,
      valuasi_stok: valuasiStok,
      valuasi_pending: valuasiPending,
      valuasi_tampil: valuasiTampil,
      piutang,
      payment,
      tagihan,
      sisa_tagihan: sisaTagihan,
      needs_review: needsReview,
      stock_history: stockTransactions.filter(st => st.destination_id === o.id)
    };
  });

  return NextResponse.json(serializeDeep(outletsWithHistory));
}
