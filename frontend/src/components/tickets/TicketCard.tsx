'use client';

import { motion } from 'framer-motion';
import { CheckCheck, User } from 'lucide-react';
import { SlaIndicator } from '@/components/chat/SlaIndicator';
import { type Ticket } from '@/services/tickets';
import { translateStatus } from '@/lib/translations';

interface TicketCardProps {
    ticket: Ticket;
    selectedTicket: Ticket | null;
    selectedTicketIds: string[];
    onSelect: (ticket: Ticket) => void;
    onToggleSelection: (id: string, e: React.MouseEvent) => void;
}

export function TicketCard({ ticket, selectedTicket, selectedTicketIds, onSelect, onToggleSelection }: TicketCardProps) {
    const isSelected = selectedTicket?.id === ticket.id;
    const isBulkSelected = selectedTicketIds.includes(ticket.id);

    const borderClass = isSelected || isBulkSelected
        ? 'border-primary ring-2 ring-primary ring-offset-2 dark:ring-offset-slate-900 bg-primary/5 shadow-md shadow-primary/5'
        : 'border-transparent bg-white/60 dark:bg-transparent hover:border-white/40 dark:hover:border-white/10';

    return (
        <motion.button
            key={ticket.id}
            onClick={() => onSelect(ticket)}
            className={`w-full text-left p-2.5 rounded-2xl transition-all border relative group/card ${borderClass}`}
            whileHover={{ x: 5 }}
            whileTap={{ scale: 0.98 }}
        >
            {/* Checkbox para seleção em lote */}
            <div
                onClick={(e) => onToggleSelection(ticket.id, e)}
                className={`absolute left-2 top-1/2 -translate-y-1/2 h-6 w-6 rounded-lg border-2 flex items-center justify-center transition-all z-20 ${isBulkSelected
                    ? 'bg-primary border-primary text-white'
                    : 'border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 opacity-0 group-hover/card:opacity-100'
                    }`}
            >
                {isBulkSelected && <CheckCheck size={12} />}
            </div>
            <div className={`flex items-start justify-between mb-2 transition-all duration-150 ${selectedTicketIds.length > 0 || isBulkSelected ? 'pl-6' : 'group-hover/card:pl-6'}`}>
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <div
                            className={`h-10 w-10 rounded-xl flex items-center justify-center font-black text-base transition-all duration-500 ${isSelected
                                ? 'text-white shadow-lg'
                                : 'bg-slate-200 dark:bg-white/5 text-slate-600 dark:text-gray-400'
                                }`}
                            style={{
                                backgroundColor: isSelected ? (ticket.department.color || '#2563eb') : undefined,
                                boxShadow: isSelected ? `0 10px 20px ${(ticket.department.color || '#2563eb')}40` : undefined
                            }}
                        >
                            {ticket.department.emoji || ticket.contact.name.charAt(0)}
                        </div>
                        {ticket.priority !== 'MEDIUM' && (
                            <div className={`absolute -top-1 -right-1 h-4 w-4 rounded-full border-2 border-white dark:border-slate-900 ${ticket.priority === 'CRITICAL' ? 'bg-rose-500' :
                                ticket.priority === 'HIGH' ? 'bg-amber-500' : 'bg-slate-400'
                                }`} />
                        )}
                    </div>
                    <div className="flex-1 min-w-0 transition-transform flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                <h3 className={`text-[13px] font-black tracking-tight leading-none truncate flex-1 min-w-0 ${isSelected ? 'text-primary' : 'text-slate-800 dark:text-white'}`} title={ticket.contact.name}>
                                    {ticket.contact.name || 'Contato'}
                                </h3>
                                <span className="text-[9px] font-mono text-slate-400 bg-slate-100 dark:bg-white/5 px-1 py-0.5 rounded-md shrink-0">
                                    #{ticket.id.substring(ticket.id.length - 4).toUpperCase()}
                                </span>
                                {ticket.unreadMessages > 0 && (
                                    <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-primary text-white text-[10px] font-black rounded-full shrink-0 shadow-sm shadow-primary/40 leading-none">
                                        {ticket.unreadMessages > 99 ? '99+' : ticket.unreadMessages}
                                    </span>
                                )}
                            </div>
                            <div className="flex flex-col items-end gap-0.5 shrink-0">
                                {ticket.assignedUser && (
                                    <div className="flex items-center gap-1 bg-blue-50 dark:bg-blue-500/10 px-1 py-0.5 rounded-md border border-blue-100 dark:border-blue-500/20">
                                        <User size={8} className="text-blue-600 dark:text-blue-400" />
                                        <span className="text-[7.5px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-tighter">
                                            {ticket.assignedUser.name.split(' ')[0]}
                                        </span>
                                    </div>
                                )}
                                <span className={`px-1.5 py-0.5 rounded-md text-[7.5px] font-black uppercase tracking-tighter ${isSelected ? 'bg-primary/20 text-primary border border-primary/20' : 'bg-slate-100 dark:bg-white/5 text-slate-500'}`}>
                                    {translateStatus(ticket.status)}
                                </span>
                            </div>
                        </div>
                        {ticket.subject && (
                            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 line-clamp-1 italic">
                                {ticket.subject}
                            </p>
                        )}
                        <div className="flex flex-nowrap gap-1">
                            {ticket.tags?.slice(0, 2).map((t: any) => (
                                <span
                                    key={t.tag.id}
                                    className="px-1.5 py-0.5 rounded-lg text-[7px] font-black uppercase tracking-widest border border-white/20 truncate max-w-[80px]"
                                    style={{ backgroundColor: `${t.tag.color}20`, color: t.tag.color }}
                                >
                                    {t.tag.name}
                                </span>
                            ))}
                            {(ticket.tags?.length || 0) > 2 && (
                                <span className="text-[7px] font-black text-slate-400 self-center">
                                    +{(ticket.tags?.length || 0) - 2}
                                </span>
                            )}
                        </div>
                        <div className="flex flex-col mt-auto gap-0.5">
                            <div className="flex items-center gap-1 min-w-0">
                                <p
                                    className="text-[10px] font-black uppercase tracking-widest italic truncate"
                                    style={{ color: ticket.department.color || undefined, opacity: isSelected ? 1 : 0.6 }}
                                >
                                    {ticket.department.name}
                                </p>
                                <div className="h-1 w-1 shrink-0 bg-slate-300 rounded-full" />
                                <p className="text-[10px] font-bold opacity-40 shrink-0">
                                    {new Date(ticket.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </p>
                            </div>
                            <SlaIndicator ticket={ticket} />
                        </div>
                    </div>
                </div>
            </div>
        </motion.button>
    );
}
