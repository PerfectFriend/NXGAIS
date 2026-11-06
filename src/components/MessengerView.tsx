import React, { useState, useRef, useMemo } from 'react';
import { 
  ArrowLeft, Shield, Globe, Server, CheckCheck, 
  Terminal, Lock, Search, Filter, FileText, Image, 
  Music, StickyNote, X, HardDrive, Star, Sparkles,
  Layers, CheckCircle2
} from 'lucide-react';
import { ChatMessage, NodeRecord, Bip39Identity, VaultFile } from '../types/nexxus';
import { NavigationDrawer } from './messenger/NavigationDrawer';
import { ContactSidebar, ContactItem } from './messenger/ContactSidebar';
import { ChatThread } from './messenger/ChatThread';
import { MessageComposer } from './messenger/MessageComposer';
import { MessageActionModal } from './messenger/MessageActionModal';
import { ContactManagerModal } from './ContactManagerModal';
import { NetworkSettingsModal } from './NetworkSettingsModal';
import { useAttachmentDownloader } from '../hooks/useAttachmentDownloader';
import { triggerHaptic } from '../utils/haptics';

export interface MessengerViewProps {
  messages: ChatMessage[];
  onSendMessage: (
    text: string, 
    attachment?: { name: string; sizeBytes: number; chunksCount: number; fileId: string },
    burner?: { ttlSeconds: number },
    recipientId?: string
  ) => void;
  onDeleteMessage?: (messageId: string) => void;
  onForwardMessage?: (messageId: string, targetRecipientId: string) => void;
  onToggleReaction?: (messageId: string, emoji: string) => void;
  onRevealBurnerNote?: (messageId: string) => void;
  currentNode: NodeRecord;
  onTogglePrivateServer: () => void;
  identity: Bip39Identity;
  files: VaultFile[];
  onAddFile: (file: VaultFile) => void;
  onDeleteFile?: (fileId: string) => void;
  nodes: NodeRecord[];
  personalSectionsCount: number;
  personalVaultQuotaGb: number;
  onOpenDrawerTab: (
    tab: 'sections' | 'fleet' | 'appstore' | 'dex' | 'security' | 'manual' | 'splash' | 'health' | 'node'
  ) => void;
  onQuickLock: () => void;
  onSwitchAccount?: () => void;
  isDecoyMode?: boolean;
}

const INITIAL_CONTACTS: ContactItem[] = [
  {
    id: 'vault_favorites',
    name: '⭐️ Избранное (Хранилище)',
    isVault: true,
    onionAddress: 'Зашифрованный анклав (RF=6×)',
    avatarColor: 'from-amber-400 to-amber-600',
    status: 'encrypted_vault',
    lastSeen: 'Локально',
  },
  {
    id: 'contact_alice',
    name: 'Alice (Guardian #4)',
    onionAddress: 'alice4p8q1w4e7r0t2y5u8i1o4p7a0s3d6f9g2h5j8k1l4z7x0c.onion:9050',
    avatarColor: 'from-emerald-400 to-cyan-500',
    status: 'online',
    lastSeen: 'Сейчас в сети',
  },
  {
    id: 'contact_bob',
    name: 'Bob (Desktop Station)',
    onionAddress: 'bob7y2u5i8o1p4a7s0d3f6g9h2j5k8l1z4x7c0v3b6n9m2q5.onion:9050',
    avatarColor: 'from-blue-400 to-indigo-500',
    status: 'online',
    lastSeen: '5 мин назад',
  },
  {
    id: 'contact_charlie',
    name: 'Charlie (Archive Node)',
    onionAddress: 'charlie9z8x7c6v5b4n3m2l1k0j9h8g7f6d5s4a3p2o1i0u.onion:9050',
    avatarColor: 'from-purple-400 to-pink-500',
    status: 'relay_connected',
    lastSeen: '1 час назад',
  },
];

type DocumentTypeFilter = 'all' | 'docs' | 'photos' | 'audio' | 'notes';

/**
 * MessengerView coordinates the full encrypted messaging experience.
 * For "⭐️ Избранное (Хранилище)", it uses the exact same chat interface as peer chats,
 * enriched with a document type filter bar, keyword search, and context actions
 * (Сохранить / Переслать / Удалить / Свойства) on message/document click.
 */
export const MessengerView: React.FC<MessengerViewProps> = ({
  messages,
  onSendMessage,
  onDeleteMessage,
  onForwardMessage,
  onToggleReaction,
  onRevealBurnerNote,
  currentNode,
  onTogglePrivateServer,
  identity,
  files,
  onAddFile,
  onDeleteFile,
  nodes,
  personalSectionsCount,
  personalVaultQuotaGb,
  onOpenDrawerTab,
  onQuickLock,
  onSwitchAccount,
  isDecoyMode = false,
}) => {
  const [selectedId, setSelectedId] = useState<string>('vault_favorites');
  const [isMobileChatOpen, setIsMobileChatOpen] = useState<boolean>(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [isNetworkModalOpen, setIsNetworkModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeContactsList, setActiveContactsList] = useState<ContactItem[]>(INITIAL_CONTACTS);

  // In-chat Document Type Filter & Text Search state
  const [vaultTypeFilter, setVaultTypeFilter] = useState<DocumentTypeFilter>('all');
  const [vaultSearchQuery, setVaultSearchQuery] = useState<string>('');

  // Context Action Modal state (Сохранить / Переслать / Удалить / Свойства)
  const [actionMessage, setActionMessage] = useState<ChatMessage | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const { downloadingFileId, downloadAttachment } = useAttachmentDownloader();

  const isVaultRoom = selectedId === 'vault_favorites';

  // Mobile Swipe-to-Back Gesture Tracking
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      touchStartXRef.current = e.touches[0].clientX;
      touchStartYRef.current = e.touches[0].clientY;
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null || touchStartYRef.current === null) return;
    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    const deltaX = endX - touchStartXRef.current;
    const deltaY = endY - touchStartYRef.current;

    // Horizontal rightward swipe (native back gesture)
    if (deltaX > 70 && Math.abs(deltaY) < 55 && isMobileChatOpen) {
      triggerHaptic('light');
      setIsMobileChatOpen(false);
    }
    touchStartXRef.current = null;
    touchStartYRef.current = null;
  };

  const handleSelectContact = (id: string) => {
    triggerHaptic('light');
    setSelectedId(id);
    setIsMobileChatOpen(true);
    // Reset filters when switching rooms
    setVaultTypeFilter('all');
    setVaultSearchQuery('');
  };

  const handleBackToChatList = () => {
    triggerHaptic('light');
    setIsMobileChatOpen(false);
  };

  const handleAddNewContact = (newContact: { name: string; onionAddress: string }) => {
    triggerHaptic('success');
    const contactItem: ContactItem = {
      id: `contact_${Date.now()}`,
      name: newContact.name,
      onionAddress: newContact.onionAddress,
      avatarColor: 'from-cyan-400 to-emerald-500',
      status: 'online',
      lastSeen: 'Только что добавлен',
    };
    setActiveContactsList(prev => [...prev, contactItem]);
    setSelectedId(contactItem.id);
    setIsMobileChatOpen(true);
  };

  const handleShareMyContact = () => {
    handleSendMessage(
      `📇 Карточка контакта NeXXus Enclave:\nИмя: ${identity.accountAddress.slice(0, 10)}\nOnion: ${currentNode.onionAddress}\nАдрес: ${identity.accountAddress}`
    );
  };

  // Dispatch message with proper recipientId
  const handleSendMessage = (
    text: string, 
    attachment?: { name: string; sizeBytes: number; chunksCount: number; fileId: string },
    burner?: { ttlSeconds: number }
  ) => {
    if (isVaultRoom) {
      // If sending a file attachment in Personal Vault, register it in files state
      if (attachment) {
        const ext = attachment.name.split('.').pop()?.toLowerCase() || '';
        let mimeType = 'application/octet-stream';
        if (['png', 'jpg', 'jpeg', 'webp', 'svg', 'gif'].includes(ext)) mimeType = `image/${ext}`;
        else if (['mp3', 'wav', 'ogg', 'm4a'].includes(ext)) mimeType = `audio/${ext}`;
        else if (ext === 'pdf') mimeType = 'application/pdf';

        onAddFile({
          id: attachment.fileId,
          name: attachment.name,
          sizeBytes: attachment.sizeBytes,
          mimeType,
          chunksCount: attachment.chunksCount,
          uploadedAt: Date.now(),
          encryptionAlgorithm: 'ChaCha20-Poly1305',
          storageTier: 'hot_rf6',
          rootHash: Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join(''),
          chunks: [],
        });
      }
      onSendMessage(text, attachment, burner, 'vault_favorites');
    } else {
      onSendMessage(text, attachment, burner, selectedId);
    }
  };

  // Context Actions Handler: Save
  const handleSaveMessage = async (msg: ChatMessage) => {
    if (msg.attachment) {
      await downloadAttachment(msg.attachment);
    } else {
      // Plain text note export
      const content = `[NeXXus Enclave Decrypted Note]\nID: ${msg.id}\nДата: ${new Date(msg.timestamp).toISOString()}\nПротокол: ${msg.protocol}\n\n${msg.text}`;
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `note_${new Date(msg.timestamp).toISOString().slice(0, 10)}_${msg.id.slice(-4)}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  // Context Actions Handler: Forward
  const handleForwardMessage = (msg: ChatMessage, targetContactId: string) => {
    if (onForwardMessage) {
      onForwardMessage(msg.id, targetContactId);
    } else {
      onSendMessage(
        msg.text ? `[Переслано]: ${msg.text}` : `[Пересланный файл: ${msg.attachment?.name}]`,
        msg.attachment ? { ...msg.attachment } : undefined,
        undefined,
        targetContactId
      );
    }
    const targetContact = activeContactsList.find(c => c.id === targetContactId);
    showToast(`Переслано в чат "${targetContact?.name || targetContactId}"`);
  };

  // Context Actions Handler: Delete
  const handleDeleteMessage = (messageId: string) => {
    if (onDeleteMessage) {
      onDeleteMessage(messageId);
    }
    // If the message had an attachment, also delete from files list
    const msg = messages.find(m => m.id === messageId);
    if (msg?.attachment?.fileId && onDeleteFile) {
      onDeleteFile(msg.attachment.fileId);
    }
    showToast('Запись удалена из хранилища');
  };

  const showToast = (text: string) => {
    setToastMessage(text);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const filteredContacts = activeContactsList.filter(
    c =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.onionAddress.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeContact = activeContactsList.find(c => c.id === selectedId) || activeContactsList[0];

  // Storage metric calculation
  const totalUsedBytes = files.reduce((sum, f) => sum + f.sizeBytes, 0);
  const totalUsedGb = totalUsedBytes / (1024 * 1024 * 1024);

  // Filter messages belonging to current conversation
  const roomMessages = useMemo(() => {
    return messages.filter(m => {
      if (isVaultRoom) {
        return m.recipientId === 'vault_favorites' || m.senderId === 'vault_favorites';
      }
      return (
        (m.senderId === 'current_user' && m.recipientId === selectedId) ||
        (m.senderId === selectedId && m.recipientId === 'current_user') ||
        (!m.recipientId && selectedId === 'contact_alice')
      );
    });
  }, [messages, isVaultRoom, selectedId]);

  // Compute counts for each category filter in vault
  const categoryCounts = useMemo(() => {
    let docs = 0;
    let photos = 0;
    let audio = 0;
    let notes = 0;

    roomMessages.forEach(m => {
      if (!m.attachment) {
        notes++;
        return;
      }
      const ext = m.attachment.name.split('.').pop()?.toLowerCase() || '';
      if (['png', 'jpg', 'jpeg', 'webp', 'svg', 'gif'].includes(ext)) {
        photos++;
      } else if (['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'].includes(ext)) {
        audio++;
      } else {
        docs++;
      }
    });

    return { all: roomMessages.length, docs, photos, audio, notes };
  }, [roomMessages]);

  // Apply Document Type Filter & Keyword Search
  const displayedMessages = useMemo(() => {
    return roomMessages.filter(m => {
      // 1. Text Search Filter
      if (vaultSearchQuery.trim()) {
        const query = vaultSearchQuery.toLowerCase();
        const textMatch = m.text?.toLowerCase().includes(query);
        const fileMatch = m.attachment?.name?.toLowerCase().includes(query);
        if (!textMatch && !fileMatch) return false;
      }

      // 2. Document Type Filter
      if (vaultTypeFilter === 'all') return true;

      if (!m.attachment) {
        return vaultTypeFilter === 'notes';
      }

      const ext = m.attachment.name.split('.').pop()?.toLowerCase() || '';
      const isImg = ['png', 'jpg', 'jpeg', 'webp', 'svg', 'gif'].includes(ext);
      const isAud = ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'].includes(ext);
      const isDoc = !isImg && !isAud;

      if (vaultTypeFilter === 'docs') return isDoc;
      if (vaultTypeFilter === 'photos') return isImg;
      if (vaultTypeFilter === 'audio') return isAud;
      if (vaultTypeFilter === 'notes') return !m.attachment;

      return true;
    });
  }, [roomMessages, vaultSearchQuery, vaultTypeFilter]);

  return (
    <div className="h-screen flex flex-col bg-[#0b0f17] text-slate-100 overflow-hidden select-none">
      {/* 1. Slide-over Navigation Drawer */}
      <NavigationDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        identity={identity}
        onSelectFavorites={() => {
          triggerHaptic('light');
          setSelectedId('vault_favorites');
          setIsMobileChatOpen(true);
        }}
        onOpenDrawerTab={onOpenDrawerTab}
        onOpenNetworkModal={() => setIsNetworkModalOpen(true)}
        onOpenContactModal={() => setIsContactModalOpen(true)}
        onQuickLock={onQuickLock}
        onSwitchAccount={onSwitchAccount}
      />

      {/* 2. Main Content Split: Contacts Sidebar + Unified Chat Thread Stage */}
      <div className="flex-1 flex overflow-hidden">
        {/* Contact Sidebar (hidden on mobile when chat is opened) */}
        <ContactSidebar
          className={isMobileChatOpen ? 'hidden md:flex' : 'flex'}
          contacts={filteredContacts}
          selectedId={selectedId}
          searchQuery={searchQuery}
          totalUsedGb={totalUsedGb}
          personalVaultQuotaGb={personalVaultQuotaGb}
          onSelectContact={handleSelectContact}
          onSearchChange={setSearchQuery}
          onOpenDrawer={() => {
            triggerHaptic('light');
            setIsDrawerOpen(true);
          }}
          onOpenContactModal={() => {
            triggerHaptic('light');
            setIsContactModalOpen(true);
          }}
        />

        {/* Right Stage: Unified Active Chat (Standard for both peer chats & Favorites) */}
        <div
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          className={`flex-1 flex-col bg-[#0b0f17] overflow-hidden min-w-0 h-full transition-all duration-150 ${
            isMobileChatOpen ? 'flex w-full' : 'hidden md:flex'
          }`}
        >
          <div className="flex-1 flex flex-col overflow-hidden h-full">
            {/* Standard Chat Header Bar with Mobile Back Button */}
            <div className="p-2.5 sm:p-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0 gap-2">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                {/* Mobile Back Button returning to chat list */}
                <button
                  type="button"
                  onClick={handleBackToChatList}
                  className="md:hidden p-1.5 sm:p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition flex items-center gap-1 text-xs font-semibold shrink-0 cursor-pointer active:scale-95"
                  title="Назад к списку чатов"
                  aria-label="Назад к чатам"
                >
                  <ArrowLeft className="w-4 h-4 text-cyan-400" />
                  <span className="text-[11px] font-mono">Чаты</span>
                </button>

                <div
                  className={`w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-tr ${
                    activeContact?.avatarColor || 'from-amber-400 to-amber-600'
                  } flex items-center justify-center text-slate-950 font-bold font-mono text-xs shadow-md shrink-0`}
                >
                  {isVaultRoom ? (
                    <Star className="w-5 h-5 fill-slate-950 text-slate-950" />
                  ) : (
                    activeContact?.name.slice(0, 2).toUpperCase() || 'P2'
                  )}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-xs sm:text-sm font-bold font-mono text-white truncate">
                      {activeContact?.name || 'Собеседник'}
                    </h2>
                    {isVaultRoom && (
                      <span className="hidden sm:inline px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        Личный анклав
                      </span>
                    )}
                  </div>

                  <div className="text-[10px] font-mono text-emerald-400 truncate flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    {isVaultRoom ? (
                      <span className="text-amber-300/90 truncate">
                        ChaCha20-Poly1305 • RF=6× Кворум • Сейф: {totalUsedGb.toFixed(1)} / {personalVaultQuotaGb} GB
                      </span>
                    ) : (
                      <>
                        <span className="hidden xs:inline">Tor Onion v3 • E2EE ChaCha20</span>
                        <span className="xs:hidden">Tor v3 • E2EE</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Tor Private Server Relay Toggle & Quick Lock */}
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    onTogglePrivateServer();
                  }}
                  className={`px-2 py-1.5 sm:px-2.5 rounded-xl border text-[11px] sm:text-xs font-mono font-bold transition flex items-center gap-1 sm:gap-1.5 cursor-pointer ${
                    currentNode.smpServerRunning
                      ? 'bg-emerald-950/70 border-emerald-500/40 text-emerald-300'
                      : 'bg-slate-800 border-slate-700 text-slate-400'
                  }`}
                  title="Локальный сервер SMP / xFTP через Onion v3"
                >
                  <Server className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">
                    {currentNode.smpServerRunning ? 'SMP Relay: ВКЛ' : 'SMP Relay: ВЫКЛ'}
                  </span>
                  <span className="sm:hidden text-[10px]">
                    {currentNode.smpServerRunning ? 'SMP' : 'Off'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('lock');
                    onQuickLock();
                  }}
                  className="p-1.5 sm:p-2 rounded-xl bg-slate-800 hover:bg-red-950 text-slate-400 hover:text-red-300 transition cursor-pointer"
                  title="Заблокировать приложение"
                >
                  <Lock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
              </div>
            </div>

            {/* Document Type Filter and Text Search Toolbar (for Favorites / Personal Vault) */}
            {isVaultRoom && (
              <div className="bg-slate-900/80 border-b border-slate-800/90 px-3 py-2 sm:px-4 sm:py-2.5 space-y-2 shrink-0">
                {/* Search Bar */}
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                      type="text"
                      value={vaultSearchQuery}
                      onChange={e => setVaultSearchQuery(e.target.value)}
                      placeholder="Поиск по тексту или файлам в Избранном..."
                      className="w-full pl-8 pr-8 py-1.5 bg-slate-950/80 border border-slate-700/60 rounded-xl text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/60 transition"
                    />
                    {vaultSearchQuery && (
                      <button
                        type="button"
                        onClick={() => {
                          triggerHaptic('light');
                          setVaultSearchQuery('');
                        }}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-white"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Filter Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      setVaultTypeFilter('all');
                    }}
                    className={`px-2.5 py-1 rounded-xl text-[11px] font-mono font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
                      vaultTypeFilter === 'all'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                        : 'bg-slate-800/60 text-slate-400 hover:text-slate-200 border border-transparent'
                    }`}
                  >
                    <span>Все</span>
                    <span className="text-[10px] opacity-75 font-normal">({categoryCounts.all})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      setVaultTypeFilter('docs');
                    }}
                    className={`px-2.5 py-1 rounded-xl text-[11px] font-mono font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
                      vaultTypeFilter === 'docs'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                        : 'bg-slate-800/60 text-slate-400 hover:text-slate-200 border border-transparent'
                    }`}
                  >
                    <FileText className="w-3 h-3 text-emerald-400" />
                    <span>Документы</span>
                    <span className="text-[10px] opacity-75 font-normal">({categoryCounts.docs})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      setVaultTypeFilter('photos');
                    }}
                    className={`px-2.5 py-1 rounded-xl text-[11px] font-mono font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
                      vaultTypeFilter === 'photos'
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                        : 'bg-slate-800/60 text-slate-400 hover:text-slate-200 border border-transparent'
                    }`}
                  >
                    <Image className="w-3 h-3 text-cyan-400" />
                    <span>Фото</span>
                    <span className="text-[10px] opacity-75 font-normal">({categoryCounts.photos})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      setVaultTypeFilter('audio');
                    }}
                    className={`px-2.5 py-1 rounded-xl text-[11px] font-mono font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
                      vaultTypeFilter === 'audio'
                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm'
                        : 'bg-slate-800/60 text-slate-400 hover:text-slate-200 border border-transparent'
                    }`}
                  >
                    <Music className="w-3 h-3 text-purple-400" />
                    <span>Аудио</span>
                    <span className="text-[10px] opacity-75 font-normal">({categoryCounts.audio})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      setVaultTypeFilter('notes');
                    }}
                    className={`px-2.5 py-1 rounded-xl text-[11px] font-mono font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
                      vaultTypeFilter === 'notes'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                        : 'bg-slate-800/60 text-slate-400 hover:text-slate-200 border border-transparent'
                    }`}
                  >
                    <StickyNote className="w-3 h-3 text-amber-400" />
                    <span>Заметки</span>
                    <span className="text-[10px] opacity-75 font-normal">({categoryCounts.notes})</span>
                  </button>
                </div>
              </div>
            )}

            {/* Chat Thread Messages: identical component rendering for all chats */}
            {displayedMessages.length === 0 && (vaultSearchQuery || vaultTypeFilter !== 'all') ? (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-3 font-mono">
                <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500">
                  <Search className="w-6 h-6 text-slate-400" />
                </div>
                <div className="text-xs text-slate-300 font-bold">Ничего не найдено</div>
                <div className="text-[11px] text-slate-500 max-w-xs">
                  Нет записей, соответствующих выбранному фильтру или поисковому запросу.
                </div>
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setVaultTypeFilter('all');
                    setVaultSearchQuery('');
                  }}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-cyan-300 font-bold transition cursor-pointer"
                >
                  Сбросить фильтры
                </button>
              </div>
            ) : (
              <ChatThread
                messages={displayedMessages}
                contactName={activeContact?.name || 'Собеседник'}
                downloadingFileId={downloadingFileId}
                onDownloadAttachment={downloadAttachment}
                onToggleReaction={onToggleReaction}
                onRevealBurnerNote={onRevealBurnerNote}
                onOpenMessageAction={msg => {
                  triggerHaptic('light');
                  setActionMessage(msg);
                }}
              />
            )}

            {/* Standard Message Composer (same in peer chats & in Favorites) */}
            <MessageComposer
              nodes={nodes}
              onSendMessage={handleSendMessage}
              onShareMyContact={handleShareMyContact}
            />
          </div>
        </div>
      </div>

      {/* 3. Message Context Action Modal (Сохранить / Переслать / Удалить / Свойства) */}
      <MessageActionModal
        message={actionMessage}
        isOpen={!!actionMessage}
        onClose={() => setActionMessage(null)}
        onSaveMessage={handleSaveMessage}
        onForwardMessage={handleForwardMessage}
        onDeleteMessage={handleDeleteMessage}
        contacts={activeContactsList.filter(c => c.id !== 'vault_favorites')}
        isDownloading={downloadingFileId !== null}
      />

      {/* 4. Action Confirmation Toast */}
      {toastMessage && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-slate-900 border border-emerald-500/50 px-4 py-2.5 rounded-2xl shadow-2xl flex items-center gap-2 text-xs font-mono text-emerald-300 animate-in fade-in slide-in-from-bottom-4">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 5. Sub-Modals */}
      <ContactManagerModal
        isOpen={isContactModalOpen}
        onClose={() => setIsContactModalOpen(false)}
        identity={identity}
        onionAddress={currentNode.onionAddress}
        onAddContact={handleAddNewContact}
      />

      <NetworkSettingsModal
        isOpen={isNetworkModalOpen}
        onClose={() => setIsNetworkModalOpen(false)}
        onionAddress={currentNode.onionAddress}
      />
    </div>
  );
};
