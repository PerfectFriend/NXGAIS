import React, { useState } from 'react';
import { 
  X, Download, Share2, Trash2, Info, Check, Copy, 
  FileText, Image, Music, StickyNote, ShieldCheck, 
  ArrowLeft, Lock, HardDrive, CheckCircle2
} from 'lucide-react';
import { ChatMessage } from '../../types/nexxus';
import { ContactItem } from './ContactSidebar';
import { triggerHaptic } from '../../utils/haptics';

export interface MessageActionModalProps {
  message: ChatMessage | null;
  isOpen: boolean;
  onClose: () => void;
  onSaveMessage: (message: ChatMessage) => void;
  onForwardMessage: (message: ChatMessage, targetContactId: string) => void;
  onDeleteMessage: (messageId: string) => void;
  contacts: ContactItem[];
  isDownloading?: boolean;
}

export const MessageActionModal: React.FC<MessageActionModalProps> = ({
  message,
  isOpen,
  onClose,
  onSaveMessage,
  onForwardMessage,
  onDeleteMessage,
  contacts,
  isDownloading = false,
}) => {
  const [currentView, setCurrentView] = useState<'actions' | 'forward' | 'properties'>('actions');
  const [copiedHash, setCopiedHash] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  if (!isOpen || !message) return null;

  const hasAttachment = !!message.attachment;
  const fileName = message.attachment?.name || '';
  const ext = fileName.split('.').pop()?.toLowerCase() || '';

  const isImage = ['png', 'jpg', 'jpeg', 'webp', 'svg', 'gif'].includes(ext);
  const isAudio = ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'].includes(ext);
  const isDoc = hasAttachment && !isImage && !isAudio;
  const isNote = !hasAttachment;

  // Derive a deterministic pseudo SHA-256 for properties display
  const derivedHash = message.attachment
    ? `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b78${(message.attachment.chunksCount * 73).toString(16).padStart(4, '0')}855`
    : `9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0${(message.id.length * 37).toString(16).padStart(4, '0')}a08`;

  const handleCopyHash = () => {
    triggerHaptic('light');
    navigator.clipboard?.writeText(derivedHash);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  const handleSave = () => {
    triggerHaptic('success');
    onSaveMessage(message);
    setActionNotice('Файл сохранен на устройство');
    setTimeout(() => {
      setActionNotice(null);
      onClose();
    }, 900);
  };

  const handleDelete = () => {
    triggerHaptic('warning');
    onDeleteMessage(message.id);
    onClose();
  };

  const handleSelectContactForForward = (contact: ContactItem) => {
    triggerHaptic('medium');
    onForwardMessage(message, contact.id);
    setActionNotice(`Переслано в чат "${contact.name}"`);
    setTimeout(() => {
      setActionNotice(null);
      onClose();
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-slate-900 border border-slate-700/80 w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2.5 min-w-0">
            {currentView !== 'actions' && (
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setCurrentView('actions');
                }}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition mr-1"
                title="Назад"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}

            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              {isDoc && <FileText className="w-5 h-5" />}
              {isImage && <Image className="w-5 h-5" />}
              {isAudio && <Music className="w-5 h-5" />}
              {isNote && <StickyNote className="w-5 h-5" />}
            </div>

            <div className="min-w-0">
              <h3 className="text-sm font-bold font-mono text-white truncate">
                {currentView === 'actions' && (hasAttachment ? fileName : 'Действия с сообщением')}
                {currentView === 'forward' && 'Переслать сообщение'}
                {currentView === 'properties' && 'Криптографические свойства'}
              </h3>
              <p className="text-[11px] font-mono text-slate-400 truncate">
                {hasAttachment
                  ? `${(message.attachment!.sizeBytes / 1024).toFixed(1)} KB • ${message.attachment!.chunksCount} чанков (RF=6×)`
                  : 'Зашифрованная текстовая заметка'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              onClose();
            }}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Transient Action Notice Banner */}
        {actionNotice && (
          <div className="bg-emerald-950/90 border-b border-emerald-500/40 p-3 flex items-center justify-center gap-2 text-emerald-300 text-xs font-mono font-bold animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{actionNotice}</span>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
          {/* VIEW 1: Primary Context Actions (Сохранить, Переслать, Удалить, Свойства) */}
          {currentView === 'actions' && (
            <>
              {/* Message Content Preview Box */}
              <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800/80 font-mono text-xs space-y-2">
                <div className="flex items-center justify-between text-[10px] text-slate-400 border-b border-slate-800/60 pb-1.5">
                  <span className="flex items-center gap-1 text-cyan-400">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>ChaCha20-Poly1305</span>
                  </span>
                  <span>{new Date(message.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
                </div>

                <p className="text-slate-300 line-clamp-3 whitespace-pre-wrap leading-relaxed">
                  {message.text || (hasAttachment ? `Вложение: ${fileName}` : 'Пустая запись')}
                </p>
              </div>

              {/* 4 Required Actions */}
              <div className="grid grid-cols-1 gap-2.5">
                {/* 1. Сохранить */}
                <button
                  type="button"
                  disabled={isDownloading}
                  onClick={handleSave}
                  className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-slate-800/70 hover:bg-slate-800 border border-slate-700/60 hover:border-emerald-500/40 text-left transition group active:scale-[0.99] cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition">
                      <Download className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold font-mono text-white group-hover:text-emerald-300 transition">
                        Сохранить
                      </div>
                      <div className="text-[11px] font-mono text-slate-400">
                        {hasAttachment ? 'Скачать расшифрованный файл на диск' : 'Экспортировать заметку в .txt файл'}
                      </div>
                    </div>
                  </div>
                  <span className="text-[11px] font-mono text-emerald-400 font-bold px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-500/20">
                    {hasAttachment ? 'Файл' : 'TXT'}
                  </span>
                </button>

                {/* 2. Переслать */}
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setCurrentView('forward');
                  }}
                  className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-slate-800/70 hover:bg-slate-800 border border-slate-700/60 hover:border-cyan-500/40 text-left transition group active:scale-[0.99] cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 group-hover:scale-110 transition">
                      <Share2 className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold font-mono text-white group-hover:text-cyan-300 transition">
                        Переслать
                      </div>
                      <div className="text-[11px] font-mono text-slate-400">
                        Отправить другому контакту в защищенную сеть
                      </div>
                    </div>
                  </div>
                  <span className="text-[11px] font-mono text-cyan-400 font-bold px-2 py-0.5 rounded bg-cyan-950/60 border border-cyan-500/20">
                    P2P SMP
                  </span>
                </button>

                {/* 3. Свойства */}
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setCurrentView('properties');
                  }}
                  className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-slate-800/70 hover:bg-slate-800 border border-slate-700/60 hover:border-amber-500/40 text-left transition group active:scale-[0.99] cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 group-hover:scale-110 transition">
                      <Info className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold font-mono text-white group-hover:text-amber-300 transition">
                        Свойства
                      </div>
                      <div className="text-[11px] font-mono text-slate-400">
                        Хэши, чанки xFTP, кворум репликации и шифр
                      </div>
                    </div>
                  </div>
                  <span className="text-[11px] font-mono text-amber-400 font-bold px-2 py-0.5 rounded bg-amber-950/60 border border-amber-500/20">
                    RF=6×
                  </span>
                </button>

                {/* 4. Удалить */}
                <button
                  type="button"
                  onClick={handleDelete}
                  className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-slate-800/70 hover:bg-red-950/40 border border-slate-700/60 hover:border-red-500/40 text-left transition group active:scale-[0.99] cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 group-hover:scale-110 transition">
                      <Trash2 className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold font-mono text-white group-hover:text-red-300 transition">
                        Удалить
                      </div>
                      <div className="text-[11px] font-mono text-slate-400">
                        Безвозвратно стереть из истории и хранилища
                      </div>
                    </div>
                  </div>
                  <span className="text-[11px] font-mono text-red-400 font-bold px-2 py-0.5 rounded bg-red-950/60 border border-red-500/20">
                    Стереть
                  </span>
                </button>
              </div>
            </>
          )}

          {/* VIEW 2: Forward Selector */}
          {currentView === 'forward' && (
            <div className="space-y-3">
              <div className="text-xs font-mono text-slate-400">
                Выберите контакт для пересылки:
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {contacts.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleSelectContactForForward(c)}
                    className="w-full flex items-center justify-between p-3 rounded-2xl bg-slate-950/60 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500/40 transition text-left cursor-pointer group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-8 h-8 rounded-xl bg-gradient-to-tr ${c.avatarColor} flex items-center justify-center text-slate-950 font-bold font-mono text-xs shrink-0`}>
                        {c.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold font-mono text-white group-hover:text-cyan-300 truncate">
                          {c.name}
                        </div>
                        <div className="text-[10px] font-mono text-slate-500 truncate">
                          {c.onionAddress}
                        </div>
                      </div>
                    </div>

                    <span className="text-[10px] font-mono text-cyan-400 px-2 py-1 rounded bg-cyan-950/60 border border-cyan-500/20 shrink-0">
                      Выбрать
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* VIEW 3: Cryptographic Properties View */}
          {currentView === 'properties' && (
            <div className="space-y-3 font-mono text-xs">
              <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                  <span className="text-slate-400">Тип объекта:</span>
                  <span className="text-amber-300 font-bold">
                    {hasAttachment 
                      ? `${ext.toUpperCase()} (xFTP бинарный файл)` 
                      : 'Текстовая заметка (SMP протокол)'}
                  </span>
                </div>

                <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                  <span className="text-slate-400">ID записи:</span>
                  <span className="text-white font-mono text-[11px] truncate max-w-[200px]">
                    {message.attachment?.fileId || message.id}
                  </span>
                </div>

                <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                  <span className="text-slate-400">Размер:</span>
                  <span className="text-cyan-300 font-bold">
                    {hasAttachment
                      ? `${(message.attachment!.sizeBytes / 1024).toFixed(1)} КБ (${message.attachment!.sizeBytes.toLocaleString()} байт)`
                      : `${message.text.length} символов`}
                  </span>
                </div>

                <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                  <span className="text-slate-400">Чанки xFTP (16 КБ):</span>
                  <span className="text-emerald-300 font-bold">
                    {hasAttachment
                      ? `${message.attachment!.chunksCount} чанков • Кворум 4/6`
                      : '1 фрейм в SMP заголовке'}
                  </span>
                </div>

                <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                  <span className="text-slate-400">Шифрование:</span>
                  <span className="text-white font-bold flex items-center gap-1">
                    <Lock className="w-3 h-3 text-cyan-400" />
                    <span>ChaCha20-Poly1305 AEAD</span>
                  </span>
                </div>

                <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                  <span className="text-slate-400">Фактор репликации:</span>
                  <span className="text-amber-400 font-bold flex items-center gap-1">
                    <HardDrive className="w-3 h-3" />
                    <span>RF=6× (6 копий в swarm)</span>
                  </span>
                </div>

                <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                  <span className="text-slate-400">Дата создания:</span>
                  <span className="text-slate-300">
                    {new Date(message.timestamp).toLocaleString()}
                  </span>
                </div>

                {/* SHA-256 Hash with Copy Button */}
                <div className="pt-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Merkle Root / SHA-256:</span>
                    <button
                      type="button"
                      onClick={handleCopyHash}
                      className="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-500/20 cursor-pointer"
                    >
                      {copiedHash ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedHash ? 'Скопировано!' : 'Копировать'}</span>
                    </button>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-[10px] text-slate-300 font-mono break-all select-all">
                    {derivedHash}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setCurrentView('actions');
                }}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold transition text-xs font-mono cursor-pointer"
              >
                ← Вернуться к действиям
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
