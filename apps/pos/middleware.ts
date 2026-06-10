import { NextRequest, NextResponse } from 'next/server';

const POS_COOKIE_NAME = 'pos_access_token';

// Routes that don't require authentication
const PUBLIC_PATHS = [
  '/pos/login',
  '/favicon.ico',
];

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  // Allow Next.js internals and static assets
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api')
  ) {
    return NextResponse.next();
  }

  // Allow public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Only protect /pos/* routes
  if (!pathname.startsWith('/pos')) {
    return NextResponse.next();
  }

  const hasCookie = !!request.cookies.get(POS_COOKIE_NAME)?.value;

  if (!hasCookie) {
    const loginUrl = new URL('/pos/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
