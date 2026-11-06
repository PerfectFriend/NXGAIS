import React from 'react';
import { Lock, Clock, CheckCircle2 } from 'lucide-react';
import { Bip39Identity } from '../../types/nexxus';

interface TreasuryVestingPanelProps {
  identity: Bip39Identity;
  onClaimBatch?: (batchId: string) => void;
  onClaimAllUnlocked?: () => void;
}

export const TreasuryVestingPanel: React.FC<TreasuryVestingPanelProps> = ({ 
  identity, 
  onClaimBatch,
  onClaimAllUnlocked 
}) => {
  const batches = identity.vestingBatches ?? [];
  const totalUnlockedBatchAmount = batches
    .filter(b => b.status === 'unlocked')
    .reduce((s, b) => s + (b.amount ?? 0), 0);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Lock className="w-4 h-4 text-amber-400" />
            График 8-Недельного Вестинга (Anti-Churn Lock)
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Токены созревают 56 дней. Это гарантирует, что нода остаётся в сети 24/7 без штрафов.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {totalUnlockedBatchAmount > 0 && onClaimAllUnlocked && (
            <button
              onClick={onClaimAllUnlocked}
              className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-1 shadow-md cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Вывести всё (+{totalUnlockedBatchAmount.toFixed(1)} $NEXX)
            </button>
          )}
          <span className="text-xs font-mono font-bold text-amber-300 bg-amber-950/60 border border-amber-500/30 px-2.5 py-1 rounded-lg">
            {(identity.lockedNexx8Weeks ?? 0).toFixed(1)} $NEXX в заморозке
          </span>
        </div>
      </div>

      {/* List of Vesting Batches */}
      <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
        {batches.length === 0 ? (
          <div className="p-4 text-center text-xs text-slate-500 font-mono">
            Нет активных траншей вестинга. Выделите хранилище под чужие чанки для получения суточных наград!
          </div>
        ) : (
          batches.map(batch => {
            const progressPct = batch.status === 'unlocked' 
              ? 100 
              : Math.max(4, Math.min(96, Math.round(((56 - (batch.daysRemaining || 56)) / 56) * 100)));

            return (
              <div
                key={batch.id}
                className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs font-mono transition-all hover:border-slate-700"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-sm">+{(batch.amount ?? 0).toFixed(1)} $NEXX</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                        batch.status === 'unlocked' 
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/40' 
                          : 'bg-amber-950 text-amber-400 border border-amber-500/30'
                      }`}>
                        {batch.status === 'unlocked' ? 'Разблокировано (100%)' : `Лок: ${batch.daysRemaining} дн. (${progressPct}%)`}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 truncate">
                      Источник: <strong className="text-slate-300">{batch.sourceNodeName}</strong> · {batch.foreignChunksGb} GB чанков
                    </div>
                  </div>

                  <div className="text-right font-mono text-[11px] flex items-center gap-2 shrink-0">
                    {batch.status === 'unlocked' ? (
                      onClaimBatch ? (
                        <button
                          onClick={() => onClaimBatch(batch.id)}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow transition cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Вывести на баланс
                        </button>
                      ) : (
                        <span className="text-emerald-400 font-bold flex items-center gap-1 justify-end">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Доступно к выводу
                        </span>
                      )
                    ) : (
                      <span className="text-slate-400 flex items-center gap-1 justify-end text-[11px]">
                        <Clock className="w-3.5 h-3.5 text-amber-400" />
                        <span>созреет через <strong className="text-amber-300">{batch.daysRemaining} дн.</strong></span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Maturation Progress Bar */}
                <div className="space-y-1">
                  <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                    <div 
                      className={`h-full transition-all duration-500 ${
                        batch.status === 'unlocked'
                          ? 'bg-gradient-to-r from-emerald-500 to-cyan-400'
                          : 'bg-gradient-to-r from-amber-600 via-amber-500 to-emerald-500'
                      }`}
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-500">
                    <span>День {56 - (batch.daysRemaining || 56)} из 56</span>
                    <span>{progressPct}% созревания</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
