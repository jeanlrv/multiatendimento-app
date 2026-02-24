import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Split } from 'lucide-react';
import { NodeData } from '../../types/workflow.types';

const SplitTrafficNode = ({ data, selected }: NodeProps<NodeData>) => {
    return (
        <div className={`
            relative px-4 py-4 rounded-2xl shadow-xl min-w-[220px]
            bg-white/80 dark:bg-slate-900/80 backdrop-blur-md
            border-2 transition-all duration-300
            ${selected
                ? 'border-fuchsia-500 shadow-fuchsia-500/30 scale-[1.04]'
                : 'border-white/50 dark:border-white/10 hover:border-fuchsia-500/40'}
        `}>

            <Handle
                type="target"
                position={Position.Top}
                className="w-3 h-3 !bg-fuchsia-500 !border-2 !border-white dark:!border-slate-900"
            />

            <div className="flex items-center gap-3">
                <div className={`
                    p-2 rounded-xl flex items-center justify-center
                    bg-gradient-to-br from-fuchsia-500 to-fuchsia-600 text-white
                    shadow-lg shadow-fuchsia-500/30
                `}>
                    <Split size={16} />
                </div>

                <div className="flex-1">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Divisão de Tráfego
                    </h3>

                    <p className="text-xs font-bold text-slate-800 dark:text-slate-100 leading-tight">
                        {data.label || 'Teste A/B'}
                    </p>

                    {data.params?.percentageA && (
                        <div className="mt-1 text-[10px] font-medium text-fuchsia-600 dark:text-fuchsia-400">
                            A: {data.params.percentageA}% | B: {100 - data.params.percentageA}%
                        </div>
                    )}
                </div>
            </div>

            {/* A Output Handle */}
            <Handle
                type="source"
                position={Position.Bottom}
                id="a"
                style={{ left: '30%' }}
                className="w-3 h-3 !bg-fuchsia-500 !border-2 !border-white dark:!border-slate-900"
            />

            {/* B Output Handle */}
            <Handle
                type="source"
                position={Position.Bottom}
                id="b"
                style={{ left: '70%' }}
                className="w-3 h-3 !bg-fuchsia-500 !border-2 !border-white dark:!border-slate-900"
            />

            {selected && (
                <div className="absolute inset-0 rounded-2xl pointer-events-none ring-4 ring-fuchsia-500/20" />
            )}
        </div>
    );
};

export default memo(SplitTrafficNode);
