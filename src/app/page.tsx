import { redirect } from 'next/navigation';
import { verifySession } from '@/lib/auth';

export default async function Home() {
  const session = await verifySession();
  if (!session) {
    redirect('/login');
  }

  const role = (session.role || '').toUpperCase();
  if (role === 'MARKETING' || role.includes('MARKETING')) {
    redirect('/marketing');
  }
  if (role === 'PRODUKSI' || role.includes('PRODUKSI')) {
    redirect('/produksi');
  }
  if (role === 'MITRA' || role.includes('MITRA')) {
    redirect('/outlet');
  }

  redirect('/overview');
}
