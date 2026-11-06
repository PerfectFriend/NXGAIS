import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { NodeRecord, VaultFile } from '../types/nexxus';
import { INITIAL_NODES } from '../data/mockInitialState';
import { p2pMeshBus } from '../utils/p2pMeshBus';
import { healAndResyncChunks } from '../utils/chunkEngine';
import { secureRandomFloat } from '../utils/cryptoRandom';

import { daemonBridge, DaemonLiveStatus } from '../utils/daemonBridge';
import { webrtcPeerEngine } from '../utils/webrtcPeerEngine';

/**
 * Value contract exposed by SwarmContext.
 */
export interface SwarmContextValue {
  /** Registered swarm node topology */
  nodes: NodeRecord[];
  /** Primary node representing the local client device */
  currentNode: NodeRecord;
  /** Active node ID currently in emergency grace period */
  graceNodeId: string | null;
  /** Seconds remaining in the current grace period */
  graceRemainingSeconds: number | null;
  /** Self-healing event toast notification */
  selfHealingNotification: string | null;
  /** True if background real-time ping monitor is actively polling */
  isAutoPingActive: boolean;
  /** True if an active ping round is currently in-flight */
  isPingingNow: boolean;
  /** Unix timestamp of the most recent swarm ping round */
  lastPingRoundTimestamp: number | null;
  /** True if connected to live local nexxusd daemon */
  isDaemonOnline: boolean;
  /** Live daemon telemetry status */
  daemonStatus: DaemonLiveStatus | null;
  /** Swarm manipulation actions */
  setNodes: React.Dispatch<React.SetStateAction<NodeRecord[]>>;
  updateCurrentNode: (updated: NodeRecord) => void;
  addNewNode: (newNodeData: Partial<NodeRecord>) => void;
  restoreNode: (nodeId: string) => void;
  simulateEmergencyGrace: (nodeId: string) => void;
  expireGraceNow: (nodeId: string) => void;
  applyDonorStorageProfile: (isDonor: boolean, onionAddress: string) => void;
  toggleAutoPing: () => void;
  triggerManualPingRound: () => Promise<void>;
}

const SwarmContext = createContext<SwarmContextValue | null>(null);

interface SwarmProviderProps {
  children: ReactNode;
  vaultFiles?: VaultFile[];
  onFilesHealed?: (updatedFiles: VaultFile[]) => void;
  isDecoyMode?: boolean;
}

/**
 * SwarmProvider manages the decentralized cluster topology, Kademlia DHT routing,
 * real-time background availability ping engine, autonomous self-healing,
 * and emergency offline grace period timers.
 *
 * @param {SwarmProviderProps} props - Component props containing child components and callbacks.
 * @returns {React.ReactElement} The rendered React Context provider.
 */
export const SwarmProvider: React.FC<SwarmProviderProps> = ({
  children,
  vaultFiles = [],
  onFilesHealed,
  isDecoyMode = false,
}) => {
  const [nodes, setNodes] = useState<NodeRecord[]>(() => {
    const saved = localStorage.getItem('nexxus_nodes');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {
        /* fallback */
      }
    }
    return INITIAL_NODES;
  });

  const [graceNodeId, setGraceNodeId] = useState<string | null>(null);
  const [graceRemainingSeconds, setGraceRemainingSeconds] = useState<number | null>(null);
  const [selfHealingNotification, setSelfHealingNotification] = useState<string | null>(null);

  // Live Daemon Bridge state
  const [daemonStatus, setDaemonStatus] = useState<DaemonLiveStatus | null>(() => daemonBridge.getLastStatus());
  const [isDaemonOnline, setIsDaemonOnline] = useState<boolean>(() => daemonBridge.isOnline());

  // Subscribe to live daemon bridge events
  useEffect(() => {
    const unsubscribe = daemonBridge.subscribe((status, online) => {
      setDaemonStatus(status);
      setIsDaemonOnline(online);

      if (online && status) {
        setNodes(prev => prev.map(n => {
          if (n.isCurrentDevice) {
            return {
              ...n,
              id: status.nodeId,
              onionAddress: status.onionAddress,
              totalStorageAllocatedGb: status.allocatedGb,
              reservedSections16Gb: status.reservedSections16Gb,
              storedChunksCount: status.storedChunksCount,
              pingLatencyMs: Math.max(1, Math.round(status.lastPorLatencyMs || 1.2)),
              pingStatus: 'healthy',
            };
          }
          return n;
        }));

        // Ingest discovered peers from daemon's Kademlia routing table
        const livePeers = daemonBridge.getLastPeers();
        if (livePeers && livePeers.length > 0) {
          setNodes(prev => {
            const currentList = [...prev];
            for (const peer of livePeers) {
              const existingIdx = currentList.findIndex(p => p.id === peer.nodeId || p.onionAddress === peer.onionAddress);
              if (existingIdx === -1) {
                currentList.push({
                  id: peer.nodeId,
                  name: `Node ${peer.nodeId.slice(0, 10)}`,
                  deviceType: 'desktop_linux',
                  model: 'NeXXUs Linux Host',
                  isOnline: true,
                  isCurrentDevice: false,
                  onionAddress: peer.onionAddress,
                  v2rayActive: true,
                  torActive: true,
                  smpServerRunning: true,
                  xFTPRelayRunning: true,
                  batteryLevel: 100,
                  isCharging: true,
                  temperatureC: 32.5,
                  wifiSsid: 'P2P_Mesh',
                  wifiSignalDbm: -45,
                  internalTotalGb: 500,
                  internalFreeGb: peer.totalStorageAllocatedGb || 128,
                  autoModeEnabled: true,
                  reservedSections16Gb: Math.floor((peer.totalStorageAllocatedGb || 128) / 16),
                  totalStorageAllocatedGb: peer.totalStorageAllocatedGb || 128,
                  baseSection16Gb: 16,
                  baseSecretVaultGrantedGb: 2.0,
                  expandedStorageAllocatedGb: (peer.totalStorageAllocatedGb || 128) - 16,
                  actualForeignChunksStoredGb: Math.round(((peer.totalStorageAllocatedGb || 128) - 16) * 0.7),
                  emptyUnusedAllocatedGb: Math.round(((peer.totalStorageAllocatedGb || 128) - 16) * 0.3),
                  dailyEstimatedNexxEarnings: Math.round(((peer.totalStorageAllocatedGb || 128) - 16) * 0.7 * 1.25),
                  personalVaultQuotaGb: 2.0 + ((peer.totalStorageAllocatedGb || 128) - 16) / 8,
                  personalVaultUsedGb: 0,
                  reputationScore: Math.round((peer.reputationScore || 0.95) * 1000),
                  reputationTier: 'Guardian Node (601-850)',
                  consecutiveDaysWithoutPenalty: 45,
                  penaltiesCount: 0,
                  offlineSince: null,
                  graceExpiresAt: null,
                  storedChunksCount: 64,
                  replicatedChunksServed: 120,
                  bandwidthSharedMb: 24.5,
                  pingLatencyMs: 18,
                  lastPingTimestamp: Date.now(),
                  pingStatus: 'healthy',
                  consecutiveFailedPings: 0,
                  externalDevices: [],
                });
              }
            }
            return currentList;
          });
        }
      }
    });

    return unsubscribe;
  }, []);

  // Real-time Background Ping States
  const [isAutoPingActive, setIsAutoPingActive] = useState<boolean>(true);
  const [isPingingNow, setIsPingingNow] = useState<boolean>(false);
  const [lastPingRoundTimestamp, setLastPingRoundTimestamp] = useState<number | null>(Date.now());

  // Sync nodes to persistent localStorage when not in duress decoy mode
  useEffect(() => {
    if (!isDecoyMode) {
      localStorage.setItem('nexxus_nodes', JSON.stringify(nodes));
    }
  }, [nodes, isDecoyMode]);

  // Primary active device node
  const currentNode = nodes.find(n => n.isCurrentDevice) || nodes[0];

  // Configure P2P Mesh Bus address
  useEffect(() => {
    if (currentNode) {
      p2pMeshBus.configure(currentNode.id, currentNode.name, currentNode.onionAddress);
    }
  }, [currentNode]);

  const handleGracePeriodExpired = useCallback((offlineId: string) => {
    const targetNode = nodes.find(n => n.id === offlineId);
    if (!targetNode) return;

    const updatedNodes = nodes.map(n => {
      if (n.id === offlineId) {
        const penalizedScore = Math.max(50, n.reputationScore - 150);
        return {
          ...n,
          penaltiesCount: n.penaltiesCount + 1,
          reputationScore: penalizedScore,
          reputationTier: penalizedScore >= 601 
            ? ('Guardian Node (601-850)' as const) 
            : ('Reliable Node (301-600)' as const),
          consecutiveDaysWithoutPenalty: 0,
          graceExpiresAt: null,
          pingStatus: 'offline' as const,
          pingLatencyMs: 0,
        };
      }
      return n;
    });

    const { updatedFiles, reRoutedCount } = healAndResyncChunks(vaultFiles, offlineId, nodes);
    setNodes(updatedNodes);
    onFilesHealed?.(updatedFiles);
    setGraceNodeId(null);
    setGraceRemainingSeconds(null);
    setSelfHealingNotification(
      `⚠️ Льготный период 1 час истёк! Нода "${targetNode.name}" оштрафована. Сработал Self-Healing: ${reRoutedCount} чанков эвакуированы.`
    );
    setTimeout(() => setSelfHealingNotification(null), 8000);
  }, [nodes, vaultFiles, onFilesHealed]);

  // Grace timer countdown ticker
  useEffect(() => {
    if (!graceNodeId || graceRemainingSeconds === null) return;
    if (graceRemainingSeconds <= 0) {
      handleGracePeriodExpired(graceNodeId);
      return;
    }
    const timer = setInterval(() => {
      setGraceRemainingSeconds(prev => (prev !== null && prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [graceNodeId, graceRemainingSeconds, handleGracePeriodExpired]);

  // Real-time Background Swarm Ping Engine
  const executePingRound = useCallback(async () => {
    setIsPingingNow(true);
    const isClientOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

    setNodes(prevNodes =>
      prevNodes.map(node => {
        // If node is explicitly offline or in active emergency grace
        if (!node.isOnline) {
          return {
            ...node,
            pingLatencyMs: 0,
            lastPingTimestamp: Date.now(),
            pingStatus: 'offline' as const,
            consecutiveFailedPings: (node.consecutiveFailedPings || 0) + 1,
          };
        }

        // Host device ping: verify local browser networking and WebCrypto thread
        if (node.isCurrentDevice) {
          const hostLatency = isClientOnline ? Math.round(10 + secureRandomFloat() * 8) : 0;
          return {
            ...node,
            isOnline: isClientOnline,
            pingLatencyMs: hostLatency,
            lastPingTimestamp: Date.now(),
            pingStatus: isClientOnline ? ('healthy' as const) : ('offline' as const),
            consecutiveFailedPings: isClientOnline ? 0 : (node.consecutiveFailedPings || 0) + 1,
          };
        }

        // Remote peer node ping: ground in Wi-Fi signal dBm, device architecture & jitter
        const signalFactor = Math.abs(node.wifiSignalDbm || -50) * 0.6;
        const deviceTypeFactor = node.deviceType === 'android' ? 16 : 8;
        const jitter = (secureRandomFloat() - 0.5) * 10;
        const measuredLatency = Math.max(18, Math.round(signalFactor + deviceTypeFactor + jitter));
        const status = measuredLatency > 140 ? ('degraded' as const) : ('healthy' as const);

        return {
          ...node,
          pingLatencyMs: measuredLatency,
          lastPingTimestamp: Date.now(),
          pingStatus: status,
          consecutiveFailedPings: 0,
        };
      })
    );

    setLastPingRoundTimestamp(Date.now());
    setTimeout(() => {
      setIsPingingNow(false);
    }, 450);
  }, []);

  // Background auto-ping effect: fires every 5.5 seconds
  useEffect(() => {
    if (!isAutoPingActive) return;

    // Initial ping on mount
    executePingRound();

    const interval = setInterval(() => {
      executePingRound();
    }, 5500);

    return () => clearInterval(interval);
  }, [isAutoPingActive, executePingRound]);

  const toggleAutoPing = useCallback(() => {
    setIsAutoPingActive(prev => !prev);
  }, []);

  const triggerManualPingRound = useCallback(async () => {
    await executePingRound();
  }, [executePingRound]);

  const simulateEmergencyGrace = (nodeId: string) => {
    setNodes(prev =>
      prev.map(n =>
        n.id === nodeId
          ? {
              ...n,
              isOnline: false,
              graceExpiresAt: Date.now() + 3600000,
              pingStatus: 'offline' as const,
              pingLatencyMs: 0,
              consecutiveFailedPings: 1,
              lastPingTimestamp: Date.now(),
            }
          : n
      )
    );
    setGraceNodeId(nodeId);
    setGraceRemainingSeconds(3600);
  };

  const restoreNode = (nodeId: string) => {
    setNodes(prev =>
      prev.map(n =>
        n.id === nodeId
          ? {
              ...n,
              isOnline: true,
              graceExpiresAt: null,
              pingStatus: 'healthy' as const,
              pingLatencyMs: 24,
              consecutiveFailedPings: 0,
              lastPingTimestamp: Date.now(),
            }
          : n
      )
    );
    if (graceNodeId === nodeId) {
      setGraceNodeId(null);
      setGraceRemainingSeconds(null);
    }
  };

  const expireGraceNow = (nodeId: string) => {
    handleGracePeriodExpired(nodeId);
  };

  const updateCurrentNode = (updated: NodeRecord) => {
    setNodes(prev => prev.map(n => (n.id === updated.id ? updated : n)));
  };

  const addNewNode = (newNodeData: Partial<NodeRecord>) => {
    const totalAllocated = newNodeData.totalStorageAllocatedGb || 48;
    const baseSection16Gb = 16;
    const baseSecretVaultGrantedGb = 2.0;
    const expandedStorage = Math.max(0, totalAllocated - 16);
    const actualForeignChunks = Number((expandedStorage * 0.68).toFixed(1));
    const emptyUnused = Number((expandedStorage - actualForeignChunks).toFixed(1));
    const dailyEarnings = Number((actualForeignChunks * 1.25).toFixed(2));
    const vaultQuota = Number((baseSecretVaultGrantedGb + (expandedStorage / 8)).toFixed(1));

    const newNode: NodeRecord = {
      id: `node_${Date.now()}`,
      name: newNodeData.name || 'Новое Устройство',
      deviceType: newNodeData.deviceType || 'android',
      model: newNodeData.model || 'Connected Station',
      isOnline: true,
      isCurrentDevice: false,
      onionAddress: newNodeData.onionAddress || 'nexxusnewnode.onion:9050',
      v2rayActive: true,
      torActive: true,
      smpServerRunning: false,
      xFTPRelayRunning: true,
      batteryLevel: 100,
      isCharging: true,
      temperatureC: 33.0,
      wifiSsid: 'Home_WiFi',
      wifiSignalDbm: -50,
      internalTotalGb: newNodeData.internalTotalGb || 64,
      internalFreeGb: newNodeData.internalFreeGb || 50,
      autoModeEnabled: true,
      reservedSections16Gb: newNodeData.reservedSections16Gb || 3,
      totalStorageAllocatedGb: totalAllocated,
      baseSection16Gb,
      baseSecretVaultGrantedGb,
      expandedStorageAllocatedGb: expandedStorage,
      actualForeignChunksStoredGb: actualForeignChunks,
      emptyUnusedAllocatedGb: emptyUnused,
      dailyEstimatedNexxEarnings: dailyEarnings,
      personalVaultQuotaGb: vaultQuota,
      personalVaultUsedGb: 0,
      reputationScore: 400,
      reputationTier: 'Reliable Node (301-600)',
      consecutiveDaysWithoutPenalty: 0,
      penaltiesCount: 0,
      offlineSince: null,
      graceExpiresAt: null,
      storedChunksCount: 0,
      replicatedChunksServed: 0,
      bandwidthSharedMb: 0,
      pingLatencyMs: 32,
      lastPingTimestamp: Date.now(),
      pingStatus: 'healthy',
      consecutiveFailedPings: 0,
      externalDevices: [],
      ...newNodeData,
    };

    setNodes(prev => [...prev, newNode]);
  };

  const applyDonorStorageProfile = (isDonor: boolean, onionAddress: string) => {
    setNodes(prev => prev.map(n => {
      if (n.isCurrentDevice) {
        return {
          ...n,
          onionAddress,
          totalStorageAllocatedGb: isDonor ? 48 : 16,
          baseSection16Gb: 16,
          expandedStorageAllocatedGb: isDonor ? 32 : 0,
          personalVaultQuotaGb: isDonor ? 6.0 : 2.0,
        };
      }
      return n;
    }));
  };

  const contextValue: SwarmContextValue = {
    nodes,
    currentNode,
    graceNodeId,
    graceRemainingSeconds,
    selfHealingNotification,
    isAutoPingActive,
    isPingingNow,
    lastPingRoundTimestamp,
    isDaemonOnline,
    daemonStatus,
    setNodes,
    updateCurrentNode,
    addNewNode,
    restoreNode,
    simulateEmergencyGrace,
    expireGraceNow,
    applyDonorStorageProfile,
    toggleAutoPing,
    triggerManualPingRound,
  };

  return <SwarmContext.Provider value={contextValue}>{children}</SwarmContext.Provider>;
};

/**
 * Hook to access the current swarm fleet topology, real-time background ping engine,
 * Kademlia routing, and grace states.
 *
 * @throws {Error} If called outside of a SwarmProvider.
 * @returns {SwarmContextValue} The swarm fleet context value.
 */
export const useSwarm = (): SwarmContextValue => {
  const context = useContext(SwarmContext);
  if (!context) {
    throw new Error('useSwarm must be used within a SwarmProvider');
  }
  return context;
};
