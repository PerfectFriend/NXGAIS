import React from 'react';
import { 
  Award, ShieldAlert, CheckCircle2, ShieldCheck, 
  RefreshCw, FileCheck, Coins, Shield
} from 'lucide-react';
import { Bip39Identity, AuditorNftMandate, NodeRecord } from '../../types/nexxus';

interface AuditorCouncilPanelProps {
  identity: Bip39Identity;
  nodes: NodeRecord[];
  auditorMandates: AuditorNftMandate[];
  isAuditingActive: boolean;
  auditSuccessBanner: string | null;
  onPerformAuditChallenge: () => void;
  onOpenAsnModal: () => void;
  onOpenTonModal: () => void;
}

export const AuditorCouncilPanel: React.FC<AuditorCouncilPanelProps> = ({
  identity,
  nodes,
  auditorMandates,
  isAuditingActive,
  auditSuccessBanner,
  onPerformAuditChallenge,
  onOpenAsnModal,
  onOpenTonModal,
}) => {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-400" />
            Комитет Аудиторов Эпохи (PoUSS + Proof-of-Storage-Bond)
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            50% репутационные хранители (PoUSS: <span className="font-mono text-cyan-300 font-semibold">PoR × log₂(Stake) × Uptime</span>) + 50% VRF-лотерея с ненулевым залогом (Bond в TON/USDT) для защиты от захвата эмиссии.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-xs font-mono font-bold text-amber-300 bg-amber-950/70 border border-amber-500/40 px-2.5 py-1 rounded-lg">
            Эпоха #{identity.treasury?.epochNumber ?? 1} • PoUSS Консенсус
          </span>
          <span className="text-[10px] font-mono text-slate-400">
            Кворум: 11/20 BLS • Окно: 24–48ч
          </span>
        </div>
      </div>

      {/* Governance & Contracts Quick Actions */}
      <div className="flex flex-wrap items-center gap-2.5 pt-0.5 font-mono text-xs">
        <button
          onClick={onOpenAsnModal}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-950/70 hover:bg-cyan-900 text-cyan-300 border border-cyan-500/40 font-bold transition cursor-pointer"
        >
          <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
          <span>ASN-Аттестация VOPRF</span>
        </button>

        <button
          onClick={onOpenTonModal}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-950/70 hover:bg-blue-900 text-blue-300 border border-blue-500/40 font-bold transition cursor-pointer"
        >
          <Coins className="w-3.5 h-3.5 text-blue-400" />
          <span>TON Контракты & Залоговый Триггер</span>
        </button>
      </div>

      {/* Composite Mint Trigger Status Banner */}
      <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
        <div className="flex items-center justify-between text-xs font-bold text-white">
          <span className="flex items-center gap-1.5">
            <ShieldAlert className="w-4 h-4 text-amber-400" />
            Статус Составного Триггера Эмиссии (Манифест v2):
          </span>
          <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-500/40">
            Фаза Genesis: Минт выключен (IOU Режим)
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono pt-1">
          <div className="bg-slate-900/90 p-2 rounded border border-slate-800">
            <div className="text-slate-500 text-[10px]">Verified ASN:</div>
            <div className="text-emerald-400 font-bold">48 / 40 AS (OK)</div>
          </div>
          <div className="bg-slate-900/90 p-2 rounded border border-slate-800">
            <div className="text-slate-500 text-[10px]">Median Uptime:</div>
            <div className="text-emerald-400 font-bold">24d / 21d (OK)</div>
          </div>
          <div className="bg-slate-900/90 p-2 rounded border border-slate-800">
            <div className="text-slate-500 text-[10px]">Total Bond:</div>
            <div className="text-amber-300 font-bold">$42,500 USDT</div>
          </div>
          <div className="bg-slate-900/90 p-2 rounded border border-slate-800">
            <div className="text-slate-500 text-[10px]">Sybil Score τ:</div>
            <div className="text-emerald-400 font-bold">0.06 &lt; 0.12 (OK)</div>
          </div>
        </div>
      </div>

      {/* Audit Success Banner */}
      {auditSuccessBanner && (
        <div className="p-3 rounded-xl bg-emerald-950/70 border border-emerald-500/50 text-emerald-300 text-xs font-bold flex items-center gap-2 font-mono">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{auditSuccessBanner}</span>
        </div>
      )}

      {/* Auditor NFT Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {auditorMandates.map(mandate => {
          const isUserNode = mandate.nodeId === nodes[0]?.id || mandate.id === 'auditor-mandate-1';
          return (
            <div
              key={mandate.id}
              className={`p-3.5 rounded-xl border transition relative space-y-2.5 ${
                isUserNode
                  ? 'bg-amber-950/30 border-amber-500/60 shadow-lg shadow-amber-950/20'
                  : 'bg-slate-950 border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase bg-slate-900 border border-slate-700 text-slate-300">
                  NFT #{mandate.tokenId}
                </span>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase ${
                  isUserNode ? 'bg-amber-900 text-amber-200 border border-amber-500/50' : 'bg-slate-800 text-slate-400'
                }`}>
                  Топ {mandate.holderRank}% Стейка
                </span>
              </div>

              <div>
                <div className="text-xs font-bold text-white truncate">{mandate.nodeName}</div>
                <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                  Стейк: <strong className="text-amber-400">{mandate.stakedNexxAmount.toLocaleString()} $NEXX</strong>
                </div>
              </div>

              <div className="space-y-1 text-[10px] font-mono bg-slate-900/80 p-2 rounded-lg border border-slate-850">
                <div className="flex justify-between text-slate-400">
                  <span>Сессионный BLS-ключ:</span>
                  <span className="text-slate-200 truncate max-w-[110px]">{mandate.sessionSessionKeyEd25519}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Проверено челленджей:</span>
                  <span className="text-cyan-300 font-bold">{mandate.completedAuditsCount} / {mandate.totalChallengesAssigned}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Награда за аудит:</span>
                  <span className="text-emerald-400 font-bold">+{mandate.bountyEarnedNexx.toFixed(2)} $NEXX</span>
                </div>
              </div>

              {isUserNode && (
                <button
                  disabled={isAuditingActive}
                  onClick={onPerformAuditChallenge}
                  className="w-full py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-amber-300 font-mono text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                >
                  {isAuditingActive ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Верификация Merkle PoR...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                      <span>Исполнить аудит суточной эпохи</span>
                    </>
                  )}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400 space-y-1 font-mono">
        <div className="font-bold text-slate-200 flex items-center gap-1.5">
          <FileCheck className="w-3.5 h-3.5 text-cyan-400" />
          <span>Механика консенсуса аудиторов:</span>
        </div>
        <p className="leading-relaxed text-slate-400">
          Аудиторы оффчейн опрашивают ноды случайными срезами Merkle-деревьев (PoR). 
          При сборе BLS-мультиподписи (Threshold $M$ из $N$) в смарт-контракт отправляется единственная суточная транзакция, которая выпускает дневную эмиссию и начисляет аудиторам <strong>5% комиссию за аудит</strong>.
        </p>
      </div>
    </div>
  );
};
