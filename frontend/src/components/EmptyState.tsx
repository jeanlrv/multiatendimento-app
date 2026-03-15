import React from 'react';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
    icon: LucideIcon;
    title: string;
    description?: string;
    action?: {
        label: string;
        onClick: () => void;
    };
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon: Icon, title, description, action }) => {
    return (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center select-none">
            <div className="rounded-2xl bg-slate-100 dark:bg-slate-800/60 p-5">
                <Icon className="h-10 w-10 text-slate-400 dark:text-slate-500" />
            </div>
            <div>
                <p className="text-base font-semibold text-slate-700 dark:text-slate-200">{title}</p>
                {description && (
                    <p className="text-sm text-slate-400 dark:text-slate-500 mt-1 max-w-xs mx-auto">{description}</p>
                )}
            </div>
            {action && (
                <button
                    onClick={action.onClick}
                    className="mt-1 flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
                >
                    {action.label}
                </button>
            )}
        </div>
    );
};
