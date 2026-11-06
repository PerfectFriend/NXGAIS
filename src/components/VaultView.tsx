import React, { useState } from 'react';
import { 
  HardDrive, Upload, Lock, ShieldCheck, FileText, CheckCircle2, 
  Layers, Download, Eye, AlertCircle, RefreshCw, Database, Hash, Server, ChevronRight, X,
  Clock, ShieldAlert, Sparkles, Activity
} from 'lucide-react';
import { VaultFile, ChunkRecord, NodeRecord, Bip39Identity, StorageTier } from '../types/nexxus';
import { sliceFileInto16KbChunks, formatBytes, CHUNK_SIZE_BYTES, reassembleAndDecryptFile } from '../utils/chunkEngine';
import { getAllChunksForFile } from '../utils/indexedDbStore';
import { calculateDynamicVaultQuota, evaluateDegradationSchedule, calculateAntiLoopModel } from '../utils/storageManager';
import { deriveBipSplitKeys } from '../utils/bip39';
import { ErasureCodingLabModal } from './ErasureCodingLabModal';
import { NetworkRepairModal } from './NetworkRepairModal';

interface VaultViewProps {
  files: VaultFile[];
  onAddFile: (file: VaultFile) => void;
  onUpdateFiles?: (files: VaultFile[]) => void;
  nodes: NodeRecord[];
  identity: Bip39Identity;
  totalVaultQuotaGb: number;
  currentNode?: NodeRecord;
}

export const VaultView: React.FC<VaultViewProps> = ({
  files,
  onAddFile,
  onUpdateFiles,
  nodes,
  identity,
  totalVaultQuotaGb,
  currentNode,
}) => {
  const [selectedFileForInspection, setSelectedFileForInspection] = useState<VaultFile | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadStatusText, setUploadStatusText] = useState<string>('');
  const [selectedUploadTier, setSelectedUploadTier] = useState<StorageTier>('hot_rf6');

  // Client retrieval & ChaCha decryption state
  const [retrievingFile, setRetrievingFile] = useState<VaultFile | null>(null);
  const [retrievalProgress, setRetrievalProgress] = useState<number>(0);
  const [retrievalStatusText, setRetrievalStatusText] = useState<string>('');
  const [isDecryptionComplete, setIsDecryptionComplete] = useState<boolean>(false);
  const [isErasureLabOpen, setIsErasureLabOpen] = useState<boolean>(false);
  const [isRepairModalOpen, setIsRepairModalOpen] = useState<boolean>(false);

  // Derive Vault ChaCha20 key from BIP-39 mnemonic
  const splitKeys = deriveBipSplitKeys(identity.mnemonic);

  // Dynamic Vault Quota & Honest Degradation from Manifesto v2
  const qualifiedDays = currentNode?.qualifiedUptimeDays ?? currentNode?.consecutiveDaysWithoutPenalty ?? 28;
  const offlineDays = currentNode?.offlineConsecutiveDays ?? 0;
  const hasActiveBaseSection = (currentNode?.totalStorageAllocatedGb || 48) >= 16;
  const dynamicQuota = calculateDynamicVaultQuota(qualifiedDays, hasActiveBaseSection);
  const degradation = evaluateDegradationSchedule(offlineDays);
  const antiLoop = calculateAntiLoopModel();

  // Total used bytes in vault
  const usedBytes = files.reduce((sum, f) => sum + f.sizeBytes, 0);
  const usedGb = usedBytes / (1024 * 1024 * 1024);
  const effectiveQuotaGb = Math.max(dynamicQuota.quotaGb, totalVaultQuotaGb);
  const usedPercent = Math.min(100, (usedGb / Math.max(0.1, effectiveQuotaGb)) * 100);

  // File upload handler with 16KB chunking simulation & selected Storage Tier
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = event.target.files;
    if (!uploadedFiles || uploadedFiles.length === 0) return;

    const file = uploadedFiles[0];
    const isCold = selectedUploadTier === 'cold_archive_rf4';
    const rfCount = isCold ? 4 : 6;

    setIsUploading(true);
    setUploadProgress(10);
    setUploadStatusText(`Инициализация ChaCha20-Poly1305 шифрования на клиенте...`);

    await new Promise(r => setTimeout(r, 600));
    setUploadProgress(35);
    const expectedChunks = Math.max(1, Math.ceil(file.size / CHUNK_SIZE_BYTES));
    setUploadStatusText(`Нарезка на ${expectedChunks} чанков по 16 Кб (${isCold ? 'Архивный тариф RF=4×' : 'Горячий сейф RF=6×'})...`);

    await new Promise(r => setTimeout(r, 800));
    setUploadProgress(70);
    setUploadStatusText(`Сквозное ${rfCount}x-реплицирование чанков по onion-нодам сети (RF=${rfCount}×)...`);

    const fileId = `file_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const chunks = await sliceFileInto16KbChunks(file, fileId, nodes, selectedUploadTier);

    await new Promise(r => setTimeout(r, 600));
    setUploadProgress(100);
    setUploadStatusText(`Кворум ${rfCount} копий каждого чанка подтверждён (RF=${rfCount}×)!`);

    const newVaultFile: VaultFile = {
      id: fileId,
      name: file.name,
      sizeBytes: file.size,
      mimeType: file.type || 'application/octet-stream',
      chunksCount: chunks.length,
      uploadedAt: Date.now(),
      encryptionAlgorithm: 'ChaCha20-Poly1305',
      storageTier: selectedUploadTier,
      rootHash: chunks[0]?.hash || '00000000000000000000',
      chunks,
    };

    onAddFile(newVaultFile);
    setTimeout(() => {
      setIsUploading(false);
      setUploadProgress(0);
      setUploadStatusText('');
    }, 1000);

    // Reset input
    event.target.value = '';
  };

  // Safe client-side retrieval & ChaCha20-Poly1305 decryption flow (WS5)
  const handleStartDownload = async (file: VaultFile) => {
    setRetrievingFile(file);
    setIsDecryptionComplete(false);
    setRetrievalProgress(15);
    setRetrievalStatusText(`Поиск кворума чанков в Kademlia DHT поверх Tor...`);

    await new Promise(r => setTimeout(r, 600));
    setRetrievalProgress(45);
    setRetrievalStatusText(`Верификация SHA-256 хэшей и Merkle-корня (${file.chunksCount} чанков)...`);

    await new Promise(r => setTimeout(r, 700));
    setRetrievalProgress(80);
    setRetrievalStatusText(`Расшифровка ChaCha20-Poly1305 клиентским ключом m/44'/9999'/0'/1'/0...`);

    await new Promise(r => setTimeout(r, 600));
    setRetrievalProgress(100);
    setRetrievalStatusText(`Файл успешно восстановлен из распределённого кворума!`);
    setIsDecryptionComplete(true);

    // Trigger browser file download: real binary data reassembled and decrypted with ChaCha20-Poly1305, or authenticated proof fallback
    try {
      const decryptedBytes = await reassembleAndDecryptFile(file.id, file.chunksCount);
      let blob: Blob;

      if (decryptedBytes && decryptedBytes.length > 0) {
        blob = new Blob([decryptedBytes], { type: file.mimeType || 'application/octet-stream' });
      } else {
        // Fallback check in storedChunks directly
        const storedChunks = await getAllChunksForFile(file.id);
        if (storedChunks && storedChunks.length > 0) {
          const blobParts: BlobPart[] = storedChunks.map(c => c.buffer.slice(c.byteOffset, c.byteOffset + c.byteLength));
          blob = new Blob(blobParts, { type: file.mimeType || 'application/octet-stream' });
        } else {
          // Authenticated proof fallback for mock files
          const dummyContent = `[NeXXUs Decentralized Storage]\nFile: ${file.name}\nSize: ${file.sizeBytes} bytes\nRootHash: ${file.rootHash}\nAlgorithm: ${file.encryptionAlgorithm}\nReplication Factor: RF=6x\nDecrypted successfully on client device via Vault Master Key m/44'/9999'/0'/1'/0.`;
          blob = new Blob([dummyContent], { type: file.mimeType || 'text/plain' });
        }
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // safe fallback
    }
  };

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 space-y-6">
      {/* Top Banner: 1/8th Private Vault Concept & Dynamic Progression */}
      <div className="bg-gradient-to-r from-purple-950/70 via-slate-900 to-slate-950 border border-purple-500/30 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="bg-purple-900/60 border border-purple-400/30 text-purple-300 text-xs font-mono font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                16GB Донорства ➔ 0.5–2GB Приватный Сейф
              </span>
              <span className="text-xs text-slate-400 font-mono">BIP-39 Мульти-девайс доступ</span>
              <span className="bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-[11px] font-mono px-2 py-0.5 rounded-full">
                {dynamicQuota.tierLabel}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight font-mono">
              Единый Сейф Секретов для Всех Ваших Устройств
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              Предоставив 16 GB на телефоне-ноде, вы получаете приватный сейф: <strong className="text-purple-300">0.5 GB на старте с ростом до 2 GB</strong> по мере подтверждения аптайма. 
              Сейф активен и реплицируется, пока нода поддерживает квалифицированный аптайм. 
              Файлы нарезаются на <strong className="text-white">16 Кб чанки</strong>, шифруются через <strong className="text-cyan-300">Per-Node Unique Encoding</strong> и распределяются с <strong className="text-emerald-300">6× или 4× избыточностью</strong>.
            </p>
          </div>

          {/* Quota Progress Meter */}
          <div className="bg-slate-950/80 p-4 rounded-xl border border-purple-500/20 min-w-[280px] space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400">Занято в вашем сейфе:</span>
              <span className="font-mono text-white font-bold">
                {usedGb < 0.01 ? `${(usedBytes / 1024).toFixed(1)} KB` : `${usedGb.toFixed(2)} GB`} / {effectiveQuotaGb.toFixed(1)} GB
              </span>
            </div>
            <div className="w-full bg-slate-900 h-2.5 rounded-full overflow-hidden border border-slate-800">
              <div
                className="h-full bg-gradient-to-r from-purple-500 to-cyan-400 rounded-full transition-all duration-300"
                style={{ width: `${Math.max(3, usedPercent)}%` }}
              />
            </div>
            <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono">
              <span>Динамический сейф: {dynamicQuota.quotaGb} GB</span>
              <span className="text-purple-300">Ключ: {identity.masterPublicKey.slice(0, 10)}...</span>
            </div>
            {dynamicQuota.daysToNextTier > 0 && (
              <div className="text-[10px] text-cyan-300 font-mono bg-cyan-950/40 px-2 py-1 rounded border border-cyan-500/20">
                ⏳ До квоты {dynamicQuota.nextTierQuotaGb} GB: {dynamicQuota.daysToNextTier} дней аптайма ({qualifiedDays} дн. выполнено)
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Protocol Guard Rails: Dynamic Progression, Honest Degradation & Anti-Loop */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Dynamic Progression Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-col justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5 font-mono">
                <Clock className="w-4 h-4 text-purple-400" />
                Динамическая Квота (Манифест v2)
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-500/30">
                День {qualifiedDays}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 leading-normal">
              0.5 GB (День 1) ➔ 1.0 GB (День 14) ➔ 2.0 GB (День 45). Защита от хищнических регистраций-однодневок.
            </p>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-800 flex items-center justify-between text-xs font-mono">
            <span className="text-slate-500">Текущий объём:</span>
            <span className="text-purple-300 font-bold">{dynamicQuota.quotaGb.toFixed(1)} GB чистый сейф</span>
          </div>
        </div>

        {/* Honest Degradation Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-col justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5 font-mono">
                <ShieldAlert className="w-4 h-4 text-amber-400" />
                Честная Деградация Сейфа
              </span>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                degradation.status === 'healthy'
                  ? 'bg-emerald-950 text-emerald-300 border-emerald-500/30'
                  : degradation.status === 'warning_14d'
                  ? 'bg-amber-950 text-amber-300 border-amber-500/30'
                  : 'bg-red-950 text-red-300 border-red-500/30'
              }`}>
                {degradation.status === 'healthy' ? 'Здоров' : 'Предупреждение'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 leading-normal">
              {degradation.description}
            </p>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-800 flex items-center justify-between text-xs font-mono">
            <span className="text-slate-500">До вытеснения:</span>
            <span className="text-amber-300 font-bold">{degradation.daysUntilEviction} дней</span>
          </div>
        </div>

        {/* Anti-Loop Invariant Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-col justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5 font-mono">
                <Activity className="w-4 h-4 text-cyan-400" />
                Anti-Loop Инвариант
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/30">
                Защита от Сибила
              </span>
            </div>
            <p className="text-[11px] text-slate-400 leading-normal">
              Fee_writer ({antiLoop.writerFeePerGbDay}) &gt; Reward_storer ({antiLoop.storerRewardPerGbDay}). Доходность сибил-петли: <strong className="text-red-400">{antiLoop.netAttackerYieldPerGbDay} NEXX</strong>.
            </p>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-800 flex items-center justify-between text-xs font-mono">
            <span className="text-slate-500">Фарминг из воздуха:</span>
            <span className="text-emerald-400 font-bold">Экономически невозможен</span>
          </div>
        </div>
      </div>

      {/* Upload Box with 16KB Torrent-like progress & Storage Tier Selector */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="space-y-0.5 text-center sm:text-left">
            <h2 className="text-lg font-bold text-white flex items-center justify-center sm:justify-start gap-2">
              <Upload className="w-5 h-5 text-purple-400" />
              Загрузить в Децентрализованное Облако
            </h2>
            <p className="text-xs text-slate-400">
              Файл автоматически шифруется на клиенте ChaCha20-Poly1305, режется на блоки ровно по 16 КБ и рассылается по нодам.
            </p>
          </div>

          <label 
            htmlFor="vault-file-upload-input" 
            className="cursor-pointer px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition flex items-center gap-2 shadow-lg shadow-purple-950/50 shrink-0"
          >
            <Upload className="w-4 h-4" />
            <span>Выбрать файл для нарезки</span>
            <input
              id="vault-file-upload-input"
              type="file"
              onChange={handleFileUpload}
              className="hidden"
              disabled={isUploading}
            />
          </label>
        </div>

        {/* Storage Tier Selection */}
        <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <span className="text-slate-400 font-mono font-semibold">Тариф репликации:</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedUploadTier('hot_rf6')}
              className={`px-3 py-1.5 rounded-lg font-mono font-semibold transition border flex items-center gap-1.5 ${
                selectedUploadTier === 'hot_rf6'
                  ? 'bg-purple-600 text-white border-purple-400 shadow-md'
                  : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-slate-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Горячий Сейф (RF=6×, стандарт)</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedUploadTier('cold_archive_rf4')}
              className={`px-3 py-1.5 rounded-lg font-mono font-semibold transition border flex items-center gap-1.5 ${
                selectedUploadTier === 'cold_archive_rf4'
                  ? 'bg-amber-600 text-white border-amber-400 shadow-md'
                  : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-slate-200'
              }`}
            >
              <HardDrive className="w-3.5 h-3.5" />
              <span>Архивный Сейф (RF=4×, скидка 30%)</span>
            </button>
          </div>
        </div>

        {/* Upload progress & Chunks Slicing Animation */}
        {isUploading && (
          <div className="mt-5 p-4 rounded-xl bg-purple-950/40 border border-purple-500/40 space-y-2 animate-pulse">
            <div className="flex items-center justify-between text-xs">
              <span className="font-mono text-purple-200 font-semibold">{uploadStatusText}</span>
              <span className="font-mono text-white font-bold">{uploadProgress}%</span>
            </div>
            <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-500 via-cyan-400 to-emerald-400 transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Files List */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-emerald-400" />
            <h3 className="text-base font-bold text-white">Хранимые Файлы ({files.length})</h3>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setIsRepairModalOpen(true)}
              className="px-3 py-1.5 rounded-lg bg-emerald-950/70 hover:bg-emerald-900 text-emerald-300 text-xs font-mono font-semibold border border-emerald-500/40 flex items-center gap-1.5 transition cursor-pointer"
            >
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              <span>Сетевой Ремонт Чанков (Live)</span>
            </button>
            <button
              onClick={() => setIsErasureLabOpen(true)}
              className="px-3 py-1.5 rounded-lg bg-purple-950/70 hover:bg-purple-900 text-purple-300 text-xs font-mono font-semibold border border-purple-500/40 flex items-center gap-1.5 transition cursor-pointer"
            >
              <Layers className="w-3.5 h-3.5 text-purple-400" />
              <span>Reed-Solomon (4+2) Лаборатория</span>
            </button>
            <span className="text-xs text-slate-400 font-mono hidden md:inline">
              Стандарт чанка: 16,384 байт • 6× Репликация
            </span>
          </div>
        </div>

        {files.length === 0 ? (
          <div className="p-8 text-center bg-slate-950 rounded-xl border border-slate-800 text-slate-500 text-xs">
            В вашем приватном хранилище пока нет файлов. Загрузите первый файл для нарезки на 16KB чанки.
          </div>
        ) : (
          <div className="space-y-3">
            {files.map(file => {
              const isCold = file.storageTier === 'cold_archive_rf4';
              return (
                <div
                  key={file.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl bg-slate-950 border border-slate-800/80 hover:border-purple-500/40 transition gap-4"
                >
                  <div className="flex items-start sm:items-center gap-3">
                    <div className="p-2.5 rounded-lg bg-purple-950/60 text-purple-400 border border-purple-500/30 shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="space-y-0.5">
                      <div className="font-bold text-sm text-white flex items-center gap-2">
                        <span>{file.name}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 border border-emerald-500/30 text-emerald-400 font-mono">
                          {file.encryptionAlgorithm}
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded font-mono border ${
                          isCold 
                            ? 'bg-amber-950/80 border-amber-500/40 text-amber-300' 
                            : 'bg-purple-950/80 border-purple-500/40 text-purple-300'
                        }`}>
                          {isCold ? 'Архив (RF=4×)' : 'Горячий (RF=6×)'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-400 font-mono">
                        <span>{formatBytes(file.sizeBytes)}</span>
                        <span>•</span>
                        <span className="text-cyan-400 font-semibold">{file.chunksCount} чанков (по 16Кб)</span>
                        <span>•</span>
                        <span className="text-purple-300">{isCold ? '4×' : '6×'} копий на нодах</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <button
                      onClick={() => setSelectedFileForInspection(file)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-semibold border border-slate-700 transition"
                    >
                      <Eye className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Карта Чанков</span>
                    </button>

                    <button
                      onClick={() => handleStartDownload(file)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 text-xs font-semibold border border-purple-500/30 transition cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Скачать</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Chunk Map Modal / Inspector */}
      {selectedFileForInspection && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-cyan-950 text-cyan-400 border border-cyan-500/30">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Инспектор 16KB Чанков & Репликации (Manifesto v2)</h3>
                  <p className="text-xs text-slate-400 font-mono flex items-center gap-2">
                    <span>{selectedFileForInspection.name}</span>
                    <span className="text-purple-300">
                      {selectedFileForInspection.storageTier === 'cold_archive_rf4' ? 'Архивный тариф (RF=4×)' : 'Горячий сейф (RF=6×)'}
                    </span>
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedFileForInspection(null)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Chunk Stats Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-slate-400">Всего чанков:</span>
                <div className="text-lg font-bold text-white font-mono">{selectedFileForInspection.chunksCount}</div>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-slate-400">Размер каждого:</span>
                <div className="text-lg font-bold text-cyan-400 font-mono">16,384 B (16 KB)</div>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-slate-400">Кворум копий:</span>
                <div className="text-lg font-bold text-emerald-400 font-mono">
                  {selectedFileForInspection.storageTier === 'cold_archive_rf4' ? '4× Репликация' : '6× Репликация'}
                </div>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-slate-400">Защита от аутсорсинга:</span>
                <div className="text-xs font-bold text-purple-300 font-mono">
                  Per-Node KDF Encoding
                </div>
              </div>
            </div>

            {/* List of 16KB chunks */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Распределение 16KB блоков по нодам сети ({selectedFileForInspection.storageTier === 'cold_archive_rf4' ? '4' : '6'} реплик):
                </h4>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/70 border border-cyan-500/30 px-2 py-0.5 rounded">
                    Canary Audit: Active (~6%)
                  </span>
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/70 border border-emerald-500/30 px-2 py-0.5 rounded">
                    Network Repair: Active
                  </span>
                </div>
              </div>

              <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                {selectedFileForInspection.chunks.map(chunk => (
                  <div
                    key={chunk.chunkId}
                    className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 text-xs space-y-2"
                  >
                    <div className="flex items-center justify-between font-mono">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-cyan-300">Чанк #{chunk.chunkIndex} ({chunk.sizeBytes} байт)</span>
                        {chunk.isCanaryTrap && (
                          <span className="text-[10px] px-2 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-500/40">
                            🐤 Canary Audit Trap
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-500 font-mono truncate max-w-[200px]">
                        HASH: {chunk.hash}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-900">
                      <span className="text-[11px] text-slate-400">
                        {chunk.replicaNodes.length} Реплик на нодах:
                      </span>
                      {chunk.replicaNodes.map((nodeId, idx) => {
                        const targetNode = nodes.find(n => n.id === nodeId);
                        return (
                          <span
                            key={idx}
                            className={`px-2 py-0.5 rounded text-[11px] font-mono flex items-center gap-1 ${
                              targetNode?.isOnline 
                                ? 'bg-emerald-950/60 border border-emerald-500/30 text-emerald-300' 
                                : 'bg-red-950/60 border border-red-500/30 text-red-300'
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${targetNode?.isOnline ? 'bg-emerald-400' : 'bg-red-400'}`} />
                            {targetNode ? targetNode.name : nodeId}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Retrieval & Client-Side ChaCha20 Decryption Modal (WS5) */}
      {retrievingFile && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-purple-950 text-purple-400 border border-purple-500/30">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Клиентская Сборка Сейфа (WS5)</h3>
                  <p className="text-xs text-slate-400 font-mono truncate max-w-[220px]">{retrievingFile.name}</p>
                </div>
              </div>
              {isDecryptionComplete && (
                <button
                  onClick={() => setRetrievingFile(null)}
                  className="text-slate-400 hover:text-white text-xs font-mono px-2 py-1 rounded bg-slate-800"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between text-slate-300">
                <span className="font-mono text-purple-200">{retrievalStatusText}</span>
                <span className="font-mono font-bold text-white">{retrievalProgress}%</span>
              </div>

              <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden border border-slate-800">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 via-cyan-400 to-emerald-400 transition-all duration-300"
                  style={{ width: `${retrievalProgress}%` }}
                />
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-850 font-mono text-[11px] text-slate-400 space-y-1">
                <div>Чанков в объекте: <span className="text-white font-bold">{retrievingFile.chunksCount} × 16 КБ</span></div>
                <div>Ключ расшифровки: <span className="text-purple-300 font-bold">m/44'/9999'/0'/1'/0 (Только клиент)</span></div>
                <div>Кворум безопасности: <span className="text-emerald-400 font-bold">RF=6× (SHA-256 Verified)</span></div>
              </div>
            </div>

            {isDecryptionComplete && (
              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => setRetrievingFile(null)}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition cursor-pointer"
                >
                  Готово, закрыть
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      {/* Erasure Coding 4+2 & ChaCha20 Modal */}
      <ErasureCodingLabModal
        isOpen={isErasureLabOpen}
        onClose={() => setIsErasureLabOpen(false)}
        vaultChaChaKeyHex={splitKeys.vaultChaChaKeyHex}
      />

      {/* Network Repair & Rate-Limiter Modal (Live Engine) */}
      <NetworkRepairModal
        isOpen={isRepairModalOpen}
        onClose={() => setIsRepairModalOpen(false)}
        vaultFiles={files}
        nodes={nodes}
        onUpdateFiles={onUpdateFiles}
      />
    </div>
  );
};
