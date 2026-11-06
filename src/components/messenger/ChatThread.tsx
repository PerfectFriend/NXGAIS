import React, { useRef, useEffect, useState } from 'react';
import { 
  CheckCheck, Download, RefreshCw, FileText, 
  Flame, Clock, ShieldAlert, Sparkles, Smile, MoreHorizontal 
} from 'lucide-react';
import { ChatMessage } from '../../types/nexxus';
import { triggerHaptic } from '../../utils/haptics';

export interface ChatThreadProps {
  messages: ChatMessage[];
  contactName: string;
  downloadingFileId: string | null;
  onDownloadAttachment: (attachment: {
    fileId: string;
    name: string;
    chunksCount: number;
    sizeBytes: number;
  }) => Promise<void>;
  onToggleReaction?: (messageId: string, emoji: string) => void;
  onRevealBurnerNote?: (messageId: string) => void;
  onOpenMessageAction?: (message: ChatMessage) => void;
}

const QUICK_REACTIONS = ['⚡️', '🛡️', '🔥', '👍'];

/**
 * ChatThread displays the scrollable message stream, rendering E2EE text messages,
 * xFTP chunked file attachments, decrypted voice notes, and self-destructing burner cards.
 *
 * @param {ChatThreadProps} props - Component properties and event handlers.
 * @returns {React.ReactElement} The rendered chat stream container.
 */
export const ChatThread: React.FC<ChatThreadProps> = ({
  messages,
  contactName,
  downloadingFileId,
  onDownloadAttachment,
  onToggleReaction,
  onRevealBurnerNote,
  onOpenMessageAction,
}) => {
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const [activeReactionMenuId, setActiveReactionMenuId] = useState<string | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-3 sm:space-y-4">
      {messages.length === 0 ? (
        <div className="h-full flex flex-col items-center justify-center text-slate-500 font-mono text-xs space-y-2">
          <span>История сообщений с {contactName} пуста.</span>
          <span>Все сообщения шифруются ChaCha20-Poly1305 и передаются по Tor v3.</span>
        </div>
      ) : (
        messages.map(msg => {
          const isMe = msg.senderId === 'current_user';
          const isBurner = !!msg.burner;
          const isBurned = msg.burner?.isBurned;
          const secondsRemaining = msg.burner?.expiresAt
            ? Math.max(0, Math.ceil((msg.burner.expiresAt - Date.now()) / 1000))
            : null;

          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} space-y-1 group relative`}
            >
              <div className="text-[10px] font-mono text-slate-500 flex items-center gap-1 px-1">
                <span>{isMe ? 'Вы' : msg.senderName}</span>
                <span>•</span>
                <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                <span>•</span>
                <span className="text-emerald-400 font-bold">{msg.protocol}</span>
                {isBurner && (
                  <span className="text-red-400 flex items-center gap-0.5 ml-1">
                    <Flame className="w-3.5 h-3.5" />
                    <span>TTL {msg.burner?.ttlSeconds}с</span>
                  </span>
                )}
              </div>

              {/* Message Bubble Container */}
              <div className="relative max-w-[88%] sm:max-w-md">
                <div
                  className={`p-3 sm:p-3.5 rounded-2xl text-xs font-mono leading-relaxed shadow-lg transition-all cursor-pointer ${
                    isBurned
                      ? 'bg-slate-950/90 border border-red-950/60 text-slate-500 italic'
                      : isBurner
                      ? 'bg-gradient-to-tr from-red-950/70 to-slate-900 border border-red-500/40 text-red-100'
                      : isMe
                      ? 'bg-gradient-to-tr from-cyan-950/80 to-slate-900 border border-cyan-500/30 text-cyan-100 rounded-tr-none'
                      : 'bg-slate-900/95 border border-slate-800 text-slate-200 rounded-tl-none'
                  }`}
                  onClick={() => {
                    if (onOpenMessageAction) {
                      triggerHaptic('light');
                      onOpenMessageAction(msg);
                    } else {
                      setActiveReactionMenuId(activeReactionMenuId === msg.id ? null : msg.id);
                    }
                  }}
                  onContextMenu={e => {
                    if (onOpenMessageAction) {
                      e.preventDefault();
                      triggerHaptic('medium');
                      onOpenMessageAction(msg);
                    }
                  }}
                >
                  {/* Burner Note Card */}
                  {isBurner ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-[11px] pb-1 border-b border-red-500/20 font-bold">
                        <span className="flex items-center gap-1.5 text-red-400">
                          <Flame className="w-3.5 h-3.5 animate-pulse" />
                          <span>Сгорающее E2EE сообщение</span>
                        </span>
                        {!isBurned && secondsRemaining !== null && (
                          <span className="text-[10px] text-amber-300 font-mono bg-red-950/80 px-1.5 py-0.5 rounded border border-red-500/30">
                            {secondsRemaining} сек
                          </span>
                        )}
                      </div>

                      {isBurned ? (
                        <p className="text-slate-500 italic flex items-center gap-1">
                          <Flame className="w-3.5 h-3.5 text-slate-600" />
                          <span>Содержимое уничтожено безвозвратно.</span>
                        </p>
                      ) : (
                        <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                      )}
                    </div>
                  ) : (
                    /* Regular Text */
                    <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                  )}

                  {/* xFTP File Attachment Card */}
                  {msg.attachment && !isBurned && (
                    <div 
                      onClick={e => {
                        if (onOpenMessageAction) {
                          e.stopPropagation();
                          triggerHaptic('light');
                          onOpenMessageAction(msg);
                        }
                      }}
                      className="mt-2.5 p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-amber-500/40 transition flex items-center justify-between gap-3 group/att"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-emerald-950 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 group-hover/att:scale-105 transition">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-white font-bold truncate text-[11px]">
                            {msg.attachment.name}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate">
                            {(msg.attachment.sizeBytes / 1024).toFixed(1)} KB • {msg.attachment.chunksCount} чанков (RF=6×)
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={downloadingFileId === msg.attachment.fileId}
                        onClick={e => {
                          e.stopPropagation();
                          triggerHaptic('medium');
                          onDownloadAttachment(msg.attachment!);
                        }}
                        className="p-1.5 sm:px-2.5 sm:py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white text-[11px] font-bold transition flex items-center gap-1 shrink-0 cursor-pointer active:scale-95"
                      >
                        {downloadingFileId === msg.attachment.fileId ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span className="hidden sm:inline">Сборка...</span>
                          </>
                        ) : (
                          <>
                            <Download className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Скачать</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {/* Message Status & Action Trigger */}
                  <div className="mt-1 flex items-center justify-end gap-1.5 text-[10px] text-slate-400">
                    {msg.isRelayedViaPrivateServer && (
                      <span className="text-emerald-400">Onion Relay</span>
                    )}
                    <CheckCheck className="w-3.5 h-3.5 text-cyan-400" />
                    {onOpenMessageAction && (
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          triggerHaptic('light');
                          onOpenMessageAction(msg);
                        }}
                        className="p-0.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
                        title="Действия (Сохранить/Переслать/Удалить/Свойства)"
                      >
                        <MoreHorizontal className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Displayed reaction pill */}
                {msg.reaction && (
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      triggerHaptic('light');
                      if (onToggleReaction) onToggleReaction(msg.id, msg.reaction!);
                    }}
                    className="absolute -bottom-2 right-2 px-1.5 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-xs shadow-md transition hover:scale-110 active:scale-95 cursor-pointer z-10"
                  >
                    <span>{msg.reaction}</span>
                  </button>
                )}

                {/* Interactive Quick Reaction Picker */}
                {activeReactionMenuId === msg.id && onToggleReaction && (
                  <div className="absolute -top-9 z-20 flex items-center gap-1 bg-slate-900 border border-slate-700 p-1 rounded-2xl shadow-xl animate-in zoom-in-95 duration-150">
                    {QUICK_REACTIONS.map(emoji => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          triggerHaptic('medium');
                          onToggleReaction(msg.id, emoji);
                          setActiveReactionMenuId(null);
                        }}
                        className="w-7 h-7 flex items-center justify-center rounded-xl hover:bg-slate-800 text-xs transition hover:scale-125 cursor-pointer"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })
      )}
      <div ref={messagesEndRef} />
    </div>
  );
};
