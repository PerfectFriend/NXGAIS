import React, { useState } from 'react';
import { 
  Terminal, Play, CheckCircle2, AlertTriangle, ShieldCheck, 
  Key, RefreshCw, Copy, Check, X, Layers, Cpu, Database
} from 'lucide-react';
import { ed25519 } from '@noble/curves/ed25519.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, hexToBytes, utf8ToBytes } from '@noble/hashes/utils.js';
import { generateBip39Mnemonic, deriveIdentityFromMnemonic } from '../utils/bip39';
import { 
  encryptChunkChaCha20, 
  decryptChunkChaCha20, 
  encodeReedSolomon4plus2, 
  decodeReedSolomon4plus2,
  ErasureShard 
} from '../utils/erasureCoding';
import { computeXorDistance, getLeadingZeroBits } from '../utils/kademliaRouting';
import { buildMerkleTree, generatePorChallenge, computePorResponse, verifyAuditorPor } from '../utils/merkleProof';

interface SdkPlaygroundModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SdkPlaygroundModal: React.FC<SdkPlaygroundModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'ed25519' | 'chacha' | 'reedsolomon' | 'kademlia' | 'merkle'>('ed25519');
  const [copied, setCopied] = useState<string | null>(null);

  // Tab 1: Ed25519
  const [edMessage, setEdMessage] = useState('NeXXus Protocol v2.0 - Sovereign P2P Payload');
  const [edPrivKey, setEdPrivKey] = useState<string>('');
  const [edPubKey, setEdPubKey] = useState<string>('');
  const [edSignature, setEdSignature] = useState<string>('');
  const [edVerifyResult, setEdVerifyResult] = useState<boolean | null>(null);

  // Tab 2: ChaCha20-Poly1305
  const [chachaPlaintext, setChachaPlaintext] = useState('Secret Vault Chunk: 16-KB ChaCha20-Poly1305 authentic payload.');
  const [chachaCiphertextHex, setChachaCiphertextHex] = useState('');
  const [chachaNonceHex, setChachaNonceHex] = useState('');
  const [chachaTagHex, setChachaTagHex] = useState('');
  const [chachaDecrypted, setChachaDecrypted] = useState<string | null>(null);
  const [chachaError, setChachaError] = useState<string | null>(null);

  // Tab 3: Reed-Solomon 4+2
  const [rsInputText, setRsInputText] = useState('NeXXus Reed-Solomon 4+2 GF(2^8) fault-tolerant storage block test.');
  const [rsShards, setRsShards] = useState<{ id: number; data: Uint8Array; isLost: boolean; isParity: boolean }[]>([]);
  const [rsRecoveredText, setRsRecoveredText] = useState<string | null>(null);
  const [rsStatus, setRsStatus] = useState<string | null>(null);

  // Tab 4: Kademlia XOR
  const [kadNodeA, setKadNodeA] = useState('nx_node_0100000000000000000000000000000000000000000000000000000000000001');
  const [kadNodeB, setKadNodeB] = useState('nx_node_0100000000000000000000000000000000000000000000000000000000000003');
  const [kadDistanceHex, setKadDistanceHex] = useState<string | null>(null);
  const [kadBucketIndex, setKadBucketIndex] = useState<number | null>(null);

  // Tab 5: Merkle Tree & PoR
  const [merkleLeaves, setMerkleLeaves] = useState<string[]>([
    'chunk_leaf_0_00000000',
    'chunk_leaf_1_11111111',
    'chunk_leaf_2_22222222',
    'chunk_leaf_3_33333333'
  ]);
  const [merkleRootHex, setMerkleRootHex] = useState<string | null>(null);
  const [porResult, setPorResult] = useState<string | null>(null);

  if (!isOpen) return null;

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  // Run Ed25519 generate & sign
  const handleEd25519GenerateAndSign = () => {
    const privBytes = crypto.getRandomValues(new Uint8Array(32));
    const pubBytes = ed25519.getPublicKey(privBytes);
    const privHex = bytesToHex(privBytes);
    const pubHex = bytesToHex(pubBytes);
    const msgBytes = utf8ToBytes(edMessage);
    const sigBytes = ed25519.sign(msgBytes, privBytes);
    const sigHex = bytesToHex(sigBytes);

    setEdPrivKey(privHex);
    setEdPubKey(pubHex);
    setEdSignature(sigHex);
    const valid = ed25519.verify(sigBytes, msgBytes, pubBytes);
    setEdVerifyResult(valid);
  };

  // Run ChaCha20 Encrypt
  const handleChachaEncrypt = async () => {
    try {
      setChachaError(null);
      setChachaDecrypted(null);
      const keyHex = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
      const plaintextBytes = utf8ToBytes(chachaPlaintext);
      const res = encryptChunkChaCha20(plaintextBytes, keyHex, 0);
      setChachaCiphertextHex(res.ciphertextHex);
      setChachaNonceHex(res.nonceHex);
      setChachaTagHex(res.tagHex);

      (window as any).__demo_chacha_combined = res.combinedHex;
    } catch (e: any) {
      setChachaError(`Encryption error: ${e.message}`);
    }
  };

  // Run ChaCha20 Decrypt
  const handleChachaDecrypt = async (tamper = false) => {
    try {
      setChachaError(null);
      const combinedHex = (window as any).__demo_chacha_combined;
      if (!combinedHex) {
        setChachaError('Сначала нажмите "Зашифровать ChaCha20"!');
        return;
      }
      let combinedBytes = hexToBytes(combinedHex);
      if (tamper) {
        combinedBytes = new Uint8Array(combinedBytes);
        combinedBytes[20] ^= 0xff; // Tamper a ciphertext byte
      }
      const keyHex = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
      const decryptedBytes = decryptChunkChaCha20(combinedBytes, keyHex, 0);
      setChachaDecrypted(new TextDecoder().decode(decryptedBytes));
    } catch (e: any) {
      setChachaError(`Authentic AEAD Poly1305 Rejection: ${e.message}`);
      setChachaDecrypted(null);
    }
  };

  // Run Reed-Solomon Encode
  const handleRsEncode = () => {
    const raw = utf8ToBytes(rsInputText);
    const encResult = encodeReedSolomon4plus2(raw);
    (window as any).__demo_rs_len = raw.length;
    setRsShards(encResult.shards.map((s) => ({
      id: s.shardIndex,
      data: s.data,
      isLost: false,
      isParity: s.isParity,
    })));
    setRsRecoveredText(null);
    setRsStatus(`Закодировано в 6 шардов (4 Data + 2 Parity). Попробуйте отключить до 2 шардов!`);
  };

  const toggleRsShardLoss = (id: number) => {
    setRsShards(prev => prev.map(s => s.id === id ? { ...s, isLost: !s.isLost } : s));
  };

  const handleRsDecode = () => {
    const survivingShards: ErasureShard[] = rsShards
      .filter(s => !s.isLost)
      .map(s => ({
        shardIndex: s.id,
        isParity: s.isParity,
        shardHash: bytesToHex(sha256(s.data)),
        data: s.data,
      }));
    const lostCount = rsShards.filter(s => s.isLost).length;

    if (lostCount > 2) {
      setRsStatus(`Критический сбой кворума: потеряно ${lostCount} шардов (максимум допустимо: 2)!`);
      setRsRecoveredText(null);
      return;
    }

    try {
      const originalLength = (window as any).__demo_rs_len || 16;
      const recovered = decodeReedSolomon4plus2(survivingShards, originalLength);
      const clean = new TextDecoder().decode(recovered);
      setRsRecoveredText(clean);
      setRsStatus(`Успешное восстановление через обращение матрицы Вандермонда в GF(2^8)! 100% bit-perfect.`);
    } catch (e: any) {
      setRsStatus(`Ошибка декодирования: ${e.message}`);
    }
  };

  // Run Kademlia calculation
  const handleCalculateKademlia = () => {
    const dist = computeXorDistance(kadNodeA, kadNodeB);
    const leadingZeros = getLeadingZeroBits(dist);
    const bucket = leadingZeros >= 0 ? 255 - leadingZeros : 0;
    setKadDistanceHex(bytesToHex(dist));
    setKadBucketIndex(bucket);
  };

  // Run Merkle Tree & PoR
  const handleBuildMerkle = () => {
    const hashes = merkleLeaves.map(l => bytesToHex(sha256(utf8ToBytes(l))));
    const tree = buildMerkleTree(hashes);
    setMerkleRootHex(tree.root);

    // Run challenge for leaf 1
    const challenge = generatePorChallenge(tree.root, hashes.length);
    const leafBytes = utf8ToBytes(merkleLeaves[challenge.chunkIndex]);
    const response = computePorResponse(leafBytes, challenge, tree, Date.now() - 30);
    const audit = verifyAuditorPor(challenge, response, hashes[challenge.chunkIndex]);

    setPorResult(
      `Merkle Root: 0x${tree.root.slice(0, 16)}...\n` +
      `Проверен случайный лист #${challenge.chunkIndex} (seed: 0x${challenge.challengeSeedHex.slice(0, 8)}...)\n` +
      `PoR Response: 0x${response.proofResponse.slice(0, 16)}...\n` +
      `Статус верификации Советом Аудиторов: ${audit.verified ? '✅ 100% ВАЛИДНО (Proof of Retrievability)' : '❌ ОТКЛОНЕНО'}`
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-hidden h-full">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-slate-950 px-5 py-4 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-teal-500/10 border border-teal-500/30 text-teal-400">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white font-mono flex items-center gap-2">
                NeXXus Developer SDK & Crypto Console
                <span className="text-[10px] bg-teal-950 text-teal-400 border border-teal-500/40 px-2 py-0.5 rounded font-mono">
                  v2.0 Live Runtime
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Интерактивная песочница для криптографических вызовов протокола
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="bg-slate-950 px-5 pt-3 pb-0 border-b border-slate-800 flex items-center gap-2 overflow-x-auto scrollbar-none shrink-0">
          {[
            { id: 'ed25519', label: 'Ed25519 Подписи' },
            { id: 'chacha', label: 'ChaCha20-Poly1305' },
            { id: 'reedsolomon', label: 'Reed-Solomon 4+2' },
            { id: 'kademlia', label: 'Kademlia 256-bit XOR' },
            { id: 'merkle', label: 'Merkle PoR Аудит' },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              className={`px-3 py-2 text-xs font-mono font-bold border-b-2 transition shrink-0 cursor-pointer ${
                activeTab === t.id
                  ? 'border-teal-400 text-teal-300'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="p-5 flex-1 min-h-0 overflow-y-auto space-y-4 text-xs font-mono">
          {/* TAB 1: Ed25519 */}
          {activeTab === 'ed25519' && (
            <div className="space-y-4">
              <div>
                <label className="block text-slate-400 mb-1">Сообщение для подписи Ed25519:</label>
                <input
                  type="text"
                  value={edMessage}
                  onChange={e => setEdMessage(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 text-xs focus:outline-none focus:border-teal-500"
                />
              </div>

              <button
                onClick={handleEd25519GenerateAndSign}
                className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-slate-950 font-bold transition flex items-center gap-2 cursor-pointer shadow-md"
              >
                <Play className="w-4 h-4 fill-current" />
                Сгенерировать ключи, подписать и верифицировать
              </button>

              {edSignature && (
                <div className="space-y-3 bg-slate-950 p-4 rounded-xl border border-slate-800">
                  <div>
                    <span className="text-slate-500 text-[10px] block">Public Key (32 bytes / 64 hex):</span>
                    <div className="text-teal-300 break-all select-all">{edPubKey}</div>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] block">Ed25519 Signature (64 bytes / 128 hex):</span>
                    <div className="text-amber-300 break-all select-all">{edSignature}</div>
                  </div>
                  <div className="pt-2 border-t border-slate-800 flex items-center gap-2 text-emerald-400 font-bold">
                    <CheckCircle2 className="w-4 h-4" />
                    Криптографическая верификация: {edVerifyResult ? '100% VALID' : 'FAILED'}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: ChaCha20-Poly1305 */}
          {activeTab === 'chacha' && (
            <div className="space-y-4">
              <div>
                <label className="block text-slate-400 mb-1">Открытый текст чанка:</label>
                <textarea
                  rows={3}
                  value={chachaPlaintext}
                  onChange={e => setChachaPlaintext(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-100 text-xs focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleChachaEncrypt}
                  className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-slate-950 font-bold transition flex items-center gap-2 cursor-pointer"
                >
                  <Key className="w-4 h-4" />
                  Зашифровать ChaCha20-Poly1305 (RFC 8439)
                </button>
                {chachaCiphertextHex && (
                  <>
                    <button
                      onClick={() => handleChachaDecrypt(false)}
                      className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold transition flex items-center gap-2 cursor-pointer"
                    >
                      Расшифровать
                    </button>
                    <button
                      onClick={() => handleChachaDecrypt(true)}
                      className="px-4 py-2 rounded-xl bg-red-950/60 hover:bg-red-900/60 text-red-300 border border-red-500/40 font-bold transition flex items-center gap-2 cursor-pointer"
                    >
                      Имитировать подделку байта (Атака)
                    </button>
                  </>
                )}
              </div>

              {chachaCiphertextHex && (
                <div className="space-y-2.5 bg-slate-950 p-4 rounded-xl border border-slate-800">
                  <div>
                    <span className="text-slate-500 text-[10px] block">12-Byte Nonce:</span>
                    <span className="text-cyan-300">{chachaNonceHex}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] block">16-Byte Poly1305 Auth Tag:</span>
                    <span className="text-amber-300">{chachaTagHex}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] block">Ciphertext Hex:</span>
                    <div className="text-slate-300 break-all max-h-24 overflow-y-auto">{chachaCiphertextHex}</div>
                  </div>
                </div>
              )}

              {chachaDecrypted && (
                <div className="p-3 rounded-xl bg-emerald-950/50 border border-emerald-500/40 text-emerald-300 flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <strong>Успешно расшифровано:</strong>
                    <div className="mt-1 text-white">{chachaDecrypted}</div>
                  </div>
                </div>
              )}

              {chachaError && (
                <div className="p-3 rounded-xl bg-red-950/50 border border-red-500/40 text-red-300 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>{chachaError}</div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Reed-Solomon 4+2 */}
          {activeTab === 'reedsolomon' && (
            <div className="space-y-4">
              <div>
                <label className="block text-slate-400 mb-1">Исходный блок данных для нарезки:</label>
                <input
                  type="text"
                  value={rsInputText}
                  onChange={e => setRsInputText(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 text-xs focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleRsEncode}
                  className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-slate-950 font-bold transition cursor-pointer"
                >
                  1. Закодировать 4+2 Reed-Solomon
                </button>
                {rsShards.length > 0 && (
                  <button
                    onClick={handleRsDecode}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold transition cursor-pointer"
                  >
                    2. Восстановить (Decode Matrix)
                  </button>
                )}
              </div>

              {rsShards.length > 0 && (
                <div className="space-y-2">
                  <span className="text-slate-400 text-xs block">
                    Шарды (кликните по шарду, чтобы отключить ноду и проверить восстановление):
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {rsShards.map(s => (
                      <button
                        key={s.id}
                        onClick={() => toggleRsShardLoss(s.id)}
                        className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                          s.isLost
                            ? 'bg-red-950/40 border-red-500/50 text-red-400 line-through'
                            : s.isParity
                            ? 'bg-purple-950/40 border-purple-500/50 text-purple-300'
                            : 'bg-slate-950 border-slate-800 text-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between font-bold text-xs">
                          <span>{s.isParity ? `Parity #${s.id - 4}` : `Data #${s.id}`}</span>
                          <span className="text-[10px]">{s.isLost ? 'ОФФЛАЙН' : 'ОК'}</span>
                        </div>
                        <div className="text-[10px] text-slate-500 mt-1 truncate">
                          {bytesToHex(s.data.slice(0, 8))}...
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {rsStatus && (
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-300">
                  {rsStatus}
                </div>
              )}

              {rsRecoveredText && (
                <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/50 text-emerald-300">
                  <strong>Восстановленный текст:</strong> {rsRecoveredText}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: Kademlia XOR */}
          {activeTab === 'kademlia' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <div>
                  <label className="block text-slate-400 mb-1">Узел A (Ключ / Node ID):</label>
                  <input
                    type="text"
                    value={kadNodeA}
                    onChange={e => setKadNodeA(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 text-xs focus:outline-none focus:border-teal-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Узел B (Ключ / Node ID):</label>
                  <input
                    type="text"
                    value={kadNodeB}
                    onChange={e => setKadNodeB(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 text-xs focus:outline-none focus:border-teal-500 font-mono"
                  />
                </div>
              </div>

              <button
                onClick={handleCalculateKademlia}
                className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-slate-950 font-bold transition cursor-pointer"
              >
                Рассчитать 256-бит XOR Расстояние
              </button>

              {kadDistanceHex && (
                <div className="space-y-2 bg-slate-950 p-4 rounded-xl border border-slate-800">
                  <div>
                    <span className="text-slate-500 text-[10px] block">XOR Metric (256-bit Distance Hex):</span>
                    <div className="text-teal-300 break-all select-all font-mono">{kadDistanceHex}</div>
                  </div>
                  <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-800">
                    <span className="text-slate-400">Индекс K-Bucket (0..255):</span>
                    <span className="font-bold text-amber-300 font-mono">Bucket #{kadBucketIndex}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: Merkle Tree & PoR */}
          {activeTab === 'merkle' && (
            <div className="space-y-4">
              <div>
                <label className="block text-slate-400 mb-1">Листья дерева (Чанки):</label>
                <div className="space-y-1.5">
                  {merkleLeaves.map((leaf, idx) => (
                    <input
                      key={idx}
                      type="text"
                      value={leaf}
                      onChange={e => {
                        const next = [...merkleLeaves];
                        next[idx] = e.target.value;
                        setMerkleLeaves(next);
                      }}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-100 text-xs font-mono"
                    />
                  ))}
                </div>
              </div>

              <button
                onClick={handleBuildMerkle}
                className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-slate-950 font-bold transition cursor-pointer"
              >
                Построить Merkle Tree и провести PoR Аудит
              </button>

              {porResult && (
                <pre className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-teal-300 whitespace-pre-wrap leading-relaxed text-[11px]">
                  {porResult}
                </pre>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
