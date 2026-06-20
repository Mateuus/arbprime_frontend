// proxy.ts (Next.js 16: "middleware" renomeado para "proxy")
import { NextRequest, NextResponse } from 'next/server';

// Decodifica o payload do JWT (sem verificar assinatura — serve só para o gating de UI;
// a segurança real é no backend, que valida o token e responde 403).
function getRole(token: string): string | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const b64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4 ? '='.repeat(4 - (b64.length % 4)) : '';
    const json = JSON.parse(atob(b64 + pad));
    return typeof json.role === 'string' ? json.role : null;
  } catch {
    return null;
  }
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get('MToken')?.value;
  const isLogged = !!token && token !== 'anonymous';

  const redirectHome = () => NextResponse.redirect(new URL('/', req.url));

  // Exceção pública: a calculadora em tela cheia é acessível sem login.
  if (pathname.startsWith('/arbcrypto/calculator')) {
    return NextResponse.next();
  }

  // Área de administração: exige login + role admin
  if (pathname.startsWith('/admin')) {
    if (!isLogged || getRole(token as string) !== 'admin') {
      return redirectHome();
    }
    return NextResponse.next();
  }

  // Demais áreas autenticadas: exige login
  if (!isLogged) {
    return redirectHome();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/arbbets/:path*',
    '/arbcrypto/:path*',
    '/analytix/:path*',
    '/_user/:path*',
    '/admin/:path*'
  ],
};
