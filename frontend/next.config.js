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

    async rewrites() {
        const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3002';
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
