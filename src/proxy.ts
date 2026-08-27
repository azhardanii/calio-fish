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

    const role = payload.role as string;
    
    // Role-based route protection
    // Owner / Admin can access all
    // Produksi can only access /produksi and /overview
    // Marketing can only access /marketing and /overview
    // Mitra can only access /outlet, /pengiriman, /overview
    
    const isOwnerOrAdmin = role === 'OWNER' || role === 'ADMIN';
    
    if (!isOwnerOrAdmin) {
      if (role === 'PRODUKSI' && !pathname.startsWith('/produksi') && pathname !== '/overview') {
        return NextResponse.redirect(new URL('/overview', req.url));
      }
      if (role === 'MARKETING' && !pathname.startsWith('/marketing') && pathname !== '/overview') {
        return NextResponse.redirect(new URL('/overview', req.url));
      }
      if (role === 'MITRA' && !pathname.startsWith('/outlet') && !pathname.startsWith('/pengiriman') && pathname !== '/overview') {
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
