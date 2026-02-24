import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { StopCircle } from 'lucide-react';
import { NodeData } from '../../types/workflow.types';

const EndNode = ({ data, selected }: NodeProps<NodeData>) => {
    return (
        <div className={`
            relative px-4 py-4 rounded-2xl shadow-xl min-w-[180px]
            bg-white/80 dark:bg-slate-900/80 backdrop-blur-md
            border-2 transition-all duration-300
            ${selected
                ? 'border-rose-500 shadow-rose-500/30 scale-[1.04]'
                : 'border-white/50 dark:border-white/10 hover:border-rose-500/40'}
        `}>

            {/* Input Handle */}
            <Handle
                type="target"
                position={Position.Top}
                className="w-3 h-3 !bg-rose-500 !border-2 !border-white dark:!border-slate-900"
            />

            <div className="flex items-center gap-3">
                <div className={`
                    p-2 rounded-xl flex items-center justify-center
                    bg-gradient-to-br from-rose-500 to-rose-600 text-white
                    shadow-lg shadow-rose-500/30
                    ${selected ? 'animate-pulse' : ''}
                `}>
                    <StopCircle size={16} />
                </div>

                <div className="flex-1">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Finalizar
                    </h3>

                    <p className="text-xs font-bold text-slate-800 dark:text-slate-100 leading-tight">
                        {data.label || 'Fim do Fluxo'}
                    </p>
                </div>
            </div>

            {/* Glow Extra quando selecionado */}
            {selected && (
                <div className="absolute inset-0 rounded-2xl pointer-events-none ring-4 ring-rose-500/20" />
            )}
        </div>
    );
};

export default memo(EndNode);
