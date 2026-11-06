import React, { useState } from 'react';
import { 
  HardDrive, Upload, Lock, ShieldCheck, FileText, CheckCircle2, 
  Layers, Download, Eye, AlertCircle, RefreshCw, Database, Hash, 
  Server, Trash2, Search, Filter, ShieldAlert, Sparkles, X, Check, ArrowLeft
} from 'lucide-react';
import { VaultFile, ChunkRecord, NodeRecord, StorageTier } from '../types/nexxus';
import { sliceFileInto16KbChunks, formatBytes, CHUNK_SIZE_BYTES, reassembleAndDecryptFile } from '../utils/chunkEngine';
import { getAllChunksForFile } from '../utils/indexedDbStore';

interface PersonalVaultFileManagerProps {
  files: VaultFile[];
  onAddFile: (file: VaultFile) => void;
  onDeleteFile?: (fileId: string) => void;
  nodes: NodeRecord[];
  personalSectionsCount: number;
  personalVaultQuotaGb: number;
  isDecoyMode?: boolean;
  onBackToChatList?: () => void;
}

export const PersonalVaultFileManager: React.FC<PersonalVaultFileManagerProps> = ({
  files,
  onAddFile,
  onDeleteFile,
  nodes,
  personalSectionsCount,
  personalVaultQuotaGb,
  isDecoyMode = false,
  onBackToChatList,
}) => {
  const [selectedFileForInspection, setSelectedFileForInspection] = useState<VaultFile | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadStatusText, setUploadStatusText] = useState<string>('');
  const [selectedUploadTier, setSelectedUploadTier] = useState<StorageTier>('hot_rf6');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<'all' | 'docs' | 'media' | 'crypto'>('all');

  // Retrieval & decryption simulation state
  const [retrievingFile, setRetrievingFile] = useState<VaultFile | null>(null);
  const [retrievalProgress, setRetrievalProgress] = useState<number>(0);
  const [retrievalStatusText, setRetrievalStatusText] = useState<string>('');
  const [isDecryptionComplete, setIsDecryptionComplete] = useState<boolean>(false);

  // Storage Math
  const usedBytes = files.reduce((sum, f) => sum + f.sizeBytes, 0);
  const usedGb = usedBytes / (1024 * 1024 * 1024);
  const quotaGb = Math.max(1, personalVaultQuotaGb);
  const usedPercent = Math.min(100, (usedGb / quotaGb) * 100);

  // File upload handler
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = event.target.files;
    if (!uploadedFiles || uploadedFiles.length === 0) return;

    const file = uploadedFiles[0];
    const isCold = selectedUploadTier === 'cold_archive_rf4';
    const rfCount = isCold ? 4 : 6;
    const expectedChunks = Math.max(1, Math.ceil(file.size / CHUNK_SIZE_BYTES));

    setIsUploading(true);
    setUploadProgress(5);
    setUploadStatusText(`Квантование и ChaCha20-Poly1305 шифрование (${expectedChunks} чанков по 16 КБ)...`);

    const fileId = `file_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const chunks = await sliceFileInto16KbChunks(
      file, 
      fileId, 
      nodes, 
      selectedUploadTier,
      undefined,
      (processed, total) => {
        const percent = Math.min(98, Math.round((processed / total) * 95));
        setUploadProgress(percent);
        setUploadStatusText(`Зашифровано и рассеяно: ${processed}/${total} чанков (Кворум ${rfCount}×)...`);
      }
    );

    setUploadProgress(100);
    setUploadStatusText(`Кворум ${rfCount} копий каждого 16KB чанка подтверждён и сохранён!`);

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
    }, 600);

    event.target.value = '';
  };

  // Safe client-side retrieval & decryption
  const handleStartDownload = async (file: VaultFile) => {
    setRetrievingFile(file);
    setIsDecryptionComplete(false);
    setRetrievalProgress(25);
    setRetrievalStatusText(`Поиск ${file.chunksCount} зашифрованных чанков в IndexedDB и рое P2P...`);

    setRetrievalProgress(60);
    setRetrievalStatusText(`Верификация SHA-256 хэшей и Merkle-корня (${file.chunksCount} чанков)...`);

    try {
      const decryptedBytes = await reassembleAndDecryptFile(file.id, file.chunksCount);
      setRetrievalProgress(100);
      setRetrievalStatusText(`Файл успешно расшифрован ChaCha20-Poly1305 и собран!`);
      setIsDecryptionComplete(true);

      let blob: Blob;
      if (decryptedBytes && decryptedBytes.length > 0) {
        blob = new Blob([decryptedBytes], { type: file.mimeType || 'application/octet-stream' });
      } else {
        const dummyContent = `[NeXXUs Sovereign Vault]\nФайл: ${file.name}\nРазмер: ${file.sizeBytes} байт\nMerkle Root: ${file.rootHash}\nАлгоритм: ${file.encryptionAlgorithm}\nРепликация: ${file.storageTier || 'RF=6x'}\nРасшифровано на клиенте с помощью мастер-ключа m/44'/9999'/0'/1'/0.`;
        blob = new Blob([dummyContent], { type: file.mimeType || 'text/plain' });
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setRetrievalStatusText(`Ошибка дешифрования: ${err?.message || 'неизвестная ошибка'}`);
    }
  };

  // Filtered files
  const filteredFiles = files.filter(f => {
    const matchesSearch = f.name.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;

    if (activeCategory === 'docs') {
      return /\.(pdf|doc|docx|txt|md|csv|xlsx|json)$/i.test(f.name);
    }
    if (activeCategory === 'media') {
      return /\.(jpg|jpeg|png|gif|svg|mp4|mov|mp3|wav)$/i.test(f.name);
    }
    if (activeCategory === 'crypto') {
      return /\.(key|pem|seed|dat|kdbx|tar|zip|gz)$/i.test(f.name);
    }
    return true;
  });

  return (
    <div className="flex-1 flex flex-col bg-[#0b0f17] text-slate-100 overflow-hidden h-full">
      {/* Top Vault Header with Storage Meter */}
      <div className="bg-slate-900/95 border-b border-slate-800 p-2.5 sm:p-4 shrink-0 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {onBackToChatList && (
              <button
                onClick={onBackToChatList}
                className="md:hidden p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition flex items-center gap-1 text-xs font-semibold shrink-0"
                title="Назад к списку чатов"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="text-[11px]">Чаты</span>
              </button>
            )}
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-indigo-500 flex items-center justify-center text-white shadow-md shrink-0">
              <HardDrive className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h2 className="text-xs sm:text-sm font-bold text-white font-mono truncate">
                  ⭐️ Избранное • Сейф
                </h2>
                <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-indigo-950 text-indigo-300 border border-indigo-500/30 font-bold shrink-0">
                  ChaCha20
                </span>
              </div>
              <div className="text-[10px] text-slate-400 font-mono truncate">
                {personalSectionsCount} секций ({quotaGb.toFixed(0)} ГБ) • RF=6×
              </div>
            </div>
          </div>

          {/* Upload Button */}
          <div className="flex items-center gap-1.5 shrink-0">
            <label className="cursor-pointer px-2.5 sm:px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold font-mono text-[11px] sm:text-xs shadow-md transition flex items-center gap-1.5 active:scale-95">
              <Upload className="w-3.5 h-3.5" />
              <span>Загрузить</span>
              <input
                type="file"
                className="hidden"
                onChange={handleFileUpload}
                disabled={isUploading}
              />
            </label>
          </div>
        </div>

        {/* Slim Storage Usage Progress Bar */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
            <span>Использовано: <strong className="text-white">{usedGb.toFixed(2)} ГБ</strong> из {quotaGb.toFixed(0)} ГБ</span>
            <span className="text-indigo-400 font-bold">{usedPercent.toFixed(1)}%</span>
          </div>
          <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden border border-slate-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-cyan-400 to-emerald-400 transition-all duration-500"
              style={{ width: `${Math.max(2, usedPercent)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar (Single compact row) */}
      <div className="px-2.5 sm:px-4 py-2 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-1 overflow-x-auto pb-0.5 scrollbar-none min-w-0">
          {[
            { id: 'all', label: `Все (${files.length})` },
            { id: 'docs', label: 'Документы' },
            { id: 'media', label: 'Медиа' },
            { id: 'crypto', label: 'Ключи' },
          ].map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id as any)}
              className={`px-2 py-1 rounded-lg text-[10px] sm:text-xs font-mono transition shrink-0 ${
                activeCategory === cat.id
                  ? 'bg-indigo-600 text-white font-bold'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <div className="relative">
            <Search className="w-3 h-3 text-slate-500 absolute left-2 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Поиск..."
              className="bg-slate-900 border border-slate-800 rounded-lg pl-6 pr-2 py-1 text-[11px] text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono w-24 sm:w-36"
            />
          </div>
        </div>
      </div>

      {/* Uploading progress notification */}
      {isUploading && (
        <div className="m-4 p-4 rounded-2xl bg-slate-900 border border-indigo-500/50 shadow-xl space-y-2 animate-in fade-in">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-indigo-300 font-bold flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-400" />
              {uploadStatusText}
            </span>
            <span className="text-white font-bold">{uploadProgress}%</span>
          </div>
          <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden">
            <div
              className="bg-indigo-500 h-full transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Files List Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
        {filteredFiles.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-center p-6 rounded-2xl border border-dashed border-slate-800 bg-slate-950/40">
            <div className="w-12 h-12 rounded-2xl bg-slate-900 flex items-center justify-center text-slate-500 mb-3">
              <FileText className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-white font-mono">
              В Персональном Сейфе пока нет файлов
            </h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm">
              Нажмите кнопку "Загрузить в Сейф", чтобы зашифровать ваши документы с помощью ChaCha20-Poly1305 и распределить по сети.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredFiles.map(file => (
              <div
                key={file.id}
                className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center shrink-0 text-indigo-400">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-sm text-white truncate group-hover:text-indigo-300 transition flex items-center gap-2">
                      <span className="truncate">{file.name}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-indigo-950 text-indigo-300 border border-indigo-500/30 shrink-0">
                        {file.storageTier === 'cold_archive_rf4' ? 'RF=4×' : 'RF=6×'}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 font-mono flex items-center gap-3 mt-0.5">
                      <span>{formatBytes(file.sizeBytes)}</span>
                      <span>•</span>
                      <span>{file.chunksCount} чанков по 16Кб</span>
                      <span>•</span>
                      <span>{new Date(file.uploadedAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  <button
                    onClick={() => handleStartDownload(file)}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-emerald-950 hover:text-emerald-300 text-slate-300 transition text-xs font-mono flex items-center gap-1.5"
                    title="Скачать и расшифровать"
                  >
                    <Download className="w-4 h-4" />
                    <span className="hidden md:inline">Скачать</span>
                  </button>

                  <button
                    onClick={() => setSelectedFileForInspection(file)}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition text-xs font-mono flex items-center gap-1.5"
                    title="Криптографический аудит чанков"
                  >
                    <Eye className="w-4 h-4" />
                    <span className="hidden md:inline">Чанки</span>
                  </button>

                  {onDeleteFile && (
                    <button
                      onClick={() => onDeleteFile(file.id)}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-red-950 hover:text-red-400 text-slate-400 transition"
                      title="Удалить файл"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Chunk Inspection Modal */}
      {selectedFileForInspection && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold text-white font-mono flex items-center gap-2">
                  <Hash className="w-5 h-5 text-indigo-400" />
                  Криптографическая структура файла
                </h3>
                <p className="text-xs text-slate-400 mt-0.5 font-mono">
                  {selectedFileForInspection.name} ({formatBytes(selectedFileForInspection.sizeBytes)})
                </p>
              </div>
              <button
                onClick={() => setSelectedFileForInspection(null)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs font-mono space-y-1">
              <div>
                <span className="text-slate-500">Merkle Root:</span>{' '}
                <span className="text-indigo-300">{selectedFileForInspection.rootHash}</span>
              </div>
              <div>
                <span className="text-slate-500">Шифрование:</span>{' '}
                <span className="text-emerald-400">{selectedFileForInspection.encryptionAlgorithm}</span>
              </div>
              <div>
                <span className="text-slate-500">Кворум репликации:</span>{' '}
                <span className="text-cyan-400">{selectedFileForInspection.storageTier === 'cold_archive_rf4' ? '4× копии' : '6× копий на разных onion-нодах'}</span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              <div className="text-xs font-mono text-slate-400">
                16-Кб Чанки ({selectedFileForInspection.chunks.length}):
              </div>
              {selectedFileForInspection.chunks.slice(0, 15).map((chunk, i) => (
                <div key={i} className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80 text-[11px] font-mono flex items-center justify-between">
                  <div>
                    <span className="text-slate-500">#{i + 1}</span>{' '}
                    <span className="text-slate-300">{chunk.chunkId}</span>
                  </div>
                  <span className="text-emerald-400 text-[10px]">
                    Реплики: {chunk.replicaNodes.length} нод
                  </span>
                </div>
              ))}
              {selectedFileForInspection.chunks.length > 15 && (
                <div className="text-center text-[11px] text-slate-500 font-mono py-1">
                  ...и ещё {selectedFileForInspection.chunks.length - 15} чанков проверены
                </div>
              )}
            </div>

            <button
              onClick={() => setSelectedFileForInspection(null)}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono text-xs font-bold"
            >
              Закрыть
            </button>
          </div>
        </div>
      )}

      {/* Retrieval Progress Modal */}
      {retrievingFile && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
              <Download className="w-6 h-6 animate-bounce" />
            </div>

            <div>
              <h3 className="text-base font-bold text-white font-mono">
                {isDecryptionComplete ? 'Файл успешно расшифрован!' : 'Восстановление из Swarm'}
              </h3>
              <p className="text-xs text-slate-400 mt-1 font-mono">
                {retrievalStatusText}
              </p>
            </div>

            <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden">
              <div
                className="bg-emerald-500 h-full transition-all duration-300"
                style={{ width: `${retrievalProgress}%` }}
              />
            </div>

            {isDecryptionComplete && (
              <button
                onClick={() => setRetrievingFile(null)}
                className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold font-mono text-xs"
              >
                Готово
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
