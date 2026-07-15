import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { serializeDeep } from '@/lib/serialize';

export async function GET() {
  const [products, transactions] = await Promise.all([
    prisma.product.findMany({ orderBy: { created_at: 'desc' } }),
    prisma.stockTransaction.findMany({
      include: { product: true },
      orderBy: { created_at: 'desc' },
      take: 50,
    }),
  ]);

  const serializedTransactions = transactions.map(t => {
    const { product, ...rest } = t;
    return {
      ...rest,
      productName: product.name,
      productSku: product.sku,
    };
  });

  return NextResponse.json(serializeDeep({
    products,
    transactions: serializedTransactions,
  }));
}
