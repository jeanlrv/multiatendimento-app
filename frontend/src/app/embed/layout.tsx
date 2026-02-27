import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import '@/styles/globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
    title: 'KSZap Chat',
    description: 'Converse com nosso assistente de IA',
}

export default function EmbedLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="pt-BR">
            <body className={inter.className} style={{ background: 'transparent' }}>
                {children}
            </body>
        </html>
    )
}
