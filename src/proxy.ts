import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const SECRET_KEY = process.env.JWT_SECRET || 'secret_key_for_calio_fish_development';
const key = new TextEncoder().encode(SECRET_KEY);

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const session = req.cookies.get('session')?.value;

  if (!session) {
    if (pathname.startsWith('/api')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', req.url));
  }

  try {
    const { payload } = await jwtVerify(session, key, {
      algorithms: ['HS256'],
    });

    const role = (payload.role as string || '').toUpperCase();
    const posisi = (payload.posisi as string || '').toUpperCase();
    
    // Role-based route protection
    // Owner / Admin can access all
    // Produksi can access /produksi, /warehouse, and /chats
    // Marketing can access /marketing, /booth, /outlet, and /chats
    // Mitra can access /outlet, /pengiriman, and /chats
    
    const isOwnerOrAdmin = role === 'OWNER' || role === 'ADMIN' || role.includes('OWNER') || role.includes('ADMIN') || posisi.includes('OWNER') || posisi.includes('ADMIN');
    const isProduksi = isOwnerOrAdmin || role === 'PRODUKSI' || role.includes('PRODUKSI') || posisi.includes('PRODUKSI');
    const isMarketing = isOwnerOrAdmin || role === 'MARKETING' || role.includes('MARKETING') || posisi.includes('MARKETING');
    const isMitra = isOwnerOrAdmin || role === 'MITRA' || role.includes('MITRA') || posisi.includes('MITRA');
    const isDistributor = isOwnerOrAdmin || role === 'DISTRIBUTOR' || role.includes('DISTRIBUTOR') || posisi.includes('DISTRIBUTOR');

    // 1. Authenticated API requests: pass through with user headers (never redirect API calls to HTML pages!)
    if (pathname.startsWith('/api')) {
      const requestHeaders = new Headers(req.headers);
      requestHeaders.set('x-user-id', payload.id as string);
      requestHeaders.set('x-user-role', (payload.role as string) || role);
      requestHeaders.set('x-user-nama', payload.nama as string);

      return NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      });
    }
    
    // 2. Page route authorization
    if (!isOwnerOrAdmin) {
      // Overview is strictly Owner / Admin only
      if (pathname === '/overview') {
        const defaultHome = isMarketing ? '/marketing' : isProduksi ? '/produksi' : isDistributor ? '/warehouse' : isMitra ? '/outlet' : '/login';
        return NextResponse.redirect(new URL(defaultHome, req.url));
      }

      const isMarketingPath = pathname.startsWith('/marketing') || pathname.startsWith('/ecommerce') || pathname.startsWith('/booth') || pathname.startsWith('/outlet') || pathname.startsWith('/warehouse') || pathname.startsWith('/pengiriman') || pathname.startsWith('/karyawan');
      const isProduksiPath = pathname.startsWith('/produksi') || pathname.startsWith('/warehouse') || pathname.startsWith('/karyawan');
      const isMitraPath = pathname.startsWith('/outlet') || pathname.startsWith('/pengiriman');
      const isDistributorPath = pathname.startsWith('/warehouse') || pathname.startsWith('/outlet') || pathname.startsWith('/pengiriman');
      const isCommonPath = pathname.startsWith('/chats') || pathname.startsWith('/karyawan');

      const isAllowed = 
        isCommonPath ||
        (isMarketing && isMarketingPath) ||
        (isProduksi && isProduksiPath) ||
        (isDistributor && isDistributorPath) ||
        (isMitra && isMitraPath);

      if (!isAllowed) {
        const fallback = isMarketing ? '/marketing' : isProduksi ? '/produksi' : isDistributor ? '/warehouse' : isMitra ? '/outlet' : '/login';
        return NextResponse.redirect(new URL(fallback, req.url));
      }
    }

    const requestHeaders = new Headers(req.headers);
    requestHeaders.set('x-user-id', payload.id as string);
    requestHeaders.set('x-user-role', (payload.role as string) || role);
    requestHeaders.set('x-user-nama', payload.nama as string);

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  } catch (error) {
    if (pathname.startsWith('/api')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', req.url));
  }
}

export const config = {
  matcher: ['/((?!api|login|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
