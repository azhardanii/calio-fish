'use client';

import React from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs } from '@/components/ui/tabs';
import { EmployeeManager } from './EmployeeManager';

export default function KaryawanPage() {
  const { data, isLoading } = useSWR('/api/data/employees');

  if (isLoading && !data) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '40vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 36, height: 36, border: '4px solid #e5e7eb', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
          <div style={{ color: '#6b7280', fontSize: 14 }}>Memuat data karyawan...</div>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const employees = data?.employees || [];
  const attendances = data?.attendances || [];

  const tabs = [
    {
      id: 'presensi',
      label: 'Presensi',
      content: (
        <section className="space-y-6">
          <Card>
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
                  {attendances.map((a: any) => (
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
          <Card>
            <CardContent className="pt-6">
              <EmployeeManager employees={employees} />
            </CardContent>
          </Card>
        </section>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <Tabs tabs={tabs} />
    </div>
  );
}
