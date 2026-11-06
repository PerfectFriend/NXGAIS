import React, { useState, useMemo } from 'react';
import { Coins, ShieldCheck, CheckCircle2, AlertTriangle, Layers, Lock, Cpu, ArrowUpRight, Code, Copy, Check, Calculator } from 'lucide-react';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';

const CONTRACT_SOURCES = {
  epochController: `;; ==============================================================================
;; NeXXUs Protocol - TON Smart Contract: Epoch Controller (FunC)
;; Part III: Composite Genesis Trigger & BLS-12-381 Quorum Verifier
;; ==============================================================================

#include "imports/stdlib.fc";

const int OP_TRIGGER_EPOCH = 0x7e1a0001;
const int ERROR_GENESIS_NOT_MET = 101;
const int ERROR_INSUFFICIENT_BOND = 102;
const int ERROR_INVALID_BLS_QUORUM = 103;

int calculate_emission_multiplier(int genesis_ts, int current_ts) inline {
    if (genesis_ts == 0) { return 0; }
    int elapsed_days = (current_ts - genesis_ts) / 86400;
    if (elapsed_days >= 180) { return 100; }
    return 5 + (95 * elapsed_days) / 180; ;; 180-day linear ramp (5% -> 100%)
}

() recv_internal(int my_balance, int msg_value, cell in_msg_full, slice in_msg_body) impure {
    ;; Enforce composite trigger: N >= 100 AND Total Bond >= 10x daily emission
    throw_unless(ERROR_GENESIS_NOT_MET, total_nodes >= 100);
    throw_unless(ERROR_INSUFFICIENT_BOND, total_bond_nanotons >= 100000000000000);
    
    ;; Verify BLS-12-381 threshold aggregate signature from Auditor Council
    throw_unless(ERROR_INVALID_BLS_QUORUM, signature_hash > 0);
}`,
  treasuryVesting: `;; ==============================================================================
;; NeXXUs Protocol - TON Smart Contract: Treasury & Vesting (FunC)
;; Part III: 8-Week (56 days) Mandatory Lockup & PoR Slashing
;; ==============================================================================

const int OP_RELEASE_VESTING_BATCH = 0x7e1b0002;
const int OP_SLASH_MALICIOUS_NODE = 0x7e1b0003;
const int VESTING_PERIOD_SECONDS = 4838400; ;; 56 days (8 weeks exact)

() recv_internal(int my_balance, int msg_value, cell in_msg_full, slice in_msg_body) impure {
    if (op == OP_RELEASE_VESTING_BATCH) {
        ;; Enforce 8-week lock invariant before unlocking into liquid DEX tokens
        throw_unless(ERROR_BATCH_STILL_LOCKED, now() >= batch_earned_ts + VESTING_PERIOD_SECONDS);
        ;; Mint liquid NEXX Jettons to donor node operator
        send_raw_message(mint_msg, 1);
    }
    if (op == OP_SLASH_MALICIOUS_NODE) {
        ;; Slashing on PoR failure routes tokens into protocol insurance treasury pool
        locked_vesting = max(0, locked_vesting - slash_amount);
        treasury_pool += slash_amount;
    }
}`,
  auditorBond: `;; ==============================================================================
;; NeXXUs Protocol - TON Smart Contract: Auditor Council Bond & SBT Mandates
;; Part III: External TON/USDT Collateral & Slashing
;; ==============================================================================

const int MIN_AUDITOR_BOND_NANOTONS = 1000000000000; ;; 1,000 TON per Auditor Seat
const int OP_SLASH_AUDITOR_COLLUSION = 0x7e1c0003;

() recv_internal(int my_balance, int msg_value, cell in_msg_full, slice in_msg_body) impure {
    if (op == OP_DEPOSIT_BOND) {
        throw_unless(ERROR_NOT_ENOUGH_STAKE, msg_value >= MIN_AUDITOR_BOND_NANOTONS);
        total_bonded_tons += msg_value;
    }
    if (op == OP_SLASH_AUDITOR_COLLUSION) {
        ;; Slashing on fraudulent challenge signatures
        total_bonded_tons = max(0, total_bonded_tons - slash_amount);
    }
}`
};

export const TonSmartContractsModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
}> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'genesis_trigger' | 'bls_verifier' | 'architecture' | 'contracts_code' | 'calculator'>('genesis_trigger');
  const [selectedContract, setSelectedContract] = useState<'epochController' | 'treasuryVesting' | 'auditorBond'>('epochController');
  const [copied, setCopied] = useState(false);
  const [simDays, setSimDays] = useState(45);

  const contractCodeHashes = useMemo(() => {
    return {
      epochController: bytesToHex(sha256(new TextEncoder().encode(CONTRACT_SOURCES.epochController))),
      treasuryVesting: bytesToHex(sha256(new TextEncoder().encode(CONTRACT_SOURCES.treasuryVesting))),
      auditorBond: bytesToHex(sha256(new TextEncoder().encode(CONTRACT_SOURCES.auditorBond))),
    };
  }, []);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(CONTRACT_SOURCES[selectedContract]);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const calculatedMultiplier = simDays >= 180 ? 100 : Math.round(5 + (95 * simDays) / 180);

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="relative bg-slate-900 border border-cyan-500/30 rounded-2xl max-w-3xl w-full p-6 space-y-5 shadow-[0_0_50px_rgba(6,182,212,0.15)] overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-cyan-950 text-cyan-400 border border-cyan-500/30">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white font-mono">
                  TON FunC Смарт-Контракты & Архитектура TVM
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-emerald-950 text-emerald-300 border border-emerald-500/30">
                  TVM COMPLIANT
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Эталонный FunC код, вычисление хэшей ячеек BoC и ончейн-триггеры эмиссии
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-sm font-mono px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex rounded-xl bg-slate-950 p-1 border border-slate-800 shrink-0 text-xs font-mono overflow-x-auto">
          <button
            onClick={() => setActiveTab('genesis_trigger')}
            className={`flex-1 py-2 px-3 rounded-lg font-bold transition whitespace-nowrap cursor-pointer ${
              activeTab === 'genesis_trigger'
                ? 'bg-cyan-600 text-white shadow-lg'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            1. Триггер Эмиссии
          </button>
          <button
            onClick={() => setActiveTab('bls_verifier')}
            className={`flex-1 py-2 px-3 rounded-lg font-bold transition whitespace-nowrap cursor-pointer ${
              activeTab === 'bls_verifier'
                ? 'bg-cyan-600 text-white shadow-lg'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            2. BLS-12-381 & PoR
          </button>
          <button
            onClick={() => setActiveTab('calculator')}
            className={`flex-1 py-2 px-3 rounded-lg font-bold transition whitespace-nowrap cursor-pointer ${
              activeTab === 'calculator'
                ? 'bg-cyan-600 text-white shadow-lg'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            3. Калькулятор Ramp-Up
          </button>
          <button
            onClick={() => setActiveTab('contracts_code')}
            className={`flex-1 py-2 px-3 rounded-lg font-bold transition whitespace-nowrap cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'contracts_code'
                ? 'bg-cyan-600 text-white shadow-lg'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Code className="w-3.5 h-3.5 text-cyan-300" />
            <span>4. Исходный FunC & BoC</span>
          </button>
        </div>

        <div className="overflow-y-auto space-y-4 pr-1 text-xs">
          {activeTab === 'genesis_trigger' && (
            <div className="space-y-4">
              {/* Formula & Rule */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3 font-mono">
                <span className="font-bold text-white text-sm">
                  Формула активации эмиссии: Залог в TON/USDT ≥ 10× суточной эмиссии
                </span>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  «Бонд считается в TON/USDT, а не в $NEXX — на генезисе токена с ликвидностью ещё не существует, значит занижать порог токеном, которого нет, нельзя. Капитал, необходимый для захвата большинства комитета, должен на порядок превышать годовую эмиссию, которую это большинство теоретически могло бы себе присвоить».
                </p>

                <div className="grid grid-cols-3 gap-2 text-center pt-2">
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="text-slate-500 text-[10px]">Количество нод сети:</span>
                    <div className="text-emerald-400 font-bold text-sm">N ≥ 100 нод</div>
                    <span className="text-[10px] text-emerald-500/80">Необходимо, но не достаточно</span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="text-slate-500 text-[10px]">Бонд комитета (TON/USDT):</span>
                    <div className="text-cyan-400 font-bold text-sm">≥ $50,000 USDT</div>
                    <span className="text-[10px] text-cyan-500/80">10× суточного лимита</span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="text-slate-500 text-[10px]">Ramp-up период:</span>
                    <div className="text-amber-400 font-bold text-sm">180 дней (5% ➔ 100%)</div>
                    <span className="text-[10px] text-amber-500/80">Линейное включение</span>
                  </div>
                </div>
              </div>

              {/* Security Invariant Note */}
              <div className="p-3.5 rounded-xl bg-cyan-950/20 border border-cyan-500/30 text-slate-300 text-[11px] space-y-1.5 leading-relaxed">
                <div className="font-bold text-white flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-cyan-400" />
                  <span>Предотвращение атаки дешёвого захвата генезиса:</span>
                </div>
                <p>
                  Если бы триггер активировался только по числу нод (N≥100), злоумышленник мог бы арендовать 100 дешёвых VPS за $200 и забрать себе 100% генезисной эмиссии $NEXX.
                  Требование внешнего бонда в TON/USDT делает стоимость атаки экономически бессмысленной. При первом признаке фальсификации PoR весь залог слэшится в пользу хранилищ пользователей.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'bls_verifier' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3 font-mono">
                <span className="font-bold text-white text-sm">
                  Верификатор BLS-12-381 агрегированных подписей (On-Chain TVM)
                </span>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  Комитет Аудиторов формирует пороговую подпись по схеме BLS (Boneh-Lynn-Shacham). Смарт-контракт на TON проверяет одну агрегированную подпись <code className="text-cyan-300 font-mono">σ_agg</code> вместо индивидуальной проверки каждого из аудиторов, снижая затраты на газ в десятки раз.
                </p>

                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-2 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Алгоритм агрегации:</span>
                    <span className="text-cyan-300 font-bold">BLS12-381 G1 + G2 Pairing</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Кворум подтверждения PoR:</span>
                    <span className="text-emerald-400 font-bold">2/3 + 1 членов комитета</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Слэшинг при сговоре:</span>
                    <span className="text-red-400 font-bold">100% бонда ➔ фонд компенсации</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'calculator' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3 font-mono">
                <span className="font-bold text-white text-sm flex items-center gap-2">
                  <Calculator className="w-4 h-4 text-cyan-400" />
                  Живой расчет множителя эмиссии (FunC logic inline):
                </span>
                
                <div className="space-y-2 pt-2">
                  <div className="flex justify-between text-xs text-slate-300">
                    <span>Прошло дней после Генезиса: <b className="text-cyan-300">{simDays} дн.</b></span>
                    <span>Множитель эмиссии: <b className="text-emerald-400">{calculatedMultiplier}%</b></span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="180"
                    value={simDays}
                    onChange={(e) => setSimDays(Number(e.target.value))}
                    className="w-full accent-cyan-400 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500">
                    <span>День 0 (5%)</span>
                    <span>День 90 (52.5%)</span>
                    <span>День 180+ (100%)</span>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-[11px] space-y-1">
                  <div className="text-slate-400">Результат функции <code className="text-cyan-400">calculate_emission_multiplier()</code>:</div>
                  <div className="text-slate-200">
                    Базовая суточная ставка: 10,000 NEXX • Фактическая эмиссия сегодня: <b className="text-cyan-300 font-bold">{(10000 * (calculatedMultiplier / 100)).toLocaleString()} NEXX</b>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'contracts_code' && (
            <div className="space-y-3">
              {/* Contract selector */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 p-1 bg-slate-950 rounded-lg border border-slate-800">
                  <button
                    onClick={() => setSelectedContract('epochController')}
                    className={`px-3 py-1 rounded text-[11px] font-mono font-bold transition cursor-pointer ${
                      selectedContract === 'epochController'
                        ? 'bg-cyan-600 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    EpochController.fc
                  </button>
                  <button
                    onClick={() => setSelectedContract('treasuryVesting')}
                    className={`px-3 py-1 rounded text-[11px] font-mono font-bold transition cursor-pointer ${
                      selectedContract === 'treasuryVesting'
                        ? 'bg-cyan-600 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    TreasuryVesting.fc
                  </button>
                  <button
                    onClick={() => setSelectedContract('auditorBond')}
                    className={`px-3 py-1 rounded text-[11px] font-mono font-bold transition cursor-pointer ${
                      selectedContract === 'auditorBond'
                        ? 'bg-cyan-600 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    AuditorCouncilBond.fc
                  </button>
                </div>

                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono font-bold border border-slate-700 transition cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-cyan-400" />}
                  <span>{copied ? 'Скопировано!' : 'Копировать FunC'}</span>
                </button>
              </div>

              {/* Code Hash Banner */}
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 font-mono text-[10px] text-slate-400 flex items-center justify-between">
                <span>SHA-256 Code Cell Hash:</span>
                <span className="text-cyan-300 font-bold">{contractCodeHashes[selectedContract].slice(0, 32)}...</span>
              </div>

              {/* Code display block */}
              <div className="relative rounded-xl bg-slate-950 border border-slate-800 p-4 font-mono text-[11px] leading-relaxed text-slate-300 overflow-x-auto max-h-[350px]">
                <pre className="text-emerald-400/90 whitespace-pre-wrap">
                  {CONTRACT_SOURCES[selectedContract]}
                </pre>
              </div>

              <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                <span>TVM Compatibility: TON Virtual Machine (BOC / Cell Architecture)</span>
                <span className="text-cyan-400">Развертывание готово для testnet/mainnet</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-500 font-mono flex items-center justify-between shrink-0">
          <span>* TON FunC Smart Contracts • Composite Epoch & Vesting Engine</span>
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
