import { NextResponse } from 'next/server'

/**
 * Expõe URLs públicas em runtime (sem depender de variáveis NEXT_PUBLIC_* baked no build).
 * Lê variáveis server-side que estão disponíveis em runtime mesmo sem rebuild.
 */
export async function GET() {
    const backendUrl = (
        process.env.BACKEND_PUBLIC_URL ||
        process.env.BACKEND_URL ||
        process.env.NEXT_PUBLIC_BACKEND_PUBLIC_URL ||
        'http://localhost:3002'
    ).replace(/\/api\/?$/, '').replace(/\/$/, '')

    return NextResponse.json({ backendUrl })
}
