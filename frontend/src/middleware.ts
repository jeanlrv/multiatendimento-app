import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
    // 'session' cookie dura 7 dias (set no login, persiste mesmo após token 15min expirar)
    // 'token' cookie dura 15min (alinhado com JWT)
    const hasSession = request.cookies.get('session')?.value || request.cookies.get('token')?.value;
    const pathname = request.nextUrl.pathname;
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
    matcher: ['/', '/dashboard/:path*', '/login'],
};

