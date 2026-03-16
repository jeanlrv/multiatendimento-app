import { cn } from '@/lib/utils';

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={cn('animate-pulse rounded-md bg-gray-200 dark:bg-gray-700/50', className)}
            {...props}
        />
    );
}

/** Skeleton de card de stat do dashboard */
function StatCardSkeleton() {
    return (
        <div className="glass-card p-5 rounded-2xl flex flex-col gap-3">
            <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-8 w-8 rounded-xl" />
            </div>
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-3 w-32" />
        </div>
    );
}

/** Skeleton de linha de ticket na lista lateral */
function TicketRowSkeleton() {
    return (
        <div className="flex items-start gap-3 px-3 py-3 border-b border-white/5">
            <Skeleton className="h-9 w-9 rounded-full shrink-0" />
            <div className="flex-1 min-w-0 space-y-2">
                <div className="flex items-center justify-between gap-2">
                    <Skeleton className="h-3.5 w-28" />
                    <Skeleton className="h-3 w-10" />
                </div>
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-2/3" />
            </div>
        </div>
    );
}

/** Skeleton de linha de contato/tabela genérica */
function TableRowSkeleton({ cols = 4 }: { cols?: number }) {
    return (
        <tr className="border-b border-white/5">
            {Array.from({ length: cols }).map((_, i) => (
                <td key={i} className="px-4 py-3">
                    <Skeleton className={`h-4 ${i === 0 ? 'w-36' : i === cols - 1 ? 'w-16' : 'w-24'}`} />
                </td>
            ))}
        </tr>
    );
}

/** Skeleton de card de contato (view em grid) */
function ContactCardSkeleton() {
    return (
        <div className="glass-card p-4 rounded-xl space-y-3">
            <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                </div>
            </div>
            <Skeleton className="h-3 w-full" />
            <div className="flex gap-2">
                <Skeleton className="h-6 w-16 rounded-full" />
                <Skeleton className="h-6 w-12 rounded-full" />
            </div>
        </div>
    );
}

/** Skeleton de linha na lista de tickets (sidebar) - N repetições */
function TicketListSkeleton({ count = 6 }: { count?: number }) {
    return (
        <>
            {Array.from({ length: count }).map((_, i) => (
                <TicketRowSkeleton key={i} />
            ))}
        </>
    );
}

/** Skeleton grid de stats do dashboard */
function DashboardStatsSkeleton() {
    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
                <StatCardSkeleton key={i} />
            ))}
        </div>
    );
}

export {
    Skeleton,
    StatCardSkeleton,
    TicketRowSkeleton,
    TicketListSkeleton,
    TableRowSkeleton,
    ContactCardSkeleton,
    DashboardStatsSkeleton,
};
