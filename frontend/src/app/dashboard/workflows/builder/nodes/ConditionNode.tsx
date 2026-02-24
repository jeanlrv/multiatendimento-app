import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { GitBranch } from 'lucide-react';
import { NodeData } from '../../types/workflow.types';

const ConditionNode = ({ data, selected }: NodeProps<NodeData>) => {
    return (
        <div className={`
            px-4 py-3 rounded-2xl shadow-xl min-w-[200px]
            bg-white/80 dark:bg-slate-900/80 backdrop-blur-md 
            border-2 transition-all duration-300
            ${selected
                ? 'border-amber-500 shadow-amber-500/20 scale-105'
                : 'border-white/50 dark:border-white/10 hover:border-amber-500/50'}
        `}>
            {/* Input Handle */}
            <Handle
                type="target"
                position={Position.Top}
                className="w-3 h-3 !bg-slate-400 !border-2 !border-white dark:!border-slate-900"
            />

            <div className="flex items-center gap-3 mb-2">
                <div className={`
                    p-2 rounded-xl flex items-center justify-center
                    bg-gradient-to-br from-amber-500 to-amber-600 text-white
                    shadow-lg shadow-amber-500/30
                `}>
                    <GitBranch size={16} />
                </div>
                <div>
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Condição</h3>
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{data.label}</p>
                </div>
            </div>

            {/* Output Handles (True/False) */}
            <div className="flex justify-between mt-3 px-1">
                <div className="relative">
                    <span className="text-[9px] font-black text-emerald-500 uppercase absolute -top-4 left-0">Sim</span>
                    <Handle
                        type="source"
                        position={Position.Bottom}
                        id="true"
                        className="w-3 h-3 !bg-emerald-500 !border-2 !border-white dark:!border-slate-900 !left-2"
                    />
                </div>
                <div className="relative">
                    <span className="text-[9px] font-black text-red-500 uppercase absolute -top-4 right-0">Não</span>
                    <Handle
                        type="source"
                        position={Position.Bottom}
                        id="false"
                        className="w-3 h-3 !bg-red-500 !border-2 !border-white dark:!border-slate-900 !left-auto !right-2"
                    />
                </div>
            </div>
        </div>
    );
};

export default memo(ConditionNode);
