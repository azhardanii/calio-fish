'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PdfExportButton } from '@/components/ui/PdfExportButton';
import { Badge } from '@/components/ui/badge';
import { Navigation, Search } from 'lucide-react';

export default function PengirimanPage() {
  const { data, isLoading } = useSWR('/api/data/pengiriman');
  const [filterType, setFilterType] = useState('ALL');
  const [filterInput, setFilterInput] = useState('');
  const [sortOrder, setSortOrder] = useState('DESC');
  const [visibleCount, setVisibleCount] = useState(50);
  const observerTarget = useRef(null);

  const shipments = data?.shipments || [];

  // Filter & Sort Logic
  const processedData = useMemo(() => {
    let result = [...shipments];

    if (filterType !== 'ALL') {
      result = result.filter(s => (s.shipment_type || 'PENGIRIMAN') === filterType);
    }
    
    if (filterInput) {
      const lowerInput = filterInput.toLowerCase();
      result = result.filter(s => 
        (s.employee?.nama || 'Sistem AI').toLowerCase().includes(lowerInput) ||
        (s.destination_name || s.destination_type || '').toLowerCase().includes(lowerInput) ||
        (s.source_name || '').toLowerCase().includes(lowerInput)
      );
    }

    result.sort((a, b) => {
      const timeA = new Date(a.date).getTime();
      const timeB = new Date(b.date).getTime();
      if (timeA === timeB) {
        return sortOrder === 'DESC' 
          ? new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          : new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      return sortOrder === 'DESC' ? timeB - timeA : timeA - timeB;
    });

    return result;
  }, [shipments, filterType, filterInput, sortOrder]);

  const visibleShipments = processedData.slice(0, visibleCount);

  // Intersection Observer for Infinite Scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && visibleCount < processedData.length) {
          setVisibleCount(prev => Math.min(prev + 50, processedData.length));
        }
      },
      { threshold: 1.0 }
    );
    
    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }
    
    return () => {
      if (observerTarget.current) observer.unobserve(observerTarget.current);
    };
  }, [observerTarget, visibleCount, processedData.length]);

  if (isLoading && !data) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '40vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 36, height: 36, border: '4px solid #e5e7eb', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
          <div style={{ color: '#6b7280', fontSize: 14 }}>Memuat data pengiriman...</div>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // Calculate summary based on processedData (filtered data)
  const summaryShipments = processedData.length;
  const summaryItems = processedData.reduce((acc, curr) => acc + (curr.items?.reduce((s: number, i: any) => s + i.qty, 0) || 0), 0);
  
  const returnShipments = processedData.filter(s => s.shipment_type === 'RETUR');
  const totalReturns = returnShipments.reduce((acc, curr) => acc + (curr.items?.reduce((s: number, i: any) => s + i.qty, 0) || 0), 0);

  const uniqueTypes = Array.from(new Set(shipments.map((s: any) => s.shipment_type || 'PENGIRIMAN')));

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Log Pengiriman</h1>
          <p className="text-gray-500 mt-1">Laporan terpusat pendistribusian produk (Online, Outlet, Sample, Retur).</p>
        </div>
        <div className="flex space-x-3">
          <PdfExportButton targetId="pengiriman-report" filename="laporan-pengiriman-terpadu" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        {/* Total Pengiriman */}
        <div style={{ background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)', borderRadius: 16, padding: '20px 24px', border: '1px solid #bfdbfe', boxShadow: '0 4px 15px rgba(59, 130, 246, 0.1)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ fontSize: 13, color: '#2563eb', fontWeight: 700, letterSpacing: 0.5, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 16 }}>📦</span> TOTAL PENGIRIMAN
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#1e3a8a' }}>{summaryShipments}</div>
          <div style={{ position: 'absolute', right: -15, bottom: -15, fontSize: 80, opacity: 0.05 }}>📦</div>
        </div>
        
        {/* Produk Terkirim */}
        <div style={{ background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)', borderRadius: 16, padding: '20px 24px', border: '1px solid #bbf7d0', boxShadow: '0 4px 15px rgba(34, 197, 94, 0.1)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ fontSize: 13, color: '#16a34a', fontWeight: 700, letterSpacing: 0.5, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 16 }}>🚚</span> TOTAL PRODUK
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#14532d' }}>{summaryItems} <span style={{ fontSize: 16, fontWeight: 600 }}>pcs</span></div>
          <div style={{ position: 'absolute', right: -15, bottom: -15, fontSize: 80, opacity: 0.05 }}>🚚</div>
        </div>

        {/* Total Retur */}
        <div style={{ background: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)', borderRadius: 16, padding: '20px 24px', border: '1px solid #fecaca', boxShadow: '0 4px 15px rgba(239, 68, 68, 0.1)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ fontSize: 13, color: '#dc2626', fontWeight: 700, letterSpacing: 0.5, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 16 }}>🔄</span> TOTAL RETUR
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#7f1d1d' }}>{totalReturns} <span style={{ fontSize: 16, fontWeight: 600 }}>pcs</span></div>
          <div style={{ position: 'absolute', right: -15, bottom: -15, fontSize: 80, opacity: 0.05 }}>🔄</div>
        </div>
      </div>

      <div id="pengiriman-report" className="space-y-6 bg-white p-4 rounded-xl mt-6 border border-gray-100 shadow-sm">
        <Card className="hover:shadow-lg transition-shadow duration-300 border-0 shadow-none">
          <CardHeader className="px-0 pt-0 border-b border-gray-100 pb-4 mb-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <CardTitle>History Distribusi & Pengiriman</CardTitle>
              <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                <div className="relative flex-1 md:w-64">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    placeholder="Cari rute atau staf..."
                    value={filterInput}
                    onChange={(e) => setFilterInput(e.target.value)}
                    className="pl-10 pr-3 py-2 w-full border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="px-3 py-2 border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="ALL">Semua Tipe</option>
                  {uniqueTypes.map(t => <option key={t as string} value={t as string}>{t as string}</option>)}
                </select>
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                  className="px-3 py-2 border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="DESC">Terbaru</option>
                  <option value="ASC">Terlama</option>
                </select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal & Waktu</TableHead>
                  <TableHead>Tipe Pengiriman</TableHead>
                  <TableHead>Rute (Dari &rarr; Ke)</TableHead>
                  <TableHead>Detail Produk</TableHead>
                  <TableHead>Catatan</TableHead>
                  <TableHead>Diinput Oleh</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleShipments.map((s: any) => {
                  const qty = s.items?.reduce((sum: number, item: any) => sum + item.qty, 0) || 0;
                  
                  return (
                    <TableRow key={s.id} className="hover:bg-gray-50 transition-colors">
                      <TableCell className="whitespace-nowrap">
                        <div className="font-medium text-gray-900">{new Date(s.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                        <div className="text-xs text-gray-500">{new Date(s.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`
                          ${s.shipment_type === 'RETUR' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-blue-50 text-blue-700 border-blue-200'}
                        `}>
                          {s.shipment_type || 'PENGIRIMAN'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <span className="text-sm font-medium text-gray-700">
                            {s.source_name || '-'} 
                          </span>
                          <Navigation className="w-3 h-3 text-gray-400 ml-2" />
                          <span className="text-sm font-bold text-gray-900">
                            {s.destination_name || s.destination_type}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-semibold">{qty} pcs</span>
                        <div className="text-xs text-gray-500 mt-1">
                          {s.items?.length || 0} macam SKU
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-gray-600 max-w-xs truncate" title={s.notes || '-'}>
                        {s.notes || '-'}
                      </TableCell>
                      <TableCell className="text-gray-600 text-sm">
                        {s.employee ? s.employee.nama : 'Sistem AI'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            
            {processedData.length === 0 && (
              <div className="text-center text-gray-500 py-12">Belum ada riwayat pengiriman yang cocok dengan filter.</div>
            )}
            
            {/* Infinite Scroll Trigger */}
            {visibleCount < processedData.length && (
              <div ref={observerTarget} className="flex justify-center p-6">
                <div className="w-6 h-6 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div>
              </div>
            )}
            
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
