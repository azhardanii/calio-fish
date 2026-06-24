import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PdfExportButton } from '@/components/ui/PdfExportButton';
import { prisma } from '@/lib/prisma';

export default async function DistribusiSamplePage() {
  const reports = await prisma.distribusiSample.findMany({
    orderBy: { date: 'desc' },
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Distribusi Sample</h1>
        <PdfExportButton targetId="sample-report" filename="distribusi-sample" />
      </div>

      <div id="sample-report" className="space-y-6 bg-white p-4 rounded-xl">
        <Card className="hover:shadow-lg transition-shadow duration-300">
          <CardHeader>
            <CardTitle>History Distribusi Sample Produk</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Jenis Sample</TableHead>
                  <TableHead>Total Produk</TableHead>
                  <TableHead>Biaya Ekspedisi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map((r) => (
                  <TableRow key={r.id} className="hover:bg-gray-50 transition-colors">
                    <TableCell>{new Date(r.date).toLocaleDateString('id-ID')}</TableCell>
                    <TableCell className="font-medium">{r.jenis_sample}</TableCell>
                    <TableCell>{r.total_produk} pcs</TableCell>
                    <TableCell>Rp {Number(r.biaya_ekspedisi).toLocaleString('id-ID')}</TableCell>
                  </TableRow>
                ))}
                {reports.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-gray-500 py-4">Belum ada data distribusi sample</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
