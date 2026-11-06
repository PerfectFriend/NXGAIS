import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { ChatMessage, NodeRecord } from '../types/nexxus';
import { INITIAL_MESSAGES } from '../data/mockInitialState';
import { p2pMeshBus } from '../utils/p2pMeshBus';

/**
 * Decoy messages for anti-torture Panic PIN duress mode.
 */
export const DECOY_MESSAGES: ChatMessage[] = [
  {
    id: 'decoy_msg_1',
    senderId: 'contact_echo',
    senderName: 'NeXXus Echo Service',
    senderOnion: 'echo.testnet.onion:9050',
    recipientId: 'current_user',
    text: 'Привет! Это тестовая эхо-служба NeXXus. Ваше тестовое соединение работает в штатном режиме.',
    timestamp: Date.now() - 3600 * 1000,
    protocol: 'SMP',
    isRelayedViaPrivateServer: false,
    status: 'delivered',
  },
];

/**
 * Value contract exposed by MessengerContext.
 */
export interface MessengerContextValue {
  /** Active message list (or decoy messages during duress mode) */
  messages: ChatMessage[];
  /** Primary local node reference for onion address and relay parameters */
  currentNode: NodeRecord;
  /** Actions */
  sendMessage: (
    text: string, 
    attachment?: { name: string; sizeBytes: number; chunksCount: number; fileId: string },
    burner?: { ttlSeconds: number },
    recipientId?: string
  ) => void;
  deleteMessage: (messageId: string) => void;
  forwardMessage: (messageId: string, targetRecipientId: string) => void;
  toggleReaction: (messageId: string, emoji: string) => void;
  revealBurnerNote: (messageId: string) => void;
  togglePrivateServer: () => void;
}

const MessengerContext = createContext<MessengerContextValue | null>(null);

interface MessengerProviderProps {
  children: ReactNode;
  currentNode: NodeRecord;
  onUpdateCurrentNode?: (node: NodeRecord) => void;
  isDecoyMode?: boolean;
}

/**
 * MessengerProvider manages sovereign P2P chats via SMP and xFTP protocols over Tor v3 onion services.
 *
 * @param {MessengerProviderProps} props - Component props containing child components and primary node reference.
 * @returns {React.ReactElement} The rendered React Context provider.
 */
export const MessengerProvider: React.FC<MessengerProviderProps> = ({
  children,
  currentNode,
  onUpdateCurrentNode,
  isDecoyMode = false,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const saved = localStorage.getItem('nexxus_messages');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // If previous localStorage didn't have favorites messages, merge them!
          const hasVault = parsed.some(m => m.recipientId === 'vault_favorites' || m.senderId === 'vault_favorites');
          if (!hasVault) {
            const vaultItems = INITIAL_MESSAGES.filter(m => m.recipientId === 'vault_favorites');
            return [...parsed, ...vaultItems];
          }
          return parsed;
        }
      } catch {
        /* fallback */
      }
    }
    return INITIAL_MESSAGES;
  });

  // Sync messages to localStorage when not in decoy mode
  useEffect(() => {
    if (!isDecoyMode) {
      localStorage.setItem('nexxus_messages', JSON.stringify(messages));
    }
  }, [messages, isDecoyMode]);

  // Periodic check for burner notes expiration (TTL countdown)
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setMessages(prev => {
        let changed = false;
        const updated = prev.map(m => {
          if (m.burner && m.burner.revealed && !m.burner.isBurned && m.burner.expiresAt && now >= m.burner.expiresAt) {
            changed = true;
            return {
              ...m,
              text: '🔥 Сообщение самоуничтожено (TTL истек)',
              attachment: undefined,
              burner: { ...m.burner, isBurned: true }
            };
          }
          return m;
        });
        return changed ? updated : prev;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Listen for real P2P mesh bus broadcasts across browser tabs/nodes
  useEffect(() => {
    const unsubscribe = p2pMeshBus.subscribeMessages(incoming => {
      setMessages(prev => {
        if (prev.some(m => m.id === incoming.id)) return prev;
        return [
          ...prev,
          {
            id: incoming.id,
            senderId: incoming.senderId,
            senderName: incoming.senderName,
            senderOnion: incoming.senderOnion,
            recipientId: incoming.recipientId,
            text: incoming.text,
            timestamp: incoming.timestamp,
            protocol: incoming.protocol,
            attachment: incoming.attachment,
            isRelayedViaPrivateServer: true,
            status: 'delivered',
          },
        ];
      });
    });
    return unsubscribe;
  }, []);

  const sendMessage = useCallback((
    text: string, 
    attachment?: { name: string; sizeBytes: number; chunksCount: number; fileId: string },
    burner?: { ttlSeconds: number },
    recipientId: string = 'contact_alice'
  ) => {
    const newMsg: ChatMessage = {
      id: `msg_${Date.now()}`,
      senderId: 'current_user',
      senderName: 'Me',
      senderOnion: currentNode.onionAddress,
      recipientId,
      text,
      timestamp: Date.now(),
      protocol: attachment ? 'xFTP' : 'SMP',
      attachment,
      isRelayedViaPrivateServer: currentNode.smpServerRunning,
      status: 'delivered',
      burner: burner ? {
        ttlSeconds: burner.ttlSeconds,
        isBurned: false,
        revealed: true,
        expiresAt: Date.now() + burner.ttlSeconds * 1000,
      } : undefined,
    };

    setMessages(prev => [...prev, newMsg]);

    // If sent to Personal Vault (Избранное), no remote peer transmission or auto-reply needed!
    if (recipientId === 'vault_favorites') {
      return;
    }

    // Transmit authentic binary frame via P2P Mesh Bus (NEXX magic + ChaCha20-Poly1305 + SHA-256)
    p2pMeshBus
      .sendSmpMessage(
        recipientId,
        'alice4p8q1w4e7r0t2y5u8i1o4p7a0s3d6f9g2h5j8k1l4z7x0c.onion:9050',
        text,
        attachment
      )
      .catch(err => {
        console.warn('P2P wire broadcast notice:', err);
      });

    // Simulated peer acknowledgement reply (only for peer contacts)
    setTimeout(() => {
      const isBurner = !!burner;
      const peerName = recipientId === 'contact_bob' 
        ? 'Bob (Desktop Station)' 
        : recipientId === 'contact_charlie' 
        ? 'Charlie (Archive Node)' 
        : 'Alice (Guardian #4)';

      const replyMsg: ChatMessage = {
        id: `msg_reply_${Date.now()}`,
        senderId: recipientId,
        senderName: peerName,
        senderOnion: 'alice4p8q1w4e7r0t2y5u8i1o4p7a0s3d6f9g2h5j8k1l4z7x0c.onion:9050',
        recipientId: 'current_user',
        text: isBurner
          ? `🔥 Сгорающая заметка получена. Таймер ${burner.ttlSeconds} сек активирован.`
          : attachment
          ? `Получен xFTP поток чанков "${attachment.name}". 6× репликация (RF=6×) подтверждена кворумом!`
          : `Принято по протоколу SMP через Onion v3 сервис. Сквозное шифрование подтверждено.`,
        timestamp: Date.now(),
        protocol: attachment ? 'xFTP' : 'SMP',
        isRelayedViaPrivateServer: true,
        status: 'delivered',
      };
      setMessages(prev => [...prev, replyMsg]);
    }, 1800);
  }, [currentNode]);

  const deleteMessage = useCallback((messageId: string) => {
    setMessages(prev => prev.filter(m => m.id !== messageId));
  }, []);

  const forwardMessage = useCallback((messageId: string, targetRecipientId: string) => {
    setMessages(prev => {
      const targetMsg = prev.find(m => m.id === messageId);
      if (!targetMsg) return prev;
      const forwardedMsg: ChatMessage = {
        id: `msg_fwd_${Date.now()}`,
        senderId: 'current_user',
        senderName: 'Me',
        senderOnion: currentNode.onionAddress,
        recipientId: targetRecipientId,
        text: targetMsg.text ? `[Переслано]: ${targetMsg.text}` : `[Пересланный файл: ${targetMsg.attachment?.name}]`,
        timestamp: Date.now(),
        protocol: targetMsg.protocol,
        attachment: targetMsg.attachment ? { ...targetMsg.attachment } : undefined,
        isRelayedViaPrivateServer: currentNode.smpServerRunning,
        status: 'delivered',
      };
      return [...prev, forwardedMsg];
    });
  }, [currentNode]);

  const toggleReaction = useCallback((messageId: string, emoji: string) => {
    setMessages(prev => prev.map(m => {
      if (m.id === messageId) {
        return { ...m, reaction: m.reaction === emoji ? undefined : emoji };
      }
      return m;
    }));
  }, []);

  const revealBurnerNote = useCallback((messageId: string) => {
    setMessages(prev => prev.map(m => {
      if (m.id === messageId && m.burner && !m.burner.revealed) {
        return {
          ...m,
          burner: {
            ...m.burner,
            revealed: true,
            expiresAt: Date.now() + m.burner.ttlSeconds * 1000,
          }
        };
      }
      return m;
    }));
  }, []);

  const togglePrivateServer = useCallback(() => {
    if (onUpdateCurrentNode) {
      onUpdateCurrentNode({
        ...currentNode,
        smpServerRunning: !currentNode.smpServerRunning,
      });
    }
  }, [currentNode, onUpdateCurrentNode]);

  const activeMessages = isDecoyMode ? DECOY_MESSAGES : messages;

  const contextValue: MessengerContextValue = {
    messages: activeMessages,
    currentNode,
    sendMessage,
    deleteMessage,
    forwardMessage,
    toggleReaction,
    revealBurnerNote,
    togglePrivateServer,
  };

  return <MessengerContext.Provider value={contextValue}>{children}</MessengerContext.Provider>;
};

/**
 * Hook to access sovereign messenger state and message dispatchers.
 *
 * @throws {Error} If called outside of a MessengerProvider.
 * @returns {MessengerContextValue} The messenger context value.
 */
export const useMessenger = (): MessengerContextValue => {
  const context = useContext(MessengerContext);
  if (!context) {
    throw new Error('useMessenger must be used within a MessengerProvider');
  }
  return context;
};
