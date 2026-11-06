export type DeviceType = 'android' | 'desktop_win' | 'desktop_linux' | 'apple_client';

export type ReputationTier = 'Apprentice (0-300)' | 'Reliable Node (301-600)' | 'Guardian Node (601-850)' | 'Elite Swarm (851-1000)';

export type StorageTier = 'hot_rf6' | 'cold_archive_rf4';

export type DegradationStatus = 'healthy' | 'warning_14d' | 'degraded_28d';

export type DynamicVaultTier = 'day1_0_5gb' | 'day14_1_0gb' | 'day45_2_0gb';

export interface AntiLoopModelResult {
  chunkSizeBytes: number;
  replicationFactor: number;
  writerFeePerGbDay: number;
  storerRewardPerGbDay: number;
  burnRatePerGbDay: number;
  netAttackerYieldPerGbDay: number;
  isSybilLoopProof: boolean; // Fee_writer > Reward_storer + Burn
  formulaSummary: string;
}

export interface ExternalStorageDevice {
  id: string;
  name: string;
  type: 'sd_card' | 'usb_otg' | 'external_ssd';
  capacityGb: number;
  mounted: boolean;
}

export interface VestingBatch {
  id: string;
  amount: number;
  earnedAt: number; // timestamp
  unlocksAt: number; // timestamp (+56 days)
  daysRemaining: number;
  sourceNodeId: string;
  sourceNodeName: string;
  foreignChunksGb: number;
  status: 'locked' | 'unlocked';
}

export interface TreasuryStats {
  poolBalanceNexx: number;
  dailyCollectedNexx: number;
  dailyDistributedNexx: number;
  totalSubscribedStorageGb: number;
  totalPaidForeignGb: number;
  ratePerGbPerDay: number; // 1.25 NEXX per GB/day
  lastEpochTimestamp: number;
  epochNumber: number;
}

export interface StorageSection {
  id: string;
  sectionIndex: number;
  capacityGb: number; // 16GB fixed per section
  status: 'allocated_network' | 'allocated_vault' | 'free_unallocated';
  usedGb: number;
  storedChunksCount: number;
}

export interface NodeRecord {
  id: string;
  name: string;
  deviceType: DeviceType;
  model: string;
  isOnline: boolean;
  isCurrentDevice: boolean;
  onionAddress: string;
  v2rayActive: boolean;
  torActive: boolean;
  smpServerRunning: boolean;
  xFTPRelayRunning: boolean;
  
  // Hardware & battery
  batteryLevel: number;
  isCharging: boolean;
  temperatureC: number;
  batteryHealthPercent?: number; // e.g. 94%
  batteryCycles?: number; // e.g. 342 cycles
  batteryDrainRatePerHour?: number; // e.g. -3.2 (%/h) or +18.5 when charging
  isLowPowerMode?: boolean; // triggers when battery < 20%
  wifiSsid: string;
  wifiSignalDbm: number;

  // Storage breakdown
  internalTotalGb: number;
  internalFreeGb: number;
  autoModeEnabled: boolean;
  reservedSections16Gb: number; // e.g. 3 x 16GB = 48GB
  totalStorageAllocatedGb: number;
  
  // 16GB -> 2GB Base rule & Expanded Storage
  baseSection16Gb: number; // 16GB base requirement
  baseSecretVaultGrantedGb: number; // 2.0 GB indestructible vault
  expandedStorageAllocatedGb: number; // extra beyond 16GB (e.g. 32GB)
  actualForeignChunksStoredGb: number; // actual foreign chunks stored (paid)
  emptyUnusedAllocatedGb: number; // empty space (zero pay!)
  dailyEstimatedNexxEarnings: number; // calculated from actualForeignChunksStoredGb

  // Vault Quotas
  personalVaultQuotaGb: number; // base 2GB + (expanded * 1/8)
  personalVaultUsedGb: number;
  qualifiedUptimeDays?: number; // Days node maintained >95% uptime
  offlineConsecutiveDays?: number; // Days offline without reconnecting
  dynamicVaultQuotaGb?: number; // 0.5 GB (day 1) -> 1.0 GB (day 14) -> 2.0 GB (day 45)
  degradationStatus?: DegradationStatus; // 'healthy' | 'warning_14d' | 'degraded_28d'

  // Reputation & Penalties
  reputationScore: number; // 0 to 1000
  reputationTier: ReputationTier;
  consecutiveDaysWithoutPenalty: number; // 30 days needed for rank boost
  penaltiesCount: number;
  offlineSince: number | null;
  graceExpiresAt: number | null;

  // Protocol Stats
  storedChunksCount: number;
  replicatedChunksServed: number;
  bandwidthSharedMb: number;

  // LAN Peering (mDNS) - Opt-in for trusted home Wi-Fi (disabled by default for high anonymity)
  lanPeeringMdnsEnabled?: boolean;
  auditorNftGranted?: boolean;
  asn?: string;
  isp?: string;

  // Real-time Availability & Background Ping Telemetry
  pingLatencyMs?: number;
  lastPingTimestamp?: number;
  pingStatus?: 'healthy' | 'degraded' | 'offline' | 'pinging';
  consecutiveFailedPings?: number;

  externalDevices: ExternalStorageDevice[];
}

export interface AuditorNftMandate {
  id: string;
  tokenId: number;
  epochNumber: number;
  nodeId: string;
  nodeName: string;
  stakedNexxAmount: number;
  holderRank: number; // Top 10% percentile
  issuedAt: number;
  expiresAt: number;
  sessionSessionKeyEd25519: string;
  bountyEarnedNexx: number;
  status: 'active' | 'completed' | 'slashed';
  completedAuditsCount: number;
  totalChallengesAssigned: number;
}

export interface ChunkRecord {
  chunkId: string;
  fileId: string;
  chunkIndex: number;
  sizeBytes: number; // default 16384 (16KB)
  hash: string;
  replicaNodes: string[]; // 6 node IDs (6x hot redundancy) or 4 node IDs (cold archive)
  status: 'synced' | 're_routing' | 'healing';
  storageTier?: StorageTier; // 'hot_rf6' | 'cold_archive_rf4'
  isCanaryTrap?: boolean; // ~6% canary chunks used for auditor trap tests
  // Per-node unique encryption commitment (kills outsourcing attack)
  perNodeCommitments?: Record<string, string>; // nodeId -> Enc(KDF(NodeID, ChunkID))
}

// Manifesto v2: VOPRF Blind-Signed ASN Credential
export interface AsnCredential {
  asBucket: number; // 0..255 (sha256(ASN)[0])
  issuedAt: number;
  blindedSignature: string;
  attesterPubkeys: string[]; // 3 of 5 attesters
  verified: boolean; // false in MVP-A, true in MVP-B
}

// Manifesto v2: PoUSS Metric & Composite Mint Trigger
export interface PoussScore {
  porSuccessScore: number; // chunks successfully verified
  stakedTokensVested: number;
  uptimeQualifiedDays: number;
  totalScore: number; // porSuccessScore * log2(1 + staked) * uptimeDays
  isCandidateForAuditor: boolean;
  hasBondUsdt: boolean;
}

export interface CompositeMintTrigger {
  uniqueVerifiedAsCount: number; // Target >= 40
  medianQualifiedUptimeDays: number; // Target >= 21
  totalBondUsdt: number; // Target >= 10 * expected_annual_mint / 51
  sybilClusterScore: number; // Target < tau (e.g. < 0.12)
  isMintEnabled: boolean;
  rampPhaseDays: number; // 0..180 days (5% to 100% linear ramp)
}

export interface VaultFile {
  id: string;
  name: string;
  sizeBytes: number;
  mimeType: string;
  chunksCount: number;
  uploadedAt: number;
  encryptionAlgorithm: 'ChaCha20-Poly1305' | 'AES-256-GCM';
  storageTier?: StorageTier; // 'hot_rf6' (default) or 'cold_archive_rf4'
  rootHash: string;
  chunks: ChunkRecord[];
}

export interface Bip39Identity {
  mnemonic: string[];
  seedHex: string;
  masterPublicKey: string;
  onionAddress: string;
  accountAddress: string;
  createdAt: number;
  balances: {
    nexx: number; // total = unlocked + locked
    ton: number;
    usdc: number;
    eth: number;
    btc: number;
  };
  // 8-Week Vesting & Anti-Churn lock
  unlockedNexx: number; // available for DEX swap or withdrawal
  lockedNexx8Weeks: number; // locked for 56 days
  vestingBatches: VestingBatch[];
  
  // Storage Quota
  subscribedStorageGb: number; // Extra storage bought via $NEXX
  dailyStorageExpenseNexx: number; // Daily payment to treasury for extra storage
  treasury: TreasuryStats;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderOnion: string;
  recipientId: string;
  text: string;
  timestamp: number;
  protocol: 'SMP' | 'xFTP';
  attachment?: {
    name: string;
    sizeBytes: number;
    chunksCount: number;
    fileId: string;
  };
  isRelayedViaPrivateServer: boolean;
  status: 'sent' | 'delivered' | 'encrypted';
  burner?: {
    ttlSeconds: number; // e.g. 30, 3600, 86400
    isBurned?: boolean;
    revealed?: boolean;
    expiresAt?: number;
  };
  reaction?: string;
}

export interface OrderBookItem {
  id: string;
  type: 'buy' | 'sell';
  pair: 'NEXX/USDC' | 'NEXX/TON' | 'NEXX/ETH' | 'NEXX/BTC';
  price: number;
  amount: number;
  total: number;
  timestamp: number;
}

export interface SystemPermissionItem {
  key: string;
  title: string;
  description: string;
  granted: boolean;
  critical: boolean;
}
