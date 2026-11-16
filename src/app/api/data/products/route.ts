import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { serializeDeep } from '@/lib/serialize';

export async function GET() {
  const [products, productTypes, transactions] = await Promise.all([
    prisma.product.findMany({ 
      include: { product_type: true },
      orderBy: { created_at: 'desc' } 
    }),
    prisma.productType.findMany({
      orderBy: { name: 'asc' }
    }),
    prisma.stockTransaction.findMany({
      include: { product: true, employee: true },
      orderBy: { created_at: 'desc' },
      take: 50,
    }),
  ]);

  const serializedTransactions = transactions.map((t: any) => {
    const { product, employee, ...rest } = t;
    return {
      ...rest,
      productName: product.name,
      productSku: product.sku,
      employee_name: employee ? employee.nama : 'Sistem / Webhook',
    };
  });

  return NextResponse.json(serializeDeep({
    products,
    productTypes,
    transactions: serializedTransactions,
  }));
}
