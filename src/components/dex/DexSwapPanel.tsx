import React from 'react';
import { ArrowRightLeft, Lock, CheckCircle2, ShieldCheck, Hash, FileCheck, X } from 'lucide-react';
import { Bip39Identity, OrderBookItem } from '../../types/nexxus';
import { TradeExecutionReceipt } from '../../utils/dexEngine';

export type SupportedPair = 'NEXX/USDC' | 'NEXX/TON' | 'NEXX/ETH' | 'NEXX/BTC';

interface DexSwapPanelProps {
  identity: Bip39Identity;
  selectedPair: SupportedPair;
  setSelectedPair: (pair: SupportedPair) => void;
  swapType: 'buy' | 'sell';
  setSwapType: (type: 'buy' | 'sell') => void;
  swapAmount: string;
  setSwapAmount: (amount: string) => void;
  currentPrice: number;
  calculatedTotal: number;
  orders: OrderBookItem[];
  executionReceipt?: TradeExecutionReceipt | null;
  onDismissReceipt?: () => void;
  onExecuteSwap: (e: React.FormEvent) => void;
}

export const DexSwapPanel: React.FC<DexSwapPanelProps> = ({
  identity,
  selectedPair,
  setSelectedPair,
  swapType,
  setSwapType,
  swapAmount,
  setSwapAmount,
  currentPrice,
  calculatedTotal,
  orders,
  executionReceipt,
  onDismissReceipt,
  onExecuteSwap,
}) => {
  const numAmount = parseFloat(swapAmount) || 0;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg space-y-5">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <ArrowRightLeft className="w-4 h-4 text-amber-400" />
          Мгновенный Обмен Токенов
        </h2>

        {/* Buy / Sell toggle */}
        <div className="flex p-1 rounded-lg bg-slate-950 border border-slate-800 text-xs">
          <button
            type="button"
            onClick={() => setSwapType('buy')}
            className={`px-3 py-1 rounded-md font-bold transition cursor-pointer ${
              swapType === 'buy' ? 'bg-emerald-600 text-white' : 'text-slate-400'
            }`}
          >
            Купить $NEXX
          </button>
          <button
            type="button"
            onClick={() => setSwapType('sell')}
            className={`px-3 py-1 rounded-md font-bold transition cursor-pointer ${
              swapType === 'sell' ? 'bg-amber-600 text-white' : 'text-slate-400'
            }`}
          >
            Продать $NEXX
          </button>
        </div>
      </div>

      <form onSubmit={onExecuteSwap} className="space-y-4 text-xs">
        {/* Pair Selector */}
        <div>
          <label className="block text-slate-400 mb-1">Торговая пара:</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {(['NEXX/USDC', 'NEXX/TON', 'NEXX/ETH', 'NEXX/BTC'] as const).map(pair => (
              <button
                key={pair}
                type="button"
                onClick={() => setSelectedPair(pair)}
                className={`py-2 rounded-xl font-mono text-[11px] font-bold border transition cursor-pointer ${
                  selectedPair === pair
                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {pair}
              </button>
            ))}
          </div>
        </div>

        {/* Input Amount */}
        <div className="space-y-1">
          <div className="flex justify-between text-slate-400">
            <span>Объём ($NEXX):</span>
            {swapType === 'sell' ? (
              <span className="text-emerald-400 font-bold">
                Доступно к продаже: {(identity.unlockedNexx ?? 0).toFixed(1)} NEXX
              </span>
            ) : (
              <span>Баланс: {(identity.balances?.nexx ?? 0).toFixed(1)} NEXX</span>
            )}
          </div>
          <input
            type="number"
            min="1"
            step="any"
            value={swapAmount}
            onChange={e => setSwapAmount(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-base font-mono text-white focus:outline-none focus:border-amber-500"
          />
          {swapType === 'sell' && (
            <div className="text-[10px] text-amber-300/80 flex items-center gap-1 mt-1">
              <Lock className="w-3 h-3 text-amber-400 shrink-0" />
              Токены из 8-недельного лока ({(identity.lockedNexx8Weeks ?? 0).toFixed(1)} NEXX) нельзя продать до созревания!
            </div>
          )}
        </div>

        {/* Calculated Output */}
        <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
          <div className="flex justify-between text-slate-400">
            <span>Итоговая цена:</span>
            <span className="font-mono text-white font-semibold">
              1 $NEXX ≈ {currentPrice} {selectedPair.split('/')[1]}
            </span>
          </div>
          <div className="flex justify-between text-slate-300 pt-1 border-t border-slate-850">
            <span className="font-bold">К оплате / зачислению:</span>
            <span className="font-mono text-emerald-400 font-bold text-sm">
              {calculatedTotal.toFixed(4)} {selectedPair.split('/')[1]}
            </span>
          </div>
        </div>

        <button
          type="submit"
          className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-emerald-500 text-slate-950 font-black text-sm transition hover:opacity-90 shadow-lg shadow-amber-950/40 cursor-pointer"
        >
          {swapType === 'buy' ? 'Купить $NEXX по рынку' : 'Продать разблокированные $NEXX'}
        </button>
      </form>

      {/* Cryptographic Execution Receipt */}
      {executionReceipt && (
        <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/50 shadow-[0_0_25px_-5px_rgba(16,185,129,0.3)] space-y-2.5 font-mono text-xs animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center justify-between border-b border-emerald-500/30 pb-2">
            <div className="flex items-center gap-2 text-emerald-300 font-bold">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Криптографический Чек Сделки (Ed25519)</span>
            </div>
            {onDismissReceipt && (
              <button
                type="button"
                onClick={onDismissReceipt}
                className="text-slate-400 hover:text-white p-1 rounded-md bg-slate-900/80 cursor-pointer"
                title="Скрыть чек"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div>
              <span className="text-slate-400">ID ордера:</span>
              <div className="text-white font-mono truncate">{executionReceipt.orderId}</div>
            </div>
            <div>
              <span className="text-slate-400">Пара / Тип:</span>
              <div className="text-emerald-400 font-bold">
                {executionReceipt.pair} · {executionReceipt.type.toUpperCase()}
              </div>
            </div>
            <div>
              <span className="text-slate-400">Исполненный объём:</span>
              <div className="text-white font-bold">{executionReceipt.filledAmount.toFixed(2)} NEXX</div>
            </div>
            <div>
              <span className="text-slate-400">Сумма расчёта:</span>
              <div className="text-cyan-300 font-bold">
                {executionReceipt.totalSettledQuote.toFixed(4)} {executionReceipt.pair.split('/')[1]}
              </div>
            </div>
            <div>
              <span className="text-slate-400">Средняя цена:</span>
              <div className="text-slate-200">{executionReceipt.averageExecutionPrice.toFixed(6)}</div>
            </div>
            <div>
              <span className="text-slate-400">Проскальзывание:</span>
              <div className="text-emerald-400">
                {executionReceipt.slippagePercent > 0 ? `+${executionReceipt.slippagePercent.toFixed(2)}%` : '0.00% (No slippage)'}
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-emerald-500/20 text-[10px] space-y-1 text-slate-400">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Hash className="w-3 h-3 text-cyan-400" />
                Root Hash:
              </span>
              <span className="text-cyan-300 truncate max-w-[200px]">{executionReceipt.stateRootHash}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1">
                <FileCheck className="w-3 h-3 text-emerald-400" />
                Ed25519 Sig:
              </span>
              <span className="text-slate-300 truncate max-w-[200px]">{executionReceipt.signatureHex.slice(0, 24)}...</span>
            </div>
          </div>
        </div>
      )}

      {/* Mini Order Book preview */}
      <div className="pt-2 border-t border-slate-800 space-y-2">
        <span className="text-slate-400 font-semibold text-[11px] uppercase tracking-wider block">
          Стакан ордеров {selectedPair}:
        </span>
        <div className="space-y-1 font-mono text-[10px]">
          {orders.slice(0, 4).map(o => (
            <div key={o.id} className="flex justify-between text-slate-400 bg-slate-950/60 p-1.5 rounded">
              <span className={o.type === 'buy' ? 'text-emerald-400' : 'text-red-400'}>
                {o.type.toUpperCase()} @ {o.price}
              </span>
              <span>{o.amount.toLocaleString()} NEXX</span>
              <span className="text-slate-500">{o.total.toFixed(1)} USDC</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
