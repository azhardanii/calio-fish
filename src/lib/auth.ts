import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const SECRET_KEY = process.env.JWT_SECRET || 'secret_key_for_calio_fish_development';
const key = new TextEncoder().encode(SECRET_KEY);

export async function createSession(payload: any) {
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(key);

  const cookieStore = await cookies();
  cookieStore.set('session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    expires: expires,
    sameSite: 'lax',
    path: '/',
  });
}

import { prisma } from '@/lib/prisma';

export async function verifySession() {
  const cookieStore = await cookies();
  const session = cookieStore.get('session')?.value;

  if (!session) return null;

  try {
    const { payload } = await jwtVerify(session, key, {
      algorithms: ['HS256'],
    });

    let role = (payload.role as string || '').toUpperCase();
    
    // Fetch fresh role from DB to ensure security and fix stale token issues
    if (payload.id) {
      const dbUser = await prisma.employee.findUnique({
        where: { id: payload.id as string },
        select: { role: true, posisi: true }
      });
      if (dbUser) {
        let r = (dbUser.role || '').toUpperCase();
        const p = (dbUser.posisi || '').toUpperCase();
        if (r === 'STAFF PRODUKSI' || r === 'STAFF_PRODUKSI' || r.includes('PRODUKSI') || p.includes('PRODUKSI')) {
          r = 'PRODUKSI';
        } else if (r === 'STAFF MARKETING' || r === 'STAFF_MARKETING' || r.includes('MARKETING') || p.includes('MARKETING')) {
          r = 'MARKETING';
        } else if (r.includes('MITRA') || p.includes('MITRA')) {
          r = 'MITRA';
        } else if (r.includes('ADMIN') || p.includes('ADMIN')) {
          r = 'ADMIN';
        } else if (r.includes('OWNER') || p.includes('OWNER')) {
          r = 'OWNER';
        }
        role = r || (dbUser.role || '').toUpperCase() || 'STAFF';
      }
    }

    return { ...payload, role } as { id: string; role: string; nama: string };
  } catch (error) {
    return null;
  }
}

export async function deleteSession() {
  const cookieStore = await cookies();
  cookieStore.delete('session');
}
