import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { prisma } from '@/lib/prisma';

import { OutletManager } from './OutletManager';

export default async function OutletPage() {
  const outlets = await prisma.outlet.findMany({
    orderBy: { created_at: 'desc' },
  });

  // Convert decimal to number for Client Component
  const serializedOutlets = outlets.map(o => ({
    ...o,
    tagihan: Number(o.tagihan),
    payment: Number(o.payment),
    sisa_tagihan: Number(o.sisa_tagihan),
  }));

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Database Outlet</h1>
      </div>

      <div className="space-y-6 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <Card className="hover:shadow-lg transition-shadow duration-300">
          <CardContent className="pt-6">
            <OutletManager outlets={serializedOutlets} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
