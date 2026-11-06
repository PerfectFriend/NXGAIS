import React, { useState, useRef } from 'react';
import { 
  FileText, Camera, Flame, UserCheck, X, Upload, 
  ShieldAlert, Clock, Sparkles, Send, Lock
} from 'lucide-react';
import { triggerHaptic } from '../../utils/haptics';

export interface AttachmentBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectFile: (file: File) => void;
  onSendBurnerNote: (text: string, ttlSeconds: number) => void;
  onShareMyContact: () => void;
}

export const AttachmentBottomSheet: React.FC<AttachmentBottomSheetProps> = ({
  isOpen,
  onClose,
  onSelectFile,
  onSendBurnerNote,
  onShareMyContact,
}) => {
  const [activeMode, setActiveMode] = useState<'menu' | 'burner_composer'>('menu');
  const [burnerText, setBurnerText] = useState('');
  const [burnerTtl, setBurnerTtl] = useState<number>(30); // default 30s
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      triggerHaptic('medium');
      onSelectFile(file);
      onClose();
      setActiveMode('menu');
    }
  };

  const handleBurnerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!burnerText.trim()) return;
    triggerHaptic('success');
    onSendBurnerNote(burnerText.trim(), burnerTtl);
    setBurnerText('');
    setActiveMode('menu');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="fixed inset-0"
        onClick={() => {
          triggerHaptic('light');
          onClose();
          setActiveMode('menu');
        }}
      />

      <div className="relative w-full max-w-lg bg-slate-900 border-t border-slate-800 rounded-t-3xl p-4 sm:p-5 shadow-2xl z-10 animate-in slide-in-from-bottom duration-200">
        {/* Drag handle pill */}
        <div className="w-12 h-1.5 bg-slate-700/60 rounded-full mx-auto mb-4" />

        {/* Hidden native inputs */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
        />
        <input
          type="file"
          accept="image/*"
          capture="environment"
          ref={cameraInputRef}
          onChange={handleFileChange}
          className="hidden"
        />

        {activeMode === 'menu' ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold font-mono text-white flex items-center gap-2">
                  <span>Шторка вложений</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-500/30">
                    xFTP & E2EE
                  </span>
                </h3>
                <p className="text-[11px] font-mono text-slate-400">
                  Передача данных чанками по 16 Кб через Tor v3 Onion
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  onClose();
                }}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Grid of attachment actions */}
            <div className="grid grid-cols-2 gap-2.5 sm:gap-3 font-mono">
              {/* 1. File Upload */}
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  fileInputRef.current?.click();
                }}
                className="p-3 sm:p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 hover:border-cyan-500/50 hover:bg-slate-800/60 transition text-left space-y-2 group cursor-pointer active:scale-98"
              >
                <div className="w-9 h-9 rounded-xl bg-cyan-950/80 border border-cyan-500/40 flex items-center justify-center text-cyan-400 group-hover:scale-105 transition">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white">Документ / Файл</div>
                  <div className="text-[10px] text-slate-400">xFTP 16KB чанки (до 25MB)</div>
                </div>
              </button>

              {/* 2. Camera Snapshot */}
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  cameraInputRef.current?.click();
                }}
                className="p-3 sm:p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 hover:border-emerald-500/50 hover:bg-slate-800/60 transition text-left space-y-2 group cursor-pointer active:scale-98"
              >
                <div className="w-9 h-9 rounded-xl bg-emerald-950/80 border border-emerald-500/40 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition">
                  <Camera className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white">Фото с камеры</div>
                  <div className="text-[10px] text-slate-400">Мгновенный снимок E2EE</div>
                </div>
              </button>

              {/* 3. Burner Note (Self-destruct) */}
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setActiveMode('burner_composer');
                }}
                className="p-3 sm:p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 hover:border-red-500/50 hover:bg-slate-800/60 transition text-left space-y-2 group cursor-pointer active:scale-98"
              >
                <div className="w-9 h-9 rounded-xl bg-red-950/80 border border-red-500/40 flex items-center justify-center text-red-400 group-hover:scale-105 transition">
                  <Flame className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white">Сгорающая заметка</div>
                  <div className="text-[10px] text-slate-400">Уничтожение по таймеру</div>
                </div>
              </button>

              {/* 4. Share Sovereign Contact */}
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('medium');
                  onShareMyContact();
                  onClose();
                }}
                className="p-3 sm:p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 hover:border-purple-500/50 hover:bg-slate-800/60 transition text-left space-y-2 group cursor-pointer active:scale-98"
              >
                <div className="w-9 h-9 rounded-xl bg-purple-950/80 border border-purple-500/40 flex items-center justify-center text-purple-400 group-hover:scale-105 transition">
                  <UserCheck className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white">Карточка контакта</div>
                  <div className="text-[10px] text-slate-400">Onion v3 адрес + ключ</div>
                </div>
              </button>
            </div>
          </div>
        ) : (
          /* Burner Note Composer */
          <form onSubmit={handleBurnerSubmit} className="space-y-3 font-mono">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-red-400 animate-pulse" />
                <h3 className="text-xs sm:text-sm font-bold text-white">
                  Создание сгорающей заметки
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setActiveMode('menu');
                }}
                className="text-xs text-slate-400 hover:text-white cursor-pointer"
              >
                Назад
              </button>
            </div>

            <div>
              <label className="text-[11px] text-slate-400 block mb-1">
                Секретный текст (ChaCha20-Poly1305):
              </label>
              <textarea
                value={burnerText}
                onChange={e => setBurnerText(e.target.value)}
                placeholder="Секретные ключи, пароли или конфиденциальный текст..."
                rows={3}
                className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-red-500/60 resize-none"
                autoFocus
              />
            </div>

            {/* TTL Selection */}
            <div>
              <label className="text-[11px] text-slate-400 block mb-1.5 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>Время жизни до уничтожения (TTL):</span>
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { sec: 30, label: '30 сек' },
                  { sec: 300, label: '5 мин' },
                  { sec: 3600, label: '1 час' },
                  { sec: 86400, label: '24 ч' },
                ].map(opt => (
                  <button
                    key={opt.sec}
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      setBurnerTtl(opt.sec);
                    }}
                    className={`py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer ${
                      burnerTtl === opt.sec
                        ? 'bg-red-950 border-red-500 text-red-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={!burnerText.trim()}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 disabled:opacity-40 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition cursor-pointer"
            >
              <Flame className="w-4 h-4" />
              <span>Зашифровать и отправить заметку</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
