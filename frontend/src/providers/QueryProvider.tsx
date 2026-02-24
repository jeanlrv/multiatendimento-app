'use client';

// QueryProvider mantido como wrapper vazio para compatibilidade de importações existentes.
// TanStack React Query foi removido — dados são gerenciados com useState/useEffect direto.
export default function QueryProvider({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
