/** @type {import('next').NextConfig} */

const withPWAInit = require('next-pwa');

/** @type {import('next-pwa').PWAConfig} */
const withPWA = withPWAInit({
    dest: 'public',
    disable: process.env.NODE_ENV === 'development', // Desativado em dev para não interferir no HMR
    register: true,
    skipWaiting: true,
    buildExcludes: [/middleware-manifest\.json$/],
});

const nextConfig = {
    reactStrictMode: true,
    distDir: 'next-build',

    images: {
        domains: ['localhost'],
    },

    env: {
        NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
        NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL,
    },

    eslint: {
        ignoreDuringBuilds: true,
    },

    experimental: {
        workerThreads: false,
    },

    async headers() {
        return [
            {
                // Rotas de embed devem ser incorporáveis em qualquer site externo via iframe.
                // Next.js adiciona X-Frame-Options: SAMEORIGIN por padrão — sobrescrevemos aqui.
                // CSP frame-ancestors: '*' não cobre 'https:' no Chrome — listar schemes explicitamente.
                // frame-ancestors toma precedência sobre X-Frame-Options em browsers modernos (Chrome 40+).
                source: "/embed/:path*",
                headers: [
                    { key: "X-Frame-Options", value: "ALLOWALL" },
                    { key: "Content-Security-Policy", value: "frame-ancestors * https: http:" },
                ]
            }
        ];
    },

    async rewrites() {
        // Railway: comunicação interna é HTTP. BACKEND_INTERNAL_URL tem prioridade.
        const BACKEND_URL = process.env.BACKEND_INTERNAL_URL || process.env.BACKEND_URL || 'http://localhost:3002';
        console.log(`[NextConfig] Proxying /api to ${BACKEND_URL}`);
        return [
            {
                source: '/api/:path*',
                destination: `${BACKEND_URL}/api/:path*`,
            },
            {
                source: '/socket.io/:path*',
                destination: `${BACKEND_URL}/socket.io/:path*`,
            },
        ];
    },
}

module.exports = withPWA(nextConfig);
