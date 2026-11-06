import React, { useState, useEffect } from 'react';
import { ShieldCheck, Cpu, HardDrive, AlertTriangle, CheckCircle2, XCircle, RefreshCw, Layers, ArrowRight, Zap, Lock } from 'lucide-react';
import {
  encodeReedSolomon4plus2,
  decodeReedSolomon4plus2,
  encryptChunkChaCha20,
  decryptChunkChaCha20,
  type ErasureShard,
  type ErasureEncodingResult,
} from '../utils/erasureCoding';

interface ShardState extends ErasureShard {
  isOnline: boolean;
  nodeName: string;
  nodeAsn: string;
}

export const ErasureCodingLabModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  vaultChaChaKeyHex: string;
}> = ({ isOpen, onClose, vaultChaChaKeyHex }) => {
  const [testPayloadText, setTestPayloadText] = useState(
    'NeXXUs Protocol Manifesto v2.0: Confidential 16KB User Chunk with Zero-Knowledge ChaCha20-Poly1305 and Reed-Solomon 4+2 Sharding.'
  );
  const [encodedResult, setEncodedResult] = useState<ErasureEncodingResult | null>(null);
  const [shards, setShards] = useState<ShardState[]>([]);
  const [reconstructedText, setReconstructedText] = useState<string | null>(null);
  const [reconstructionError, setReconstructionError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [encryptionMetrics, setEncryptionMetrics] = useState<{
    nonceHex: string;
    tagHex: string;
    cipherLen: number;
  } | null>(null);

  // Initialize and encode on open
  useEffect(() => {
    if (!isOpen) return;
    runInitialSharding(testPayloadText);
  }, [isOpen, vaultChaChaKeyHex]);

  const runInitialSharding = (text: string) => {
    setIsProcessing(true);
    setReconstructionError(null);

    const encoder = new TextEncoder();
    const rawPlaintext = encoder.encode(text);

    // 1. ChaCha20-Poly1305 encryption on client
    const enc = encryptChunkChaCha20(rawPlaintext, vaultChaChaKeyHex, 0);
    const cipherBytes = new Uint8Array(
      enc.combinedHex.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || []
    );

    setEncryptionMetrics({
      nonceHex: enc.nonceHex,
      tagHex: enc.tagHex,
      cipherLen: cipherBytes.length,
    });

    // 2. Reed-Solomon 4+2 encoding of ciphertext
    const result = encodeReedSolomon4plus2(cipherBytes);
    setEncodedResult(result);

    const nodeNames = [
      'Alpha Node (Helsinki)',
      'Beta Node (Frankfurt)',
      'Gamma Node (Warsaw)',
      'Delta Node (Zurich)',
      'Parity P1 (Reykjavik)',
      'Parity P2 (Singapore)',
    ];
    const nodeAsns = ['AS13335', 'AS24940', 'AS16276', 'AS31898', 'AS9009', 'AS15169'];

    const initialShards: ShardState[] = result.shards.map((s, idx) => ({
      ...s,
      isOnline: true,
      nodeName: nodeNames[idx] || `Node #${idx + 1}`,
      nodeAsn: nodeAsns[idx] || `AS${10000 + idx}`,
    }));

    setShards(initialShards);
    attemptReconstruction(initialShards, result.originalLength);
    setIsProcessing(false);
  };

  const toggleShardStatus = (shardIndex: number) => {
    const updated = shards.map(s =>
      s.shardIndex === shardIndex ? { ...s, isOnline: !s.isOnline } : s
    );
    setShards(updated);

    if (encodedResult) {
      attemptReconstruction(updated, encodedResult.originalLength);
    }
  };

  const attemptReconstruction = (currentShards: ShardState[], originalLength: number) => {
    const onlineShards = currentShards.filter(s => s.isOnline);

    if (onlineShards.length < 4) {
      setReconstructedText(null);
      setReconstructionError(
        `Критический сбой кворума: онлайн ${onlineShards.length} из 6 шардов. Для Reed-Solomon (4+2) необходимо минимум 4 любых шарда!`
      );
      return;
    }

    try {
      const recoveredCiphertext = decodeReedSolomon4plus2(onlineShards, originalLength);
      // Decrypt using ChaCha20-Poly1305 with user vault key
      const decryptedPlaintext = decryptChunkChaCha20(recoveredCiphertext, vaultChaChaKeyHex, 0);
      const text = new TextDecoder().decode(decryptedPlaintext);
      setReconstructedText(text);
      setReconstructionError(null);
    } catch (e: any) {
      setReconstructedText(null);
      setReconstructionError(`Ошибка дешифрования или восстановления: ${e.message}`);
    }
  };

  const onlineCount = shards.filter(s => s.isOnline).length;
  const isQuorumMet = onlineCount >= 4;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-3xl w-full p-6 space-y-5 shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-950/80 text-purple-400 border border-purple-500/30">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Матрица Шардирования Reed-Solomon (4 + 2) & ChaCha20-Poly1305
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                Тест отказоустойчивости: математическое восстановление из любых 4 из 6 шардов
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-xs font-mono px-2.5 py-1 rounded-lg bg-slate-800 transition"
          >
            ✕
          </button>
        </div>

        <div className="overflow-y-auto space-y-4 pr-1 text-xs">
          {/* Section 1: Cryptographic Zero-Knowledge Stage */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-purple-400" />
                <span className="font-bold text-white">1. Сквозное AEAD-шифрование (Только на клиенте)</span>
              </div>
              <span className="px-2 py-0.5 rounded bg-purple-950/60 border border-purple-500/30 font-mono text-[10px] text-purple-300">
                Ключ: m/44'/9999'/0'/1'/0
              </span>
            </div>

            <p className="text-slate-400 text-[11px] leading-relaxed">
              Перед шардированием 16KB чанк шифруется алгоритмом ChaCha20-Poly1305. Ноды-доноры физически не имеют доступа к пользовательскому ключу и хранят лишь зашифрованные фрагменты.
            </p>

            {encryptionMetrics && (
              <div className="grid grid-cols-3 gap-2 font-mono text-[10px]">
                <div className="p-2 rounded bg-slate-900 border border-slate-850">
                  <span className="text-slate-500 block">Nonce (12B):</span>
                  <span className="text-cyan-300 truncate block">0x{encryptionMetrics.nonceHex}</span>
                </div>
                <div className="p-2 rounded bg-slate-900 border border-slate-850">
                  <span className="text-slate-500 block">Poly1305 Tag (16B):</span>
                  <span className="text-emerald-300 truncate block">0x{encryptionMetrics.tagHex}</span>
                </div>
                <div className="p-2 rounded bg-slate-900 border border-slate-850">
                  <span className="text-slate-500 block">Размер шифротекста:</span>
                  <span className="text-white font-bold block">{encryptionMetrics.cipherLen} байт</span>
                </div>
              </div>
            )}
          </div>

          {/* Section 2: Interactive Reed-Solomon Shard Matrix */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-cyan-400" />
                <span className="font-bold text-white">2. Распределение шардов по узлам (Кликните узел для симуляции сбоя)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold font-mono ${
                  isQuorumMet ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40' : 'bg-red-950 text-red-300 border border-red-500/40'
                }`}>
                  Кворум: {onlineCount}/6 ({isQuorumMet ? 'Достаточен' : 'Сбой'})
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 font-mono">
              {shards.map((shard) => {
                return (
                  <div
                    key={shard.shardIndex}
                    onClick={() => toggleShardStatus(shard.shardIndex)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer select-none ${
                      shard.isOnline
                        ? shard.isParity
                          ? 'bg-purple-950/20 border-purple-500/40 hover:border-purple-400'
                          : 'bg-cyan-950/20 border-cyan-500/40 hover:border-cyan-400'
                        : 'bg-red-950/10 border-red-800/40 opacity-60 hover:opacity-80'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                        shard.isParity ? 'bg-purple-900/60 text-purple-300' : 'bg-cyan-900/60 text-cyan-300'
                      }`}>
                        {shard.isParity ? `Четность P${shard.shardIndex - 3}` : `Данные D${shard.shardIndex + 1}`}
                      </span>
                      <div className="flex items-center gap-1 text-[10px]">
                        {shard.isOnline ? (
                          <span className="text-emerald-400 flex items-center gap-1 font-bold">
                            <CheckCircle2 className="w-3 h-3" /> Онлайн
                          </span>
                        ) : (
                          <span className="text-red-400 flex items-center gap-1 font-bold">
                            <XCircle className="w-3 h-3" /> Офлайн
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-white text-xs font-semibold truncate">{shard.nodeName}</div>
                    <div className="text-slate-400 text-[10px] flex items-center justify-between mt-1">
                      <span>{shard.nodeAsn}</span>
                      <span className="text-slate-500">{shard.data.length} байт</span>
                    </div>

                    <div className="mt-2 text-[9px] text-slate-500 truncate bg-black/40 px-1.5 py-0.5 rounded">
                      SHA: {shard.shardHash.slice(0, 16)}...
                    </div>
                  </div>
                );
              })}
            </div>

            <p className="text-[11px] text-slate-400 italic">
              * Подсказка: отключите любые 2 узла из 6 (например, D1 и D2). Система мгновенно восстановит 100% данных через оставшиеся 2 блока данных и 2 блока четности Галуа GF(2^8).
            </p>
          </div>

          {/* Section 3: Recovery Result */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-850 space-y-2">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              <span className="font-bold text-white">3. Результат декодирования и верификации целостности</span>
            </div>

            {reconstructedText && (
              <div className="p-3 rounded-lg bg-emerald-950/20 border border-emerald-500/30 text-emerald-300 font-mono text-[11px] space-y-1">
                <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Кворум успешно собран! Расшифрованный исходный текст:</span>
                </div>
                <div className="p-2 rounded bg-black/50 border border-emerald-500/20 text-white break-words mt-1">
                  "{reconstructedText}"
                </div>
              </div>
            )}

            {reconstructionError && (
              <div className="p-3 rounded-lg bg-red-950/30 border border-red-500/40 text-red-300 font-mono text-[11px] space-y-1">
                <div className="flex items-center gap-1.5 text-red-400 font-bold">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Сбой восстановления:</span>
                </div>
                <p className="text-slate-300">{reconstructionError}</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-500 font-mono flex items-center justify-between shrink-0">
          <span>* Модуль src/utils/erasureCoding.ts (GF(2^8) Matrix + ChaCha20-Poly1305)</span>
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
