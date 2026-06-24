import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs } from '@/components/ui/tabs';
import { prisma } from '@/lib/prisma';
import { EmployeeManager } from './EmployeeManager';

export default async function KaryawanPage() {
  const [employees, attendances] = await Promise.all([
    prisma.employee.findMany({ orderBy: { nama: 'asc' } }),
    prisma.attendance.findMany({ 
      orderBy: { waktu: 'desc' },
      include: { employee: true },
      take: 50 // Limit to recent 50
    })
  ]);

  const tabs = [
    {
      id: 'presensi',
      label: 'Presensi',
      content: (
        <section className="space-y-6">
          <Card className="hover:shadow-lg transition-shadow duration-300">
            <CardHeader>
              <CardTitle>Riwayat Presensi Terbaru</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tanggal & Waktu</TableHead>
                    <TableHead>Nama Karyawan</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Alasan / Keterangan</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attendances.map((a) => (
                    <TableRow key={a.id} className="hover:bg-gray-50 transition-colors">
                      <TableCell>
                        <div className="font-medium">{new Date(a.waktu).toLocaleDateString('id-ID')}</div>
                        <div className="text-xs text-gray-500">{new Date(a.waktu).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB</div>
                      </TableCell>
                      <TableCell className="font-bold">{a.employee.nama}</TableCell>
                      <TableCell>
                        <span style={{
                          background: a.status_kehadiran.toUpperCase() === 'HADIR' ? '#dcfce7' : 
                                      a.status_kehadiran.toUpperCase() === 'IZIN' ? '#fef9c3' : '#fef2f2',
                          color: a.status_kehadiran.toUpperCase() === 'HADIR' ? '#15803d' : 
                                 a.status_kehadiran.toUpperCase() === 'IZIN' ? '#a16207' : '#b91c1c',
                          padding: '2px 8px', borderRadius: 12, fontWeight: 600, fontSize: 12
                        }}>
                          {a.status_kehadiran.toUpperCase()}
                        </span>
                      </TableCell>
                      <TableCell className="text-gray-600">{a.alasan || '-'}</TableCell>
                    </TableRow>
                  ))}
                  {attendances.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-gray-500 py-8">Belum ada data presensi masuk via WA.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </section>
      )
    },
    {
      id: 'karyawan',
      label: 'Database Karyawan',
      content: (
        <section className="space-y-6">
          <Card className="hover:shadow-lg transition-shadow duration-300">
            <CardContent className="pt-6">
              <EmployeeManager employees={employees} />
            </CardContent>
          </Card>
        </section>
      )
    }
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Karyawan</h1>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <Tabs tabs={tabs} />
      </div>
    </div>
  );
}
