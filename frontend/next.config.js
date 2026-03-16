/** @type {import('next').NextConfig} */

const withPWAInit = require('next-pwa');

/** @type {import('next-pwa').PWAConfig} */
const withPWA = withPWAInit({
    dest: 'public',
    disable: process.env.NODE_ENV === 'development', // Desativado em dev para não interferir no HMR
    register: true,
    skipWaiting: true,
    buildExcludes: [/middleware-manifest\.json$/],
    customWorkerDir: 'worker', // Injeta worker/index.js no sw.js — handlers de Web Push
});

const nextConfig = {
    reactStrictMode: true,
    output: 'standalone',
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

    // Security headers aplicados em todas as rotas exceto /embed/* (que permite iframe)
    // O middleware (src/middleware.ts) remove X-Frame-Options e CSP para /embed/*
    async headers() {
        return [
            {
                // Aplica headers de segurança em todas as páginas exceto embed
                source: '/((?!embed).*)',
                headers: [
                    { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
                    { key: 'X-Content-Type-Options', value: 'nosniff' },
                    { key: 'X-DNS-Prefetch-Control', value: 'on' },
                    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
                    { key: 'Permissions-Policy', value: 'camera=(), microphone=(self), geolocation=(), payment=()' },
                    {
                        key: 'Strict-Transport-Security',
                        value: 'max-age=63072000; includeSubDomains; preload',
                    },
                ],
            },
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

const { withSentryConfig } = require('@sentry/nextjs');

const sentryConfig = {
    silent: true,
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
    dryRun: !process.env.SENTRY_AUTH_TOKEN,
    disableLogger: true,
};

module.exports = process.env.NEXT_PUBLIC_SENTRY_DSN
    ? withSentryConfig(withPWA(nextConfig), sentryConfig)
    : withPWA(nextConfig);
