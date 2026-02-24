import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Timer } from 'lucide-react';
import { NodeData } from '../../types/workflow.types';

const WaitForEventNode = ({ data, selected }: NodeProps<NodeData>) => {
    return (
        <div className={`
            relative px-4 py-4 rounded-2xl shadow-xl min-w-[220px]
            bg-white/80 dark:bg-slate-900/80 backdrop-blur-md
            border-2 transition-all duration-300
            ${selected
                ? 'border-indigo-500 shadow-indigo-500/30 scale-[1.04]'
                : 'border-white/50 dark:border-white/10 hover:border-indigo-500/40'}
        `}>

            <Handle
                type="target"
                position={Position.Top}
                className="w-3 h-3 !bg-indigo-500 !border-2 !border-white dark:!border-slate-900"
            />

            <div className="flex items-center gap-3">
                <div className={`
                    p-2 rounded-xl flex items-center justify-center
                    bg-gradient-to-br from-indigo-500 to-indigo-600 text-white
                    shadow-lg shadow-indigo-500/30
                `}>
                    <Timer size={16} />
                </div>

                <div className="flex-1">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Aguardar Evento
                    </h3>

                    <p className="text-xs font-bold text-slate-800 dark:text-slate-100 leading-tight">
                        {data.label || 'Aguardar...'}
                    </p>

                    {data.params?.eventToWait && (
                        <div className="mt-1 text-[10px] font-medium text-indigo-600 dark:text-indigo-400 max-w-[150px] truncate">
                            Evento: {data.params.eventToWait}
                        </div>
                    )}
                </div>
            </div>

            {/* Success Output Handle (evento ocorreu) */}
            <Handle
                type="source"
                position={Position.Bottom}
                id="success"
                style={{ left: '30%' }}
                className="w-3 h-3 !bg-emerald-500 !border-2 !border-white dark:!border-slate-900"
            />

            {/* Timeout Output Handle (timeout excedido) */}
            <Handle
                type="source"
                position={Position.Bottom}
                id="timeout"
                style={{ left: '70%' }}
                className="w-3 h-3 !bg-rose-500 !border-2 !border-white dark:!border-slate-900"
            />

            {selected && (
                <div className="absolute inset-0 rounded-2xl pointer-events-none ring-4 ring-indigo-500/20" />
            )}
        </div>
    );
};

export default memo(WaitForEventNode);
