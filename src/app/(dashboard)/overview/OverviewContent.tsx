'use client';

import useSWR from 'swr';
import { useSearchParams } from 'next/navigation';
import OverviewClient from './OverviewClient';

export default function OverviewContent() {
  const searchParams = useSearchParams();
  const from = searchParams.get('from') || '';
  const to = searchParams.get('to') || '';
  const lifetime = searchParams.get('lifetime') || '';

  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  if (lifetime) params.set('lifetime', lifetime);

  const queryString = params.toString();
  const apiUrl = `/api/data/overview${queryString ? `?${queryString}` : ''}`;

  const { data, error, isLoading, isValidating } = useSWR(apiUrl, { 
    revalidateOnFocus: false,
    refreshInterval: 90000 
  });

  if (isLoading && !data && !error) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 40, height: 40, border: '4px solid #e5e7eb', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
          <div style={{ color: '#6b7280', fontSize: 14 }}>Memuat data overview...</div>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center text-red-500 bg-red-50 rounded-xl mt-6">
        <h3 className="text-xl font-bold mb-2">Gagal Memuat Data</h3>
        <p>Terjadi kesalahan saat mengambil data dari server. Silakan coba muat ulang halaman (F5) atau periksa koneksi database.</p>
      </div>
    );
  }

  if (!data) return null;

  return <OverviewClient data={data} isValidating={isValidating} />;
}
