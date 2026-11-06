import React from 'react';
import { 
  Smartphone, Laptop, AlertTriangle, ShieldCheck, 
  PowerOff, Power, Activity, Wifi, Clock, SignalZero 
} from 'lucide-react';
import { NodeRecord } from '../../types/nexxus';

export interface NodeDeviceCardProps {
  node: NodeRecord;
  isGraceActive: boolean;
  graceRemainingSeconds: number | null;
  onSimulateEmergencyGrace: (nodeId: string) => void;
  onToggleNodeOnline: (nodeId: string) => void;
  onExpireGraceNow: (nodeId: string) => void;
}

function formatCountdown(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function formatPingTime(timestamp?: number): string {
  if (!timestamp) return 'Не опрашивалась';
  const diffSec = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (diffSec < 3) return 'Только что';
  if (diffSec < 60) return `${diffSec} сек назад`;
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/**
 * NodeDeviceCard displays an individual peer node in the cluster, visualizing
 * device type, Onion v3 address, real-time background ping status, battery,
 * and prominent pulsing alerts for offline availability states.
 *
 * @param {NodeDeviceCardProps} props - Component properties and actions.
 * @returns {React.ReactElement} The rendered node card.
 */
export const NodeDeviceCard: React.FC<NodeDeviceCardProps> = ({
  node,
  isGraceActive,
  graceRemainingSeconds,
  onSimulateEmergencyGrace,
  onToggleNodeOnline,
  onExpireGraceNow,
}) => {
  const isOffline = !node.isOnline;
  const isDegraded = node.isOnline && node.pingStatus === 'degraded';

  return (
    <div
      className={`p-5 rounded-2xl border transition-all duration-300 shadow-lg space-y-4 relative overflow-hidden ${
        isOffline
          ? 'bg-red-950/30 border-red-500/80 shadow-[0_0_35px_-4px_rgba(239,68,68,0.55)] ring-2 ring-red-500/40 animate-pulse duration-[2500ms]'
          : node.isCurrentDevice
          ? 'bg-slate-900 border-emerald-500/40 shadow-emerald-950/20'
          : isDegraded
          ? 'bg-slate-900 border-amber-500/50 shadow-amber-950/20'
          : 'bg-slate-900 border-slate-800'
      }`}
    >
      {/* Offline Ambient Top Glow Bar */}
      {isOffline && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-600 via-amber-500 to-red-600 animate-pulse" />
      )}

      {/* Node Title & Live Ping Status Badge */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`p-3 rounded-xl border shrink-0 transition-colors ${
              isOffline
                ? 'bg-red-950/70 border-red-500/50 text-red-300 animate-pulse'
                : 'bg-slate-950 border-slate-800 text-cyan-400'
            }`}
          >
            {node.deviceType === 'android' ? <Smartphone className="w-6 h-6" /> : <Laptop className="w-6 h-6" />}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-white font-mono truncate">{node.name}</h3>
              {node.isCurrentDevice && (
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-500/30 font-semibold font-mono shrink-0">
                  Хост
                </span>
              )}
            </div>
            <div className="text-xs text-slate-400 font-mono truncate">{node.model}</div>
          </div>
        </div>

        {/* Live Ping Beacon Status */}
        <div className="shrink-0">
          {isOffline ? (
            <span className="text-[11px] font-mono px-2.5 py-1 rounded-md font-bold flex items-center gap-2 bg-red-950 text-red-300 border border-red-500/60 shadow-[0_0_15px_rgba(239,68,68,0.4)]">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-90" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
              </span>
              <span>ОФФЛАЙН (СБОЙ)</span>
            </span>
          ) : isDegraded ? (
            <span className="text-[11px] font-mono px-2.5 py-1 rounded-md font-bold flex items-center gap-1.5 bg-amber-950/70 text-amber-300 border border-amber-500/40">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span>ДЖИТТЕР · {node.pingLatencyMs} ms</span>
            </span>
          ) : (
            <span className="text-[11px] font-mono px-2.5 py-1 rounded-md font-bold flex items-center gap-1.5 bg-emerald-950/70 text-emerald-400 border border-emerald-500/30">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>ОНЛАЙН · {node.pingLatencyMs || 24} ms</span>
            </span>
          )}
        </div>
      </div>

      {/* Real-time Background Ping Diagnostics Strip */}
      <div
        className={`px-3 py-2 rounded-xl border text-xs font-mono flex items-center justify-between gap-2 ${
          isOffline
            ? 'bg-red-950/40 border-red-500/40 text-red-200'
            : 'bg-slate-950 border-slate-800/90 text-slate-300'
        }`}
      >
        <div className="flex items-center gap-1.5 truncate">
          <Activity
            className={`w-3.5 h-3.5 shrink-0 ${
              isOffline ? 'text-red-400 animate-pulse' : 'text-emerald-400'
            }`}
          />
          <span className="text-slate-400">RTT пинга:</span>
          <strong className={isOffline ? 'text-red-400 font-black' : 'text-emerald-400 font-bold'}>
            {isOffline ? 'Таймаут (0 ms)' : `${node.pingLatencyMs || 24} мс`}
          </strong>
        </div>

        <div className="flex items-center gap-1 text-[11px] text-slate-400 shrink-0">
          <Clock className="w-3 h-3 text-slate-500" />
          <span>{formatPingTime(node.lastPingTimestamp)}</span>
        </div>
      </div>

      {/* Distinct Pulsing Offline Notification Alert Banner */}
      {isOffline && (
        <div className="p-3 rounded-xl bg-red-950/60 border border-red-500/60 text-xs text-red-200 space-y-1.5 font-mono shadow-md animate-pulse">
          <div className="flex items-center gap-2 font-bold text-red-300">
            <SignalZero className="w-4 h-4 text-red-400 animate-bounce" />
            <span>СИГНАЛ ПОТЕРЯН: Нода не отвечает на фоновые пинги роя!</span>
          </div>
          <p className="text-[11px] text-red-200/90 leading-relaxed">
            Автоматический мониторинг зафиксировал отключение (сбоев пинга: {node.consecutiveFailedPings || 1}).
            Для предотвращения штрафа SLA запустите устройство или активируйте аварийный льготный период.
          </p>
        </div>
      )}

      {/* Grace Period Alert on the node if triggered */}
      {isGraceActive && graceRemainingSeconds !== null && (
        <div className="p-3 rounded-xl bg-amber-950/70 border border-amber-500/50 text-xs text-amber-200 space-y-2 font-mono">
          <div className="flex items-center justify-between font-bold">
            <span className="flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              АВАРИЙНЫЙ ЛЬГОТНЫЙ ПЕРИОД:
            </span>
            <span className="text-white text-sm bg-black/50 px-2 py-0.5 rounded">
              {formatCountdown(graceRemainingSeconds)}
            </span>
          </div>
          <p className="text-[11px] text-amber-200/90 leading-relaxed">
            У вас есть 1 час на включение ноды. При истечении таймера нода будет оштрафована (минус к репутации), а её чанки будут перераспределены на топовые ноды.
          </p>
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => onExpireGraceNow(node.id)}
              className="px-2.5 py-1 rounded bg-red-900/60 hover:bg-red-800 text-[11px] text-red-200 border border-red-500/30 font-semibold transition cursor-pointer"
            >
              Сымитировать истечение 1 часа (Штраф + Эвакуация чанков)
            </button>
          </div>
        </div>
      )}

      {/* Storage & 1/8 Quota Grid */}
      <div className="grid grid-cols-2 gap-2 text-xs bg-slate-950 p-3 rounded-xl border border-slate-800 font-mono">
        <div>
          <span className="text-slate-400">База 16GB (Секреты):</span>
          <div className="font-bold text-purple-400">2.0 GB Неуничтожимый Vault</div>
        </div>
        <div>
          <span className="text-slate-400">Чанки расширения ($NEXX):</span>
          <div className="font-bold text-emerald-400">
            {node.actualForeignChunksStoredGb || 0} GB ({node.dailyEstimatedNexxEarnings || 0} $NEXX/дн)
          </div>
        </div>
      </div>

      {/* Reputation & Streak */}
      <div className="flex items-center justify-between text-xs font-mono text-slate-300">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>
            Рейтинг: <strong className="text-white">{node.reputationScore}</strong>
          </span>
        </div>
        <div>
          <span>
            Стрик без штрафов:{' '}
            <strong className="text-emerald-400">{node.consecutiveDaysWithoutPenalty}/30 дн.</strong>
          </span>
        </div>
      </div>

      {/* Action Controls & Emergency Simulation Button */}
      <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
        <div className="text-[11px] font-mono text-slate-500 truncate max-w-[200px]">
          {node.onionAddress}
        </div>

        <div className="flex items-center gap-2">
          {node.isOnline ? (
            <button
              type="button"
              onClick={() => onSimulateEmergencyGrace(node.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black hover:bg-red-950/80 text-red-400 border border-red-800 text-xs font-mono font-semibold transition cursor-pointer"
              title="Имитировать отключение питания или сбой Wi-Fi"
            >
              <PowerOff className="w-3.5 h-3.5 text-amber-500" />
              <span>Инициировать аварийный отказ</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onToggleNodeOnline(node.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition cursor-pointer font-mono"
            >
              <Power className="w-3.5 h-3.5" />
              <span>Вернуть в сеть (Восстановить пинг)</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
