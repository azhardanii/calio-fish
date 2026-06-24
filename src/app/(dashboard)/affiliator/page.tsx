import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PdfExportButton } from '@/components/ui/PdfExportButton';
import { prisma } from '@/lib/prisma';

import { AffiliatorManager } from './AffiliatorManager';

export default async function AffiliatePage() {
  const reports = await prisma.affiliate.findMany({
    orderBy: { created_at: 'desc' },
  });

  // Convert decimal to number for Client Component
  const serializedReports = reports.map(r => ({
    ...r,
    ratecard: r.ratecard ? Number(r.ratecard) : null,
  }));

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Database Affiliator</h1>
        <PdfExportButton targetId="affiliate-report" filename="affiliate-report" />
      </div>

      <div id="affiliate-report" className="space-y-6 bg-white p-4 rounded-xl">
        <Card className="hover:shadow-lg transition-shadow duration-300">
          <CardContent className="pt-6">
            <AffiliatorManager affiliators={serializedReports} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
