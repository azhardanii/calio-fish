import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const SECRET_KEY = process.env.JWT_SECRET || 'secret_key_for_calio_fish_development';
const key = new TextEncoder().encode(SECRET_KEY);

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const session = req.cookies.get('session')?.value;

  if (!session) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  try {
    const { payload } = await jwtVerify(session, key, {
      algorithms: ['HS256'],
    });

    const role = (payload.role as string || '').toUpperCase();
    
    // Role-based route protection
    // Owner / Admin can access all
    // Produksi can access /produksi, /overview, and /chats
    // Marketing can access /marketing, /overview, and /chats
    // Mitra can access /outlet, /pengiriman, /overview, and /chats
    
    const isOwnerOrAdmin = role === 'OWNER' || role === 'ADMIN';
    const isProduksi = isOwnerOrAdmin || role === 'PRODUKSI' || role.includes('PRODUKSI');
    const isMarketing = isOwnerOrAdmin || role === 'MARKETING' || role.includes('MARKETING');
    const isMitra = isOwnerOrAdmin || role === 'MITRA' || role.includes('MITRA');
    
    if (!isOwnerOrAdmin) {
      if (isProduksi && !pathname.startsWith('/produksi') && pathname !== '/overview' && pathname !== '/chats') {
        return NextResponse.redirect(new URL('/overview', req.url));
      }
      if (isMarketing && !pathname.startsWith('/marketing') && pathname !== '/overview' && pathname !== '/chats') {
        return NextResponse.redirect(new URL('/overview', req.url));
      }
      if (isMitra && !pathname.startsWith('/outlet') && !pathname.startsWith('/pengiriman') && pathname !== '/overview' && pathname !== '/chats') {
        return NextResponse.redirect(new URL('/overview', req.url));
      }
    }

    const requestHeaders = new Headers(req.headers);
    requestHeaders.set('x-user-id', payload.id as string);
    requestHeaders.set('x-user-role', payload.role as string);
    requestHeaders.set('x-user-nama', payload.nama as string);

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  } catch (error) {
    return NextResponse.redirect(new URL('/login', req.url));
  }
}

export const config = {
  matcher: ['/((?!api/auth|api/webhook|login|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
