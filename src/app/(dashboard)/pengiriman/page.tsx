'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import useSWR from 'swr';
import { DateRange } from "react-day-picker";
import { format } from "date-fns";
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PdfExportButton } from '@/components/ui/PdfExportButton';
import { Badge } from '@/components/ui/badge';
import { Navigation, Search } from 'lucide-react';

export default function PengirimanPage() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const today = new Date();
    return {
      from: new Date(today.getFullYear(), today.getMonth(), 1),
      to: new Date(today.getFullYear(), today.getMonth() + 1, 0)
    };
  });
  const [appliedDateRange, setAppliedDateRange] = useState<DateRange | undefined>(dateRange);

  const apiUrl = useMemo(() => {
    if (appliedDateRange?.from && appliedDateRange?.to) {
      const fromStr = format(appliedDateRange.from, 'yyyy-MM-dd');
      const toStr = format(appliedDateRange.to, 'yyyy-MM-dd');
      return `/api/data/pengiriman?startDate=${fromStr}&endDate=${toStr}`;
    }
    return '/api/data/pengiriman';
  }, [appliedDateRange]);

  const { data, isLoading } = useSWR(apiUrl);
  const [filterType, setFilterType] = useState('ALL');
  const [filterInput, setFilterInput] = useState('');
  const [detailedShipment, setDetailedShipment] = useState<any>(null);
  const [sortOrder, setSortOrder] = useState('DESC');
  const [visibleCount, setVisibleCount] = useState(50);
  const observerTarget = useRef(null);

  const filterLabel = useMemo(() => {
    if (!appliedDateRange?.from) return 'Lifetime (Semua Waktu)';
    const fromDate = appliedDateRange.from;
    const toDate = appliedDateRange.to || fromDate;
    
    const isFullMonth = 
      fromDate.getDate() === 1 && 
      toDate.getDate() === new Date(toDate.getFullYear(), toDate.getMonth() + 1, 0).getDate() &&
      fromDate.getMonth() === toDate.getMonth() &&
      fromDate.getFullYear() === toDate.getFullYear();

    if (isFullMonth) {
      return fromDate.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
    }
    const fromStr = fromDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    const toStr = toDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    return `${fromStr} - ${toStr}`;
  }, [appliedDateRange]);

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
    
    // Parse URL parameter on initial load
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const searchParam = urlParams.get('search');
      if (searchParam && !filterInput) {
        setFilterInput(searchParam);
      }
    }
    
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
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Log Pengiriman &amp; Distribusi</h1>
          <p className="text-gray-500 mt-1">Laporan terpadu arus logistik (Outlet, Personal Buyer, Booth, Sample, Retur).</p>
          <div className="text-xs text-blue-700 font-semibold mt-1 bg-blue-50 px-2.5 py-1 rounded inline-block">
            📅 Periode: <b>{filterLabel}</b> ({shipments.length} transaksi keluar terdeteksi)
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <DateRangePicker date={dateRange} setDate={setDateRange} />
          <button
            onClick={() => setAppliedDateRange(dateRange)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition shadow-sm"
          >
            Tampilkan
          </button>
          <button
            onClick={() => {
              setDateRange(undefined);
              setAppliedDateRange(undefined);
            }}
            className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition"
          >
            Semua Waktu
          </button>
        </div>
      </div>

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
            <span style={{ fontSize: 16 }}>🚚</span> TOTAL PRODUK KELUAR
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
              <CardTitle>History Distribusi &amp; Pengiriman</CardTitle>
              <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                <div className="relative flex-1 md:w-64">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    placeholder="Cari rute, tujuan, atau staf..."
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
                  <option value="ALL">Semua Kategori</option>
                  {uniqueTypes.map(t => (
                    <option key={t as string} value={t as string}>
                      {String(t) === 'PENGIRIMAN_OUTLET' ? '🚚 Outlet' :
                       String(t) === 'PERSONAL_BUYER' ? '👤 Personal Buyer' :
                       String(t) === 'TRANSFER_BOOTH' ? '🎪 Booth Event' :
                       String(t) === 'SAMPLE' ? '🎁 Sample Promo' :
                       String(t) === 'RETUR' ? '🔄 Retur' : String(t)}
                    </option>
                  ))}
                </select>
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                  className="px-3 py-2 border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="DESC">Terbaru</option>
                  <option value="ASC">Terlama</option>
                </select>
                <div className="ml-auto flex shrink-0">
                  <PdfExportButton targetId="pengiriman-report" filename="laporan-pengiriman-terpadu" />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal &amp; Waktu</TableHead>
                  <TableHead>Kategori Arus</TableHead>
                  <TableHead>Rute (Dari &rarr; Ke)</TableHead>
                  <TableHead>Detail Produk</TableHead>
                  <TableHead>Catatan</TableHead>
                  <TableHead>PIC / Petugas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleShipments.map((s: any) => {
                  const qty = s.items?.reduce((sum: number, item: any) => sum + item.qty, 0) || 0;
                  const isRetur = s.shipment_type === 'RETUR';
                  const isPB = s.shipment_type === 'PERSONAL_BUYER';
                  const isBooth = s.shipment_type === 'TRANSFER_BOOTH';
                  const isSample = s.shipment_type === 'SAMPLE';
                  const isOutlet = s.shipment_type === 'PENGIRIMAN_OUTLET' || s.destination_type === 'OUTLET';
                  
                  return (
                    <TableRow key={s.id} className="hover:bg-gray-100 transition-colors cursor-pointer" onClick={() => setDetailedShipment(s)}>
                      <TableCell className="whitespace-nowrap">
                        <div className="font-medium text-gray-900">{new Date(s.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                        <div className="text-xs text-gray-500">{new Date(s.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`
                          ${isRetur ? 'bg-red-50 text-red-700 border-red-200' :
                            isPB ? 'bg-purple-50 text-purple-700 border-purple-200' :
                            isBooth ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                            isSample ? 'bg-amber-50 text-amber-700 border-amber-200' :
                            isOutlet ? 'bg-blue-50 text-blue-700 border-blue-200' :
                            'bg-gray-50 text-gray-700 border-gray-200'}
                        `}>
                          {isRetur ? '🔄 RETUR' :
                           isPB ? '👤 PERSONAL BUYER' :
                           isBooth ? '🎪 BOOTH EVENT' :
                           isSample ? '🎁 SAMPLE' :
                           isOutlet ? '🚚 OUTLET' : (s.shipment_type || 'DISTRIBUSI')}
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
                        <span className="font-semibold text-blue-900">{qty} pcs</span>
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

      {detailedShipment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 rounded-t-xl">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Detail Pengiriman</h3>
                <p className="text-sm text-gray-500 mt-1">ID: {detailedShipment.id}</p>
              </div>
              <button onClick={() => setDetailedShipment(null)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                Tutup
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <div className="text-xs text-gray-500 font-medium mb-1">DARI</div>
                  <div className="font-semibold text-gray-900">{detailedShipment.source_name || '-'}</div>
                  <div className="text-xs text-gray-500">{detailedShipment.source_type}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 font-medium mb-1">TUJUAN</div>
                  <div className="font-semibold text-gray-900">{detailedShipment.destination_name || detailedShipment.destination_type}</div>
                  <div className="text-xs text-gray-500">{detailedShipment.destination_type}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 font-medium mb-1">TANGGAL</div>
                  <div className="font-semibold text-gray-900">{new Date(detailedShipment.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 font-medium mb-1">TIPE / STATUS</div>
                  <Badge variant="outline" className={detailedShipment.shipment_type === 'RETUR' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-blue-50 text-blue-700 border-blue-200'}>
                    {detailedShipment.shipment_type || 'PENGIRIMAN'}
                  </Badge>
                </div>
              </div>

              <h4 className="font-semibold text-gray-900 mb-3 border-b pb-2">Produk Terkirim</h4>
              <div className="space-y-2">
                {detailedShipment.items?.map((item: any) => (
                  <div key={item.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <span className="font-medium text-gray-800">{item.product?.name || 'Produk Tidak Dikenal'}</span>
                    <span className="font-bold text-blue-700 bg-blue-100 px-3 py-1 rounded-full">{item.qty} pcs</span>
                  </div>
                ))}
                {!detailedShipment.items?.length && (
                  <div className="text-gray-500 italic text-sm text-center py-4">Tidak ada data produk.</div>
                )}
              </div>
              
              {detailedShipment.notes && (
                <div className="mt-6 pt-4 border-t border-gray-100">
                  <h4 className="font-semibold text-gray-900 mb-2">Catatan Tambahan</h4>
                  <p className="text-sm text-gray-600 bg-yellow-50 p-3 rounded-lg border border-yellow-100">{detailedShipment.notes}</p>
                </div>
              )}
            </div>
            <div className="p-4 border-t border-gray-100 bg-gray-50/50 rounded-b-xl flex justify-end">
              <button onClick={() => setDetailedShipment(null)} className="px-6 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition font-medium">
                Tutup Detail
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
