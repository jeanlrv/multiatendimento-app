import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import '@/styles/globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
    title: 'KSZap - Atendimento Multi-WhatsApp com IA',
    description: 'Plataforma premium para atendimento multi-WhatsApp com integração de IA e automação inteligente',
    manifest: '/manifest.json',
    appleWebApp: {
        capable: true,
        statusBarStyle: 'default',
        title: 'KSZap',
    },
}

export const viewport: Viewport = {
    themeColor: '#3B82F6',
}

import { AuthProvider } from '@/contexts/AuthContext'
import { CollaborationProvider } from '@/contexts/CollaborationContext'
import { ThemeProvider } from '@/components/theme-provider'
import QueryProvider from '@/providers/QueryProvider'

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="pt-BR" suppressHydrationWarning>
            <body className={inter.className}>
                <ThemeProvider
                    attribute="class"
                    defaultTheme="system"
                    enableSystem
                    disableTransitionOnChange
                >
                    <QueryProvider>
                        <AuthProvider>
                            <CollaborationProvider>
                                {children}
                            </CollaborationProvider>
                        </AuthProvider>
                    </QueryProvider>
                </ThemeProvider>
            </body>
        </html>
    )
}
