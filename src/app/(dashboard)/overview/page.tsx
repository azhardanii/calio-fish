import { verifySession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import OverviewContent from './OverviewContent';

export default async function OverviewPage() {
  const session = await verifySession();
  if (!session) {
    redirect('/login');
  }

  const role = (session.role || '').toUpperCase();
  const isOwnerOrAdmin = role === 'OWNER' || role === 'ADMIN';

  if (!isOwnerOrAdmin) {
    if (role === 'MARKETING' || role.includes('MARKETING')) {
      redirect('/marketing');
    } else if (role === 'PRODUKSI' || role.includes('PRODUKSI')) {
      redirect('/produksi');
    } else if (role === 'MITRA' || role.includes('MITRA')) {
      redirect('/outlet');
    } else {
      redirect('/login');
    }
  }

  return (
    <Suspense fallback={
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 40, height: 40, border: '4px solid #e5e7eb', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
          <div style={{ color: '#6b7280', fontSize: 14 }}>Mempersiapkan data overview...</div>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    }>
      <OverviewContent />
    </Suspense>
  );
}
