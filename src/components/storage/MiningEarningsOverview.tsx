import React from 'react';
import { Zap, ShieldCheck, Clock, TrendingUp } from 'lucide-react';

export interface MiningEarningsOverviewProps {
  dailyEstimatedNexxEarnings: number;
  monthlyEstimatedNexxEarnings: number;
  miningActuallyUsedGb: number;
  personalVaultQuotaGb: number;
  unlockedNexx: number;
  lockedNexx8Weeks: number;
  onOpenVestingModal?: () => void;
}

/**
 * MiningEarningsOverview displays the real-time proof-of-retrievability yield summary,
 * personal barter quota, and claimable vesting batches.
 *
 * @param {MiningEarningsOverviewProps} props - Component properties and token amounts.
 * @returns {React.ReactElement} The rendered overview cards.
 */
export const MiningEarningsOverview: React.FC<MiningEarningsOverviewProps> = ({
  dailyEstimatedNexxEarnings,
  monthlyEstimatedNexxEarnings,
  miningActuallyUsedGb,
  personalVaultQuotaGb,
  unlockedNexx,
  lockedNexx8Weeks,
  onOpenVestingModal,
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-2.5 sm:p-4 shrink-0 font-mono">
      {/* Daily Mining Yield */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-emerald-400" />
            Доход от хранения (PoR)
          </span>
          <span className="text-[10px] text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-500/30">
            1.25 NEXX/GB
          </span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-xl sm:text-2xl font-black text-emerald-400">
            +{dailyEstimatedNexxEarnings}
          </span>
          <span className="text-xs text-slate-400">NEXX / день</span>
        </div>
        <div className="text-[10px] text-slate-400">
          Прогноз за 30 дней: ~<strong>{monthlyEstimatedNexxEarnings}</strong> NEXX (за {miningActuallyUsedGb} ГБ чужих чанков)
        </div>
      </div>

      {/* Barter Quota */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
            Квота Неуничтожимого Сейфа
          </span>
          <span className="text-[10px] text-purple-400 bg-purple-950/60 px-1.5 py-0.5 rounded border border-purple-500/30">
            Бартер 16 ГБ
          </span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-xl sm:text-2xl font-black text-purple-400">
            {personalVaultQuotaGb}
          </span>
          <span className="text-xs text-slate-400">ГБ доступно</span>
        </div>
        <div className="text-[10px] text-slate-400">
          Сквозное шифрование ChaCha20-Poly1305 + 6× кворум репликации
        </div>
      </div>

      {/* Vesting Settlement */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            Вестинг и Вывод (8 недель)
          </span>
          <button
            type="button"
            onClick={onOpenVestingModal}
            className="text-[10px] text-amber-300 hover:text-white underline cursor-pointer"
          >
            График
          </button>
        </div>
        <div className="flex items-baseline justify-between">
          <div>
            <span className="text-lg font-bold text-white">{unlockedNexx}</span>
            <span className="text-[10px] text-emerald-400 ml-1 font-bold">Готово</span>
          </div>
          <div className="text-right">
            <span className="text-sm font-semibold text-slate-400">{lockedNexx8Weeks}</span>
            <span className="text-[10px] text-amber-400 ml-1">Вестинг</span>
          </div>
        </div>
        <div className="text-[10px] text-slate-400">
          Награда начисляется еженедельными батчами с постепенной разблокировкой
        </div>
      </div>
    </div>
  );
};
