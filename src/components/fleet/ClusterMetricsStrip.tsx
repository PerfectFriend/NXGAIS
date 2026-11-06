import React from 'react';
import { NodeRecord } from '../../types/nexxus';

export interface ClusterMetricsStripProps {
  nodes: NodeRecord[];
}

/**
 * ClusterMetricsStrip displays the 4 essential cluster-level telemetry indicators:
 * active nodes count, aggregate capacity, private 1/8 barter quota, and reliability penalties.
 *
 * @param {ClusterMetricsStripProps} props - Component properties with nodes list.
 * @returns {React.ReactElement} The rendered metrics grid.
 */
export const ClusterMetricsStrip: React.FC<ClusterMetricsStripProps> = ({ nodes }) => {
  const onlineCount = nodes.filter(n => n.isOnline).length;
  const totalFleetStorage = nodes.reduce((sum, n) => sum + (n.isOnline ? n.totalStorageAllocatedGb : 0), 0);
  const totalVaultBonus = nodes.reduce((sum, n) => sum + (n.isOnline ? n.personalVaultQuotaGb : 0), 0);
  const totalPenalties = nodes.reduce((sum, n) => sum + n.penaltiesCount, 0);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
      <div className="bg-slate-900 p-2 sm:p-2.5 rounded-xl border border-slate-800">
        <span className="text-[10px] text-slate-400">НОДЫ ОНЛАЙН:</span>
        <div className="text-sm sm:text-base font-black text-white mt-0.5">
          {onlineCount} <span className="text-[10px] font-normal text-slate-400">/ {nodes.length}</span>
        </div>
      </div>

      <div className="bg-slate-900 p-2 sm:p-2.5 rounded-xl border border-slate-800">
        <span className="text-[10px] text-slate-400">ЕМКОСТЬ СЕТИ:</span>
        <div className="text-sm sm:text-base font-black text-cyan-400 mt-0.5">
          {totalFleetStorage} GB
        </div>
      </div>

      <div className="bg-slate-900 p-2 sm:p-2.5 rounded-xl border border-slate-800">
        <span className="text-[10px] text-slate-400">КВОТА СЕЙФА 1/8:</span>
        <div className="text-sm sm:text-base font-black text-purple-400 mt-0.5">
          {totalVaultBonus.toFixed(1)} GB
        </div>
      </div>

      <div className="bg-slate-900 p-2 sm:p-2.5 rounded-xl border border-slate-800">
        <span className="text-[10px] text-slate-400">ШТРАФЫ ЗА СБОИ:</span>
        <div className="text-sm sm:text-base font-black text-amber-400 mt-0.5">
          {totalPenalties}
        </div>
      </div>
    </div>
  );
};
