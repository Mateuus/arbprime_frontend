// middleware.ts
import { NextRequest, NextResponse } from 'next/server';

export function middleware(req: NextRequest) {
  const token = req.cookies.get('MToken')?.value;

  if (!token || token === 'anonymous') {
    if (req.nextUrl.pathname.startsWith('/arbbets')) {
      return NextResponse.redirect(new URL('/', req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/arbbets', '/arbbets/:path*'
  ],
};
