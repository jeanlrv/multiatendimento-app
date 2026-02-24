import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Clock } from 'lucide-react';
import { NodeData } from '../../types/workflow.types';

const DelayNode = ({ data, selected }: NodeProps<NodeData>) => {
    return (
        <div className={`
            px-4 py-3 rounded-2xl shadow-xl min-w-[180px]
            bg-white/80 dark:bg-slate-900/80 backdrop-blur-md 
            border-2 transition-all duration-300
            ${selected
                ? 'border-violet-500 shadow-violet-500/20 scale-105'
                : 'border-white/50 dark:border-white/10 hover:border-violet-500/50'}
        `}>
            {/* Input Handle */}
            <Handle
                type="target"
                position={Position.Top}
                className="w-3 h-3 !bg-violet-500 !border-2 !border-white dark:!border-slate-900"
            />

            <div className="flex items-center gap-3">
                <div className={`
                    p-2 rounded-xl flex items-center justify-center
                    bg-gradient-to-br from-violet-500 to-violet-600 text-white
                    shadow-lg shadow-violet-500/30
                `}>
                    <Clock size={16} />
                </div>
                <div>
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Delay</h3>
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-100">
                        {data.delayMs ? `${data.delayMs / 1000}s` : 'Configurar'}
                    </p>
                </div>
            </div>

            {/* Output Handle */}
            <Handle
                type="source"
                position={Position.Bottom}
                className="w-3 h-3 !bg-violet-500 !border-2 !border-white dark:!border-slate-900"
            />
        </div>
    );
};

export default memo(DelayNode);
