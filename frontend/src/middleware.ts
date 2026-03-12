import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
    const pathname = request.nextUrl.pathname;

    // ── Rotas de embed: remover restrições de framing ─────────────────────────
    // Next.js injeta X-Frame-Options: SAMEORIGIN por padrão.
    // Para rotas /embed/* precisamos remover esse header para que o iframe
    // funcione em qualquer site externo (https://, http://, file://).
    if (pathname.startsWith('/embed/')) {
        const response = NextResponse.next();
        // Remover restrições de framing para que o iframe funcione em qualquer origem.
        // Next.js adiciona X-Frame-Options: SAMEORIGIN por padrão — precisamos remover.
        // Não usamos frame-ancestors pois valores wildcard bloqueiam file:// (null origin).
        response.headers.delete('X-Frame-Options');
        response.headers.delete('Content-Security-Policy');
        return response;
    }

    // ── Rotas autenticadas ────────────────────────────────────────────────────
    // 'session' cookie dura 7 dias (set no login, persiste mesmo após token 15min expirar)
    // 'token' cookie dura 15min (alinhado com JWT)
    const hasSession = request.cookies.get('session')?.value || request.cookies.get('token')?.value;
    const isAuthPage = pathname.startsWith('/login');
    const isDashboardPage = pathname.startsWith('/dashboard');
    const isRootPage = pathname === '/';

    // Redirecionar root / para dashboard se sessão ativa
    if (isRootPage && hasSession) {
        return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    // Se tentar acessar o dashboard sem sessão, redirecionar para login
    if (isDashboardPage && !hasSession) {
        return NextResponse.redirect(new URL('/login', request.url));
    }

    // Se tentar acessar login com sessão ativa, redirecionar para dashboard
    if (isAuthPage && hasSession) {
        return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    return NextResponse.next();
}

export const config = {
    // Inclui /embed/* para que o middleware intercepte e remova os headers de framing
    matcher: ['/', '/dashboard/:path*', '/login', '/embed/:path*'],
};
