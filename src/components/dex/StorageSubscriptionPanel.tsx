import React from 'react';
import { Sparkles, CheckCircle2, ShieldCheck } from 'lucide-react';
import { Bip39Identity } from '../../types/nexxus';
import { SUBSCRIPTION_DAILY_COST_PER_GB } from '../../utils/storageManager';

export interface StoragePlan {
  id: string;
  name: string;
  nexxCost: number;
  gb: number;
  label: string;
  popular?: boolean;
}

interface StorageSubscriptionPanelProps {
  identity: Bip39Identity;
  currentPrice: number;
  plans: StoragePlan[];
  subscribedPlanSuccess: string | null;
  onSubscribe: (plan: StoragePlan) => void;
}

export const StorageSubscriptionPanel: React.FC<StorageSubscriptionPanelProps> = ({
  identity,
  currentPrice,
  plans,
  subscribedPlanSuccess,
  onSubscribe,
}) => {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg space-y-4">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-400" />
            Расширение Криптооблака за $NEXX
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Если 2 GB базового хранилища не хватает, приобретите дополнительное пространство.
          </p>
        </div>
        <span className="text-xs font-mono font-bold text-purple-400 bg-purple-950 px-2.5 py-1 rounded-lg border border-purple-500/30">
          +{identity.subscribedStorageGb} GB Активно
        </span>
      </div>

      {/* Success Banner */}
      {subscribedPlanSuccess && (
        <div className="p-3 rounded-xl bg-emerald-950/70 border border-emerald-500/50 text-emerald-300 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>{subscribedPlanSuccess}</span>
        </div>
      )}

      {/* Tariff selection notice according to Manifesto v2 */}
      <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-300 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="font-bold text-white flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            Стандарт надежности по Манифесту v2:
          </span>
          <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-500/40">
            Горячий тариф: RF = 6× (По умолчанию)
          </span>
        </div>
        <p className="text-slate-400 leading-relaxed text-[10.5px]">
          Все тарифные планы используют 6-кратное дублирование данных (RF=6×) и Network-Driven Repair.
          Архивный тариф RF=4× доступен только как explicit opt-in со скидкой 30%, но с вероятностью деградации ~2–3% в год из-за специфики аптайма мобильных узлов.
        </p>
      </div>

      {/* Plans list */}
      <div className="space-y-3">
        {plans.map(plan => (
          <div
            key={plan.id}
            className={`p-3.5 rounded-xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
              plan.popular
                ? 'bg-purple-950/30 border-purple-500/50 shadow-md shadow-purple-950/30'
                : 'bg-slate-950 border-slate-800'
            }`}
          >
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-white">{plan.name}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded font-mono uppercase font-bold ${
                  plan.popular ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-300'
                }`}>
                  {plan.label}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Суточная выплата в Казну сети: ~{(plan.gb * SUBSCRIPTION_DAILY_COST_PER_GB).toFixed(1)} $NEXX / сутки
              </p>
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
              <div className="text-right">
                <div className="text-base font-black text-amber-300 font-mono">
                  {plan.nexxCost} $NEXX
                </div>
                <div className="text-[10px] text-slate-500 font-mono">
                  ≈ ${(plan.nexxCost * currentPrice).toFixed(2)}
                </div>
              </div>

              <button
                onClick={() => onSubscribe(plan)}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition shadow-md shadow-purple-950/40 cursor-pointer"
              >
                Активировать
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400 space-y-1">
        <div className="font-bold text-slate-200">Круговорот Казны Сети:</div>
        <p className="leading-relaxed text-[11px]">
          Средства от подписок поступают в Казну Сети и раз в сутки автоматически выплачиваются держателям нод за фактически хранимые 16КБ чанки. 
          Таким образом, спрос на хранилище напрямую поддерживает доходность нод.
        </p>
      </div>
    </div>
  );
};
