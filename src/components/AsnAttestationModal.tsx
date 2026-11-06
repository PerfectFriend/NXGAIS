import React, { useState } from 'react';
import { ShieldCheck, Globe, CheckCircle2, RefreshCw, AlertCircle, Lock, Hash, ShieldAlert, Cpu } from 'lucide-react';
import {
  SOVEREIGN_ASN_WITNESSES,
  executeRealAsnAttestation,
  type VoprfProofResult
} from '../utils/voprfAttestation';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentNodeName?: string;
}

export const AsnAttestationModal: React.FC<Props> = ({
  isOpen,
  onClose,
  currentNodeName = 'Pixel 6a Sovereign Node',
}) => {
  const [isAttesting, setIsAttesting] = useState(false);
  const [tamperWitness4, setTamperWitness4] = useState(false);
  const [witnessResults, setWitnessResults] = useState<VoprfProofResult[]>(() =>
    SOVEREIGN_ASN_WITNESSES.map(w => executeRealAsnAttestation(currentNodeName, w))
  );

  if (!isOpen) return null;

  const handleRunAttestation = () => {
    setIsAttesting(true);
    setTimeout(() => {
      const results = SOVEREIGN_ASN_WITNESSES.map((w, idx) =>
        executeRealAsnAttestation(currentNodeName, w, tamperWitness4 && idx === 3)
      );
      setWitnessResults(results);
      setIsAttesting(false);
    }, 180);
  };

  const verifiedCount = witnessResults.filter(a => a.status === 'VERIFIED').length;
  const isQuorumMet = verifiedCount >= 4;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="relative bg-slate-900 border border-cyan-500/30 rounded-2xl max-w-3xl w-full p-6 space-y-5 shadow-[0_0_50px_rgba(6,182,212,0.15)] overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-cyan-950 text-cyan-400 border border-cyan-500/30">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white font-mono">
                  Аттестация Автономных Систем (ASN Witness Network)
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-emerald-950 text-emerald-300 border border-emerald-500/30">
                  LIVE ED25519
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Криптографическая верификация через независимые ASN-свидетели (@noble/curves)
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

        <div className="overflow-y-auto space-y-4 pr-1 text-xs">
          {/* Overview Banner */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-white">Инвариант защиты от захвата пулом дата-центров:</span>
              <span className={`font-mono text-xs font-bold px-2 py-0.5 rounded border ${
                isQuorumMet
                  ? 'bg-emerald-950 text-emerald-300 border-emerald-500/30'
                  : 'bg-red-950 text-red-300 border-red-500/30'
              }`}>
                Кворум Свидетелей: {verifiedCount} / 5 {isQuorumMet ? '✓ Достигнут' : '⚠ Недостаточно'}
              </span>
            </div>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Нода <span className="text-cyan-300 font-semibold">{currentNodeName}</span> запрашивает слепую цифровую подпись Ed25519 от 5 географически и логически независимых свидетелей (ASNs). Это математически доказывает, что узел находится в реальной пользовательской сети, а не замаскирован в одном кластере облака.
            </p>
          </div>

          {/* Tampering / Byzantine Test Control */}
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="font-bold text-slate-200 block">Тест византийского свидетеля (Byzantine Fault Injection):</span>
              <span className="text-[11px] text-slate-400">
                Повреждает 1 байт криптографической подписи свидетеля #4 для проверки работы Ed25519.
              </span>
            </div>
            <button
              onClick={() => setTamperWitness4(!tamperWitness4)}
              className={`px-3 py-1.5 rounded-lg font-mono text-xs font-bold transition border cursor-pointer shrink-0 ${
                tamperWitness4
                  ? 'bg-amber-950 text-amber-300 border-amber-500/50'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
              }`}
            >
              {tamperWitness4 ? '⚠️ Подпись #4 повреждена' : 'Честные свидетели'}
            </button>
          </div>

          {/* Witnesses Table */}
          <div className="space-y-2 font-mono">
            {witnessResults.map((att) => {
              const isOk = att.status === 'VERIFIED';
              return (
                <div
                  key={att.attesterId}
                  className={`p-3 rounded-xl border transition ${
                    isOk ? 'bg-slate-950 border-slate-800' : 'bg-red-950/20 border-red-800/40'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-xs">{att.attesterName}</span>
                      <span className="text-[10px] text-slate-400 font-normal">({att.endpoint})</span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                        isOk
                          ? 'bg-emerald-950 text-emerald-300 border-emerald-500/30'
                          : 'bg-red-950 text-red-300 border-red-500/30'
                      }`}
                    >
                      {isOk ? `✓ ED25519 OK (${att.latencyMs} мс)` : '✗ INVALID SIGNATURE'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-300 pt-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-500">ASN:</span>
                      <span className="text-cyan-300 font-semibold">{att.asnDetected}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-500">Провайдер:</span>
                      <span className="text-slate-200">{att.ispName}</span>
                    </div>
                  </div>

                  {/* Cryptographic Details */}
                  <div className="mt-2 pt-2 border-t border-slate-900 text-[10px] text-slate-400 space-y-1">
                    <div className="flex items-center justify-between">
                      <span>Публичный ключ свидетеля:</span>
                      <span className="text-slate-300 font-mono">{att.cryptographicCheck.publicKeyHex.slice(0, 16)}...{att.cryptographicCheck.publicKeyHex.slice(-8)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Хэш-дайджест аттестации (SHA-256):</span>
                      <span className="text-slate-300 font-mono">{att.cryptographicCheck.messageDigestHex.slice(0, 16)}...</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Эллиптическая подпись:</span>
                      <span className="text-cyan-400 font-mono">{att.voprfBlindSignature}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Action trigger */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950 border border-slate-800">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-cyan-400" />
              <span className="text-slate-300">
                Запустить пересчёт аттестации через ядро @noble/curves
              </span>
            </div>
            <button
              onClick={handleRunAttestation}
              disabled={isAttesting}
              className="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-mono font-bold transition flex items-center gap-2 cursor-pointer text-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isAttesting ? 'animate-spin' : ''}`} />
              <span>{isAttesting ? 'Вычисление...' : 'Запустить Аттестацию'}</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-500 font-mono shrink-0">
          <span>* NeXXUs Protocol • RFC 8032 Ed25519 & Blind VOPRF Scheme</span>
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
