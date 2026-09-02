import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Security headers on all routes
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  // Allow Google Sign-In popup to communicate back via postMessage
  // 'same-origin-allow-popups' is required for Google GSI (accounts.google.com)
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');

  // CORS for API routes
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const origin = request.headers.get('origin');
    const allowedOrigin = process.env.NEXT_PUBLIC_APP_URL;
    const isDev = process.env.NODE_ENV === 'development';

    let corsOrigin = '';
    if (origin && allowedOrigin && origin === allowedOrigin) {
      // Exact match — allow this origin
      corsOrigin = allowedOrigin;
    } else if (isDev && origin) {
      // Development: allow any requesting origin for local convenience
      corsOrigin = origin;
    }
    // Production with no match or no NEXT_PUBLIC_APP_URL: corsOrigin stays empty,
    // so Access-Control-Allow-Origin is never set — browser blocks cross-origin.

    if (corsOrigin) {
      response.headers.set('Access-Control-Allow-Origin', corsOrigin);
      response.headers.set('Vary', 'Origin');
    }
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Benchmark-Secret');
    response.headers.set('Access-Control-Max-Age', '86400');
    response.headers.set('Access-Control-Expose-Headers', 'X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Used, X-Usage-Warning');

    if (request.method === 'OPTIONS') {
      return new NextResponse(null, { status: 204, headers: response.headers });
    }
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
