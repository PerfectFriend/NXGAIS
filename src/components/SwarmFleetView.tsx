import React, { useState } from 'react';
import { 
  Network, Plus, ShieldCheck, Activity, 
  Calendar, Cpu, RefreshCw, Play, Pause, Radio, AlertCircle 
} from 'lucide-react';
import { NodeRecord, Bip39Identity, VaultFile } from '../types/nexxus';
import { useSwarm } from '../context/SwarmContext';
import { ClusterMetricsStrip } from './fleet/ClusterMetricsStrip';
import { NodeDeviceCard } from './fleet/NodeDeviceCard';
import { ConnectDeviceModal } from './fleet/ConnectDeviceModal';
import { GrokSimulationLabModal } from './GrokSimulationLabModal';
import { KademliaEngineModal } from './KademliaEngineModal';
import { NetworkRepairModal } from './NetworkRepairModal';
import { SoakTestDashboardModal } from './SoakTestDashboardModal';
import { SwarmHealthDashboardModal } from './SwarmHealthDashboardModal';

export interface SwarmFleetViewProps {
  nodes: NodeRecord[];
  identity: Bip39Identity;
  vaultFiles?: VaultFile[];
  onUpdateFiles?: (files: VaultFile[]) => void;
  onToggleNodeOnline: (nodeId: string) => void;
  onSimulateEmergencyGrace: (nodeId: string) => void;
  onExpireGraceNow: (nodeId: string) => void;
  onAddNewNode: (newNode: Partial<NodeRecord>) => void;
  graceNodeId: string | null;
  graceRemainingSeconds: number | null;
  onOpenHealthDashboard?: () => void;
  isAutoPingActive?: boolean;
  isPingingNow?: boolean;
  lastPingRoundTimestamp?: number | null;
  onToggleAutoPing?: () => void;
  onTriggerManualPing?: () => Promise<void>;
}

function formatRelativePingTime(timestamp?: number | null): string {
  if (!timestamp) return 'Ожидание первого опроса...';
  const diffSec = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (diffSec < 3) return 'Только что';
  if (diffSec < 60) return `${diffSec} сек назад`;
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/**
 * SwarmFleetView orchestrates the decentralized node fleet, Kademlia DHT diagnostics,
 * autonomous self-healing, real-time background availability ping daemon,
 * and emergency offline grace period simulators.
 *
 * @param {SwarmFleetViewProps} props - Component properties and global swarm controllers.
 * @returns {React.ReactElement} The rendered fleet dashboard.
 */
export const SwarmFleetView: React.FC<SwarmFleetViewProps> = (props) => {
  const {
    nodes,
    identity,
    vaultFiles = [],
    onUpdateFiles,
    onToggleNodeOnline,
    onSimulateEmergencyGrace,
    onExpireGraceNow,
    onAddNewNode,
    graceNodeId,
    graceRemainingSeconds,
    onOpenHealthDashboard,
  } = props;

  const swarmContext = useSwarm();
  const isAutoPingActive = props.isAutoPingActive ?? swarmContext.isAutoPingActive;
  const isPingingNow = props.isPingingNow ?? swarmContext.isPingingNow;
  const lastPingRoundTimestamp = props.lastPingRoundTimestamp ?? swarmContext.lastPingRoundTimestamp;
  const toggleAutoPing = props.onToggleAutoPing ?? swarmContext.toggleAutoPing;
  const triggerManualPingRound = props.onTriggerManualPing ?? swarmContext.triggerManualPingRound;

  const [showAddModal, setShowAddModal] = useState(false);
  const [showSimLabModal, setShowSimLabModal] = useState(false);
  const [showKademliaModal, setShowKademliaModal] = useState(false);
  const [showRepairModal, setShowRepairModal] = useState(false);
  const [showSoakModal, setShowSoakModal] = useState(false);
  const [showSwarmHealthModal, setShowSwarmHealthModal] = useState(false);

  const offlineNodes = nodes.filter(n => !n.isOnline);
  const onlineNodes = nodes.filter(n => n.isOnline);
  const avgLatency = onlineNodes.length > 0
    ? Math.round(onlineNodes.reduce((acc, n) => acc + (n.pingLatencyMs || 24), 0) / onlineNodes.length)
    : 0;

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Cluster Overview Header & Actions (shrink-0) */}
      <div className="bg-slate-950/80 border-b border-slate-800 p-2.5 sm:p-4 space-y-2.5 shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-mono px-2 py-0.2 rounded bg-cyan-950 border border-cyan-500/30 text-cyan-400 font-bold uppercase shrink-0">
                BIP-39 Swarm
              </span>
              <span className="text-[11px] text-slate-400 font-mono truncate">
                {identity.masterPublicKey.slice(0, 14)}...
              </span>
            </div>
            <h2 className="text-sm sm:text-base font-bold text-white font-mono mt-0.5 truncate">
              Флот Нод и Устройств
            </h2>
          </div>

          {/* Action Buttons: Horizontal scroll on mobile */}
          <div className="flex items-center gap-2 overflow-x-auto pb-0.5 scrollbar-none shrink-0">
            <button
              id="btn-add-new-node-modal"
              type="button"
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition shadow-md shrink-0 cursor-pointer font-mono"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Подключить устройство</span>
            </button>

            <button
              id="btn-open-kademlia-engine"
              type="button"
              onClick={() => setShowKademliaModal(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-purple-950/70 hover:bg-purple-900/90 text-purple-200 border border-purple-500/40 text-xs font-bold transition shrink-0 cursor-pointer font-mono"
            >
              <Network className="w-3.5 h-3.5 text-purple-400" />
              <span>Kademlia DHT</span>
            </button>

            <button
              id="btn-open-health-dashboard"
              type="button"
              onClick={() => onOpenHealthDashboard?.()}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-cyan-950/70 hover:bg-cyan-900/90 text-cyan-200 border border-cyan-500/40 text-xs font-bold transition shrink-0 cursor-pointer font-mono"
            >
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
              <span>D3 Health</span>
            </button>

            <button
              id="btn-open-repair-modal"
              type="button"
              onClick={() => setShowRepairModal(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-950/70 hover:bg-emerald-900/90 text-emerald-200 border border-emerald-500/40 text-xs font-bold transition shrink-0 cursor-pointer font-mono"
            >
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              <span>Ремонт Чанков</span>
            </button>

            <button
              id="btn-open-soak-modal"
              type="button"
              onClick={() => setShowSoakModal(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 text-xs font-bold transition shrink-0 cursor-pointer font-mono"
            >
              <Calendar className="w-3.5 h-3.5 text-cyan-400" />
              <span>14-Дней Soak</span>
            </button>

            <button
              id="btn-open-swarm-health-modal"
              type="button"
              onClick={() => setShowSwarmHealthModal(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 text-xs font-bold transition shrink-0 cursor-pointer font-mono"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Anti-Outsource</span>
            </button>

            <button
              id="btn-open-grok-sim-lab"
              type="button"
              onClick={() => setShowSimLabModal(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 text-xs font-bold transition shrink-0 cursor-pointer font-mono"
            >
              <Cpu className="w-3.5 h-3.5 text-cyan-400" />
              <span>Grok Sim</span>
            </button>
          </div>
        </div>

        {/* Global Cluster Stats in 4 Compact Cards */}
        <ClusterMetricsStrip nodes={nodes} />

        {/* Real-Time Background Availability Ping Monitor Bar */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 sm:px-3.5 sm:py-2.5 flex flex-wrap items-center justify-between gap-2.5 font-mono text-xs shadow-inner">
          <div className="flex flex-wrap items-center gap-3 min-w-0">
            {/* Live Heartbeat Daemon Indicator */}
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                {isAutoPingActive && (
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    isPingingNow ? 'bg-cyan-400' : 'bg-emerald-400'
                  }`} />
                )}
                <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                  !isAutoPingActive
                    ? 'bg-slate-500'
                    : isPingingNow
                    ? 'bg-cyan-400'
                    : 'bg-emerald-500'
                }`} />
              </span>
              <span className="text-slate-200 font-bold flex items-center gap-1.5 text-[11px] sm:text-xs">
                <Radio className={`w-3.5 h-3.5 ${isAutoPingActive ? 'text-emerald-400' : 'text-slate-500'}`} />
                <span>P2P Ping Daemon</span>
                <span className="text-[10px] text-slate-400 font-normal hidden sm:inline">(5.5s)</span>
              </span>
            </div>

            <div className="h-3 w-px bg-slate-800 hidden sm:block" />

            {/* In-Flight or Last Ping Status */}
            <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
              {isPingingNow ? (
                <span className="text-cyan-300 flex items-center gap-1 animate-pulse">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  <span>Опрос активен...</span>
                </span>
              ) : (
                <span>Последний опрос: <strong className="text-slate-200">{formatRelativePingTime(lastPingRoundTimestamp)}</strong></span>
              )}
            </div>

            <div className="h-3 w-px bg-slate-800 hidden md:block" />

            {/* Average Latency */}
            <div className="text-[11px] text-slate-400 hidden md:flex items-center gap-1">
              <span>Ср. RTT:</span>
              <strong className="text-cyan-400 font-bold">{avgLatency} ms</strong>
            </div>

            {/* Offline Alert Badge (if any node is down) */}
            {offlineNodes.length > 0 && (
              <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-red-950/80 border border-red-500/70 text-red-300 font-bold text-[11px] animate-pulse shadow-[0_0_12px_rgba(239,68,68,0.3)]">
                <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                <span>
                  {offlineNodes.length} {offlineNodes.length === 1 ? 'нода оффлайн!' : 'ноды оффлайн!'}
                </span>
              </div>
            )}
          </div>

          {/* Ping Controls: Pause/Play & Manual Trigger */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              id="btn-toggle-auto-ping"
              type="button"
              onClick={toggleAutoPing}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-bold transition cursor-pointer ${
                isAutoPingActive
                  ? 'bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 border-slate-700'
                  : 'bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 border-emerald-500/40'
              }`}
              title={isAutoPingActive ? 'Приостановить фоновый опрос' : 'Запустить фоновый опрос'}
            >
              {isAutoPingActive ? (
                <>
                  <Pause className="w-3 h-3 text-amber-400" />
                  <span>Пауза</span>
                </>
              ) : (
                <>
                  <Play className="w-3 h-3 text-emerald-400" />
                  <span>Старт</span>
                </>
              )}
            </button>

            <button
              id="btn-manual-ping-now"
              type="button"
              disabled={isPingingNow}
              onClick={() => triggerManualPingRound()}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-950/80 hover:bg-cyan-900/80 text-cyan-200 border border-cyan-500/40 text-[11px] font-bold transition cursor-pointer disabled:opacity-50"
              title="Выполнить внеочередной опрос нод роя"
            >
              <RefreshCw className={`w-3 h-3 text-cyan-400 ${isPingingNow ? 'animate-spin' : ''}`} />
              <span>Опросить рой</span>
            </button>
          </div>
        </div>
      </div>

      {/* Dedicated Scrollable Device Nodes List */}
      <div className="flex-1 min-h-0 overflow-y-auto p-2.5 sm:p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {nodes.map(node => (
            <NodeDeviceCard
              key={node.id}
              node={node}
              isGraceActive={node.id === graceNodeId && graceRemainingSeconds !== null}
              graceRemainingSeconds={graceRemainingSeconds}
              onSimulateEmergencyGrace={onSimulateEmergencyGrace}
              onToggleNodeOnline={onToggleNodeOnline}
              onExpireGraceNow={onExpireGraceNow}
            />
          ))}
        </div>
      </div>

      {/* Add Node Pairing Modal */}
      <ConnectDeviceModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        masterPublicKey={identity.masterPublicKey}
        onAddNewNode={onAddNewNode}
      />

      {/* Advanced Lab Modals */}
      <KademliaEngineModal
        isOpen={showKademliaModal}
        onClose={() => setShowKademliaModal(false)}
      />

      <NetworkRepairModal
        isOpen={showRepairModal}
        onClose={() => setShowRepairModal(false)}
        nodes={nodes}
        vaultFiles={vaultFiles}
        onUpdateFiles={onUpdateFiles || (() => {})}
      />

      <SoakTestDashboardModal
        isOpen={showSoakModal}
        onClose={() => setShowSoakModal(false)}
      />

      <SwarmHealthDashboardModal
        isOpen={showSwarmHealthModal}
        onClose={() => setShowSwarmHealthModal(false)}
        nodes={nodes}
      />

      <GrokSimulationLabModal
        isOpen={showSimLabModal}
        onClose={() => setShowSimLabModal(false)}
      />
    </div>
  );
};
