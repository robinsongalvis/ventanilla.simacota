import { NextResponse, type NextRequest } from 'next/server';
import { INTERNAL_AUTH_COOKIE } from '@/lib/auth-cookie';

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasInternalSession = request.cookies.get(INTERNAL_AUTH_COOKIE)?.value === '1';

  if (pathname === '/interno/login') {
    if (hasInternalSession) {
      return NextResponse.redirect(new URL('/interno/dashboard', request.url));
    }

    return NextResponse.next();
  }

  if (!hasInternalSession) {
    const loginUrl = new URL('/interno/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/interno/:path*'],
};
