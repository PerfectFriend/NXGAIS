import React, { useState, useEffect } from 'react';
import { Activity, ShieldCheck, RefreshCw, AlertTriangle, ArrowRight, Gauge, Layers, CheckCircle2, Play, HardDrive, Lock } from 'lucide-react';
import { auditAndRepairChunks, loadRepairEngineState, RealRepairEvent, RepairEngineState } from '../utils/realRepairEngine';
import { VaultFile, NodeRecord } from '../types/nexxus';

interface NetworkRepairModalProps {
  isOpen: boolean;
  onClose: () => void;
  vaultFiles?: VaultFile[];
  nodes?: NodeRecord[];
  onUpdateFiles?: (files: VaultFile[]) => void;
}

export const NetworkRepairModal: React.FC<NetworkRepairModalProps> = ({
  isOpen,
  onClose,
  vaultFiles = [],
  nodes = [],
  onUpdateFiles,
}) => {
  const [repairState, setRepairState] = useState<RepairEngineState>(loadRepairEngineState);
  const [isExecutingRepair, setIsExecutingRepair] = useState(false);
  const [lastActionMessage, setLastActionMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setRepairState(loadRepairEngineState());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const maxDailyQuotaMb = repairState.dailyQuotaLimitBytes / (1024 * 1024);
  const dailyQuotaUsedMb = +(repairState.dailyQuotaUsedBytes / (1024 * 1024)).toFixed(2);
  const quotaPercent = Math.min(100, Math.round((repairState.dailyQuotaUsedBytes / repairState.dailyQuotaLimitBytes) * 100));

  // Count chunks needing repair across all vault files
  const onlineNodeIds = new Set(nodes.filter(n => n.isOnline).map(n => n.id));
  let totalDegradedChunksCount = 0;
  for (const file of vaultFiles) {
    for (const chunk of file.chunks) {
      const activeCount = chunk.replicaNodes.filter(id => onlineNodeIds.has(id)).length;
      const targetRF = file.storageTier === 'cold_archive_rf4' ? 4 : 6;
      if (activeCount < targetRF) {
        totalDegradedChunksCount++;
      }
    }
  }

  const handleExecuteRealRepair = async () => {
    if (vaultFiles.length === 0) {
      setLastActionMessage('В вашем сейфе пока нет загруженных файлов для проверки.');
      return;
    }

    setIsExecutingRepair(true);
    setLastActionMessage(null);

    try {
      let updatedFiles = [...vaultFiles];
      let totalRepairedInRun = 0;

      for (let i = 0; i < updatedFiles.length; i++) {
        const file = updatedFiles[i];
        const res = await auditAndRepairChunks(file.chunks, nodes, file.storageTier);
        if (res.repairedEvents.length > 0) {
          totalRepairedInRun += res.repairedEvents.filter(e => e.status === 'SUCCESS').length;
          updatedFiles[i] = {
            ...file,
            chunks: res.updatedChunks,
          };
        }
      }

      if (onUpdateFiles) {
        onUpdateFiles(updatedFiles);
      }

      const refreshed = loadRepairEngineState();
      setRepairState(refreshed);

      if (totalRepairedInRun > 0) {
        setLastActionMessage(`Успешно восстановлено ${totalRepairedInRun} чанков с соблюдением суточного лимита трафика.`);
      } else if (totalDegradedChunksCount === 0) {
        setLastActionMessage('Все чанки в сейфе уже обладают 100% избыточностью на активных узлах сети.');
      } else {
        setLastActionMessage('Проверка завершена. Обратите внимание на статус событий в журнале ниже.');
      }
    } catch (err: any) {
      setLastActionMessage(`Ошибка аудита: ${err?.message || String(err)}`);
    } finally {
      setIsExecutingRepair(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-950 text-emerald-400 border border-emerald-500/30">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Сетевой Ремонт Чанков & Rate-Limiter (WS4)
                <span className="px-2 py-0.5 rounded bg-emerald-950 border border-emerald-600 text-emerald-400 text-[10px] font-mono">LIVE ENGINE</span>
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                Реальный аудит реплика-сета, регенерация 16KB чанков и защита трафика донора
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-sm font-mono px-2.5 py-1 rounded bg-slate-800 cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="overflow-y-auto space-y-4 pr-1 text-xs">
          {/* Rate-limiter budget gauge */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Gauge className="w-4 h-4 text-emerald-400" />
                <span className="font-bold text-slate-200 font-mono">Суточный лимит трафика ремонта ноды:</span>
              </div>
              <span className="font-mono text-xs font-bold text-emerald-400">
                {dailyQuotaUsedMb} / {maxDailyQuotaMb} МБ ({quotaPercent}%)
              </span>
            </div>

            <div className="w-full bg-slate-900 h-2.5 rounded-full overflow-hidden border border-slate-800">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  quotaPercent > 80 ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${quotaPercent}%` }}
              />
            </div>

            <div className="flex justify-between text-[11px] text-slate-400 font-mono">
              <span>Всего проверено чанков: <strong className="text-white">{repairState.totalChunksAudited}</strong></span>
              <span>Регенерировано: <strong className="text-emerald-300">{repairState.repairedChunksCount}</strong></span>
            </div>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              * Защита от бесконечных циклов репликации (Rate-Limiting). При падении пиров устройство отдаёт не более 12.5 МБ в сутки, предотвращая выгорание мобильного тарифа.
            </p>
          </div>

          {/* Trigger real repair execution */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950 border border-slate-800">
            <div>
              <div className="font-bold text-white flex items-center gap-2">
                <span>Аудит и репликация повреждённых чанков</span>
                {totalDegradedChunksCount > 0 ? (
                  <span className="px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-500/30 text-[10px] font-mono">
                    Требуют ремонта: {totalDegradedChunksCount}
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-500/30 text-[10px] font-mono">
                    Все реплики в норме
                  </span>
                )}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Проверяет кворум узлов в сейфе, считывает бинарные чанки из IndexedDB и перенаправляет на новые онлайн-ноды.
              </div>
            </div>

            <button
              disabled={isExecutingRepair || dailyQuotaUsedMb >= maxDailyQuotaMb}
              onClick={handleExecuteRealRepair}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-mono text-xs font-bold transition shadow-lg shadow-emerald-950/40 cursor-pointer shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isExecutingRepair ? 'animate-spin' : ''}`} />
              <span>{isExecutingRepair ? 'Ремонт...' : 'Запустить аудит и ремонт'}</span>
            </button>
          </div>

          {lastActionMessage && (
            <div className="p-3 rounded-xl bg-slate-950 border border-emerald-500/30 text-emerald-300 text-xs font-mono flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>{lastActionMessage}</span>
            </div>
          )}

          {/* Repair Events Stream */}
          <div className="space-y-2">
            <div className="font-semibold text-slate-300 flex items-center gap-1.5 font-mono">
              <Layers className="w-4 h-4 text-cyan-400" />
              <span>Журнал реальных сетевых ремонтов (IndexedDB + Kademlia):</span>
            </div>

            <div className="space-y-2">
              {repairState.repairHistory.length === 0 ? (
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-center text-slate-500 font-mono text-xs">
                  История ремонтов пуста. Нажмите «Запустить аудит и ремонт» для сканирования реплика-сета.
                </div>
              ) : (
                repairState.repairHistory.map((log) => (
                  <div key={log.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 font-mono text-[11px] space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-200">{log.chunkId}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                        log.status === 'SUCCESS' ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/30' : 
                        log.status === 'RATE_LIMITED' ? 'bg-amber-950 text-amber-300 border border-amber-500/30' :
                        'bg-red-950 text-red-300 border border-red-500/30'
                      }`}>
                        {log.status === 'SUCCESS' ? 'ВОССТАНОВЛЕН (16KB)' : log.status}
                      </span>
                    </div>

                    <div className="text-[10px] text-slate-400 flex items-center gap-1.5">
                      <span className="text-red-400 line-through">{log.lostReplicaNodeId}</span>
                      <ArrowRight className="w-3 h-3 text-slate-600 shrink-0" />
                      <span className="text-cyan-300">{log.electedCoordinatorNodeId}</span>
                      <ArrowRight className="w-3 h-3 text-slate-600 shrink-0" />
                      <span className="text-emerald-300 font-bold">{log.targetNewNodeId}</span>
                    </div>

                    <div className="text-[10px] text-slate-500 flex items-center justify-between pt-0.5">
                      <span>Хэш: {log.verifiedHash.slice(0, 16)}...</span>
                      <span>{log.durationMs} ms • {log.bytesTransferred} bytes</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-500 font-mono flex items-center justify-between shrink-0">
          <span>* WS4 Live: Replica-set auto-heal, Merkle check, rate-limited</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold transition cursor-pointer"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};

