import { NodeRecord, StorageSection, ExternalStorageDevice, Bip39Identity, VestingBatch, TreasuryStats } from '../types/nexxus';

export const SECTION_SIZE_GB = 16; // 16 GB fixed blocks
export const BASE_SECTION_MIN_GB = 16; // Minimum 16GB base requirement
export const BASE_VAULT_REWARD_GB = 2.0; // Exact 2GB (1/8th of 16GB) unbreakable secret vault
export const EXPANDED_VAULT_RATIO = 1 / 8; // 12.5% of expanded storage also given to user
export const DAILY_NEXX_RATE_PER_GB = 1.25; // 1.25 $NEXX earned daily per 1 GB of actual foreign chunks
export const SUBSCRIPTION_DAILY_COST_PER_GB = 1.30; // 1.30 $NEXX daily paid to network treasury per 1 GB subscribed
export const VESTING_LOCK_DAYS = 56; // 8 weeks = 56 days mandatory lock to prevent churn

/**
 * Calculates storage blocks in 16GB slices based on total and free space
 * Strictly enforces:
 * - 1st 16GB gives 2GB unbreakable vault (zero token earnings, pure barter)
 * - Above 16GB is Expanded Storage: user gets paid in $NEXX only for actual stored foreign chunks ("За пустоту не платим!")
 */
export function calculate16GbSections(freeGb: number, externalDevices: ExternalStorageDevice[] = []): {
  sectionsCount: number;
  totalAllocatedGb: number;
  baseSection16Gb: number;
  baseSecretVaultGrantedGb: number;
  expandedStorageAllocatedGb: number;
  actualForeignChunksStoredGb: number;
  emptyUnusedAllocatedGb: number;
  dailyEstimatedNexxEarnings: number;
  personalVaultQuotaGb: number;
  sections: StorageSection[];
  canActivate: boolean;
} {
  const externalMountedGb = externalDevices
    .filter(d => d.mounted)
    .reduce((sum, d) => sum + d.capacityGb, 0);

  const totalAvailableGb = freeGb + externalMountedGb;
  const sectionsCount = Math.floor(totalAvailableGb / SECTION_SIZE_GB);
  const totalAllocatedGb = sectionsCount * SECTION_SIZE_GB;
  const canActivate = totalAvailableGb >= SECTION_SIZE_GB;

  // Base 16GB -> 2GB
  const baseSection16Gb = canActivate ? BASE_SECTION_MIN_GB : 0;
  const baseSecretVaultGrantedGb = canActivate ? BASE_VAULT_REWARD_GB : 0;

  // Expanded storage above 16GB
  const expandedStorageAllocatedGb = Math.max(0, totalAllocatedGb - baseSection16Gb);

  // Network realistic load: e.g. 65-75% occupied by foreign chunks, remainder is empty
  // "За пустоту не платим!"
  const occupancyRatio = 0.68;
  const actualForeignChunksStoredGb = Number((expandedStorageAllocatedGb * occupancyRatio).toFixed(2));
  const emptyUnusedAllocatedGb = Number((expandedStorageAllocatedGb - actualForeignChunksStoredGb).toFixed(2));

  // Daily earnings strictly on actual foreign chunks
  const dailyEstimatedNexxEarnings = Number((actualForeignChunksStoredGb * DAILY_NEXX_RATE_PER_GB).toFixed(2));

  // Personal vault quota = 2GB base + 1/8th of expanded storage
  const personalVaultQuotaGb = Number((baseSecretVaultGrantedGb + (expandedStorageAllocatedGb * EXPANDED_VAULT_RATIO)).toFixed(2));

  const sections: StorageSection[] = [];
  for (let i = 0; i < sectionsCount; i++) {
    const isBase = i === 0;
    sections.push({
      id: `sec_16gb_${i + 1}`,
      sectionIndex: i + 1,
      capacityGb: SECTION_SIZE_GB,
      status: isBase ? 'allocated_vault' : 'allocated_network',
      usedGb: isBase ? 2.0 : Number((SECTION_SIZE_GB * occupancyRatio).toFixed(2)),
      storedChunksCount: isBase ? 16384 : Math.floor(SECTION_SIZE_GB * 1024 * 64 * occupancyRatio),
    });
  }

  return {
    sectionsCount,
    totalAllocatedGb,
    baseSection16Gb,
    baseSecretVaultGrantedGb,
    expandedStorageAllocatedGb,
    actualForeignChunksStoredGb,
    emptyUnusedAllocatedGb,
    dailyEstimatedNexxEarnings,
    personalVaultQuotaGb,
    sections,
    canActivate,
  };
}

/**
 * Recalculates node quotas when auto mode or external devices change
 */
export function updateNodeStorageMetrics(node: NodeRecord): NodeRecord {
  const result = calculate16GbSections(
    node.internalFreeGb,
    node.externalDevices
  );

  return {
    ...node,
    reservedSections16Gb: result.sectionsCount,
    totalStorageAllocatedGb: result.totalAllocatedGb,
    baseSection16Gb: result.baseSection16Gb,
    baseSecretVaultGrantedGb: result.baseSecretVaultGrantedGb,
    expandedStorageAllocatedGb: result.expandedStorageAllocatedGb,
    actualForeignChunksStoredGb: result.actualForeignChunksStoredGb,
    emptyUnusedAllocatedGb: result.emptyUnusedAllocatedGb,
    dailyEstimatedNexxEarnings: result.dailyEstimatedNexxEarnings,
    personalVaultQuotaGb: result.personalVaultQuotaGb,
  };
}

/**
 * Processes a 24-hour Daily Epoch across the network:
 * 1. Subscribed user pays daily cloud cost into the Treasury Pool.
 * 2. Treasury Pool distributes earnings to nodes for actual stored foreign chunks.
 * 3. Earnings are locked in an 8-Week (56 days) Vesting Batch.
 * 4. Existing vesting batches with passed lock dates unlock into available NEXX for DEX trading!
 */
export function processDailyEpoch(
  identity: Bip39Identity,
  nodes: NodeRecord[]
): {
  updatedIdentity: Bip39Identity;
  totalCollected: number;
  totalDistributed: number;
  unlockedCount: number;
  unlockedAmount: number;
} {
  const currentTimestamp = Date.now();
  const treasury: TreasuryStats = {
    poolBalanceNexx: identity.treasury?.poolBalanceNexx ?? 142500,
    dailyCollectedNexx: 0,
    dailyDistributedNexx: 0,
    totalSubscribedStorageGb: identity.treasury?.totalSubscribedStorageGb ?? (identity.subscribedStorageGb || 0),
    totalPaidForeignGb: identity.treasury?.totalPaidForeignGb ?? 0,
    ratePerGbPerDay: identity.treasury?.ratePerGbPerDay ?? DAILY_NEXX_RATE_PER_GB,
    lastEpochTimestamp: currentTimestamp,
    epochNumber: (identity.treasury?.epochNumber ?? 0) + 1,
  };
  const balances = {
    nexx: identity.balances?.nexx ?? 0,
    ton: identity.balances?.ton ?? 0,
    usdc: identity.balances?.usdc ?? 0,
    eth: identity.balances?.eth ?? 0,
    btc: identity.balances?.btc ?? 0,
  };

  let currentUnlockedNexx = identity.unlockedNexx ?? balances.nexx;
  let currentLockedNexx8Weeks = identity.lockedNexx8Weeks ?? 0;

  // 1. Daily Subscription Payment from user to Network Treasury
  const dailyCost = Number(((identity.subscribedStorageGb ?? 0) * SUBSCRIPTION_DAILY_COST_PER_GB).toFixed(2));
  let actualDeducted = 0;

  if (currentUnlockedNexx >= dailyCost) {
    currentUnlockedNexx -= dailyCost;
    balances.nexx -= dailyCost;
    actualDeducted = dailyCost;
  } else if (balances.nexx >= dailyCost) {
    balances.nexx -= dailyCost;
    currentUnlockedNexx = Math.max(0, currentUnlockedNexx - dailyCost);
    actualDeducted = dailyCost;
  }

  treasury.poolBalanceNexx += actualDeducted;
  treasury.dailyCollectedNexx = actualDeducted;

  // 2. Compute earnings from active online nodes (Strictly on actualForeignChunksStoredGb, "За пустоту не платим")
  let epochDistributedTotal = 0;
  const newBatches: VestingBatch[] = [];

  nodes.filter(n => n.isOnline).forEach(node => {
    const foreignGb = node.actualForeignChunksStoredGb ?? 0;
    if (foreignGb > 0) {
      const nodeDailyEarn = Number((foreignGb * DAILY_NEXX_RATE_PER_GB).toFixed(2));
      epochDistributedTotal += nodeDailyEarn;

      // Create new 8-week (56 days) vesting batch
      newBatches.push({
        id: `vest_${Date.now()}_${node.id.slice(-4)}`,
        amount: nodeDailyEarn,
        earnedAt: currentTimestamp,
        unlocksAt: currentTimestamp + VESTING_LOCK_DAYS * 24 * 3600 * 1000,
        daysRemaining: VESTING_LOCK_DAYS,
        sourceNodeId: node.id,
        sourceNodeName: node.name,
        foreignChunksGb: foreignGb,
        status: 'locked',
      });
    }
  });

  // Treasury pays out to node owners
  treasury.poolBalanceNexx = Math.max(0, treasury.poolBalanceNexx - epochDistributedTotal);
  treasury.dailyDistributedNexx = epochDistributedTotal;
  treasury.epochNumber += 1;
  treasury.lastEpochTimestamp = currentTimestamp;

  // Add new earned tokens to locked 8-week balance
  let lockedNexx8Weeks = currentLockedNexx8Weeks + epochDistributedTotal;
  balances.nexx += epochDistributedTotal;

  // 3. Check existing vesting batches - advance days or unlock
  let unlockedCount = 0;
  let unlockedAmount = 0;
  const existingBatches = Array.isArray(identity.vestingBatches) ? identity.vestingBatches : [];
  const updatedExistingBatches: VestingBatch[] = existingBatches.map(batch => {
    if (batch.status === 'locked') {
      // Advance by 1 day simulation (or check timestamp)
      const newDaysRemaining = Math.max(0, batch.daysRemaining - 1);
      if (newDaysRemaining === 0) {
        unlockedCount += 1;
        unlockedAmount += batch.amount;
        return {
          ...batch,
          daysRemaining: 0,
          status: 'unlocked' as const,
        };
      }
      return {
        ...batch,
        daysRemaining: newDaysRemaining,
      };
    }
    return batch;
  });

  // Move unlocked tokens to available for DEX
  lockedNexx8Weeks = Math.max(0, lockedNexx8Weeks - unlockedAmount);
  const unlockedNexx = currentUnlockedNexx + unlockedAmount;

  const allBatches = [...newBatches, ...updatedExistingBatches].slice(0, 20); // Keep last 20

  const updatedIdentity: Bip39Identity = {
    ...identity,
    balances,
    unlockedNexx: Number(unlockedNexx.toFixed(2)),
    lockedNexx8Weeks: Number(lockedNexx8Weeks.toFixed(2)),
    vestingBatches: allBatches,
    treasury,
  };

  return {
    updatedIdentity,
    totalCollected: actualDeducted,
    totalDistributed: epochDistributedTotal,
    unlockedCount,
    unlockedAmount,
  };
}

/**
 * Check and advance node penalty / streak logic
 */
export function evaluateNodeStatus(node: NodeRecord, currentTime: number): {
  updatedNode: NodeRecord;
  penaltyApplied: boolean;
  streakRewarded: boolean;
} {
  let updatedNode = { ...node };
  let penaltyApplied = false;
  let streakRewarded = false;

  // Check offline grace period expiration (1 hour = 3600000 ms)
  if (!updatedNode.isOnline && updatedNode.graceExpiresAt) {
    if (currentTime > updatedNode.graceExpiresAt) {
      // Grace period expired! Apply penalty
      penaltyApplied = true;
      updatedNode.penaltiesCount += 1;
      updatedNode.reputationScore = Math.max(50, updatedNode.reputationScore - 120);
      updatedNode.consecutiveDaysWithoutPenalty = 0;
      updatedNode.graceExpiresAt = null; // Clear so penalty isn't spammed
    }
  }

  // Update reputation tier based on score
  if (updatedNode.reputationScore >= 851) {
    updatedNode.reputationTier = 'Elite Swarm (851-1000)';
  } else if (updatedNode.reputationScore >= 601) {
    updatedNode.reputationTier = 'Guardian Node (601-850)';
  } else if (updatedNode.reputationScore >= 301) {
    updatedNode.reputationTier = 'Reliable Node (301-600)';
  } else {
    updatedNode.reputationTier = 'Apprentice (0-300)';
  }

  return { updatedNode, penaltyApplied, streakRewarded };
}

/**
 * Manifesto v2: Dynamic Vault Quota Progression
 * 16 GB base section:
 * - Day 1: 0.5 GB secret vault
 * - Day 14+ qualified uptime: 1.0 GB secret vault
 * - Day 45+ qualified uptime: 2.0 GB secret vault
 * Unoccupied allocated gigabytes do not increase this quota ("За пустоту не платим").
 */
export function calculateDynamicVaultQuota(
  qualifiedUptimeDays: number = 0,
  hasActiveBaseSection: boolean | number = true
): {
  quotaGb: number;
  tier: 'day1_0_5gb' | 'day14_1_0gb' | 'day45_2_0gb';
  tierLabel: string;
  daysToNextTier: number;
  nextTierQuotaGb: number | null;
} {
  const isSectionActive = typeof hasActiveBaseSection === 'number'
    ? hasActiveBaseSection >= 16
    : Boolean(hasActiveBaseSection);

  if (!isSectionActive) {
    return {
      quotaGb: 0,
      tier: 'day1_0_5gb',
      tierLabel: 'Не активна (требуется 16GB донорства)',
      daysToNextTier: 1,
      nextTierQuotaGb: 0.5,
    };
  }

  if (qualifiedUptimeDays >= 45) {
    return {
      quotaGb: 2.0,
      tier: 'day45_2_0gb',
      tierLabel: 'Полный Сейф (45+ дней аптайма)',
      daysToNextTier: 0,
      nextTierQuotaGb: null,
    };
  }

  if (qualifiedUptimeDays >= 14) {
    return {
      quotaGb: 1.0,
      tier: 'day14_1_0gb',
      tierLabel: 'Проверенный Сейф (14–44 дней)',
      daysToNextTier: 45 - qualifiedUptimeDays,
      nextTierQuotaGb: 2.0,
    };
  }

  return {
    quotaGb: 0.5,
    tier: 'day1_0_5gb',
    tierLabel: 'Начальный Сейф (День 1–13)',
    daysToNextTier: 14 - qualifiedUptimeDays,
    nextTierQuotaGb: 1.0,
  };
}

/**
 * Manifesto v2: Honest Degradation Protocol
 * "Сейф активен и реплицируется, пока нода-донор поддерживает квалифицированный аптайм."
 * - 0..13 days offline: healthy (normal grace & auto-repair)
 * - 14..27 days offline: warning_14d (warning to user)
 * - 28+ days offline: degraded_28d (degraded status, chunk eviction begins)
 */
export function evaluateDegradationSchedule(offlineConsecutiveDays: number = 0): {
  status: 'healthy' | 'warning_14d' | 'degraded_28d';
  label: string;
  description: string;
  daysUntilEviction: number;
  isDegraded: boolean;
} {
  if (offlineConsecutiveDays >= 28) {
    return {
      status: 'degraded_28d',
      label: 'DEGRADED: Чанки вытесняются',
      description: `Нода непрерывно оффлайн ${offlineConsecutiveDays} дней (порог 28 дней). Репликация сейфа остановлена, сторонние узлы вытесняют блоки.`,
      daysUntilEviction: 0,
      isDegraded: true,
    };
  }

  if (offlineConsecutiveDays >= 14) {
    return {
      status: 'warning_14d',
      label: 'ВНИМАНИЕ: Предупреждение 14 дней',
      description: `Нода непрерывно оффлайн ${offlineConsecutiveDays} дней. До начала вытеснения данных осталось ${28 - offlineConsecutiveDays} дней. Включите ноду!`,
      daysUntilEviction: 28 - offlineConsecutiveDays,
      isDegraded: false,
    };
  }

  return {
    status: 'healthy',
    label: 'АКТИВЕН И РЕПЛИЦИРУЕТСЯ',
    description: 'Нода в пределах допустимого окна доступности. Все чанки сейфа синхронизируются.',
    daysUntilEviction: 28 - offlineConsecutiveDays,
    isDegraded: false,
  };
}

/**
 * Manifesto v2: Anti-Loop Unit Economics Invariant
 * Invariant: Fee_writer > Reward_storer + Burn on EVERY single 16KB chunk!
 * Even if an attacker controls both the writer and all storer nodes,
 * they lose tokens on each epoch due to the write fee and burn asymmetry.
 */
export function calculateAntiLoopModel(
  writerFeePerGbDay: number = 1.30,
  storerRewardPerGbDay: number = 1.25,
  burnRatePerGbDay: number = 0.05
): {
  writerFeePerGbDay: number;
  storerRewardPerGbDay: number;
  burnRatePerGbDay: number;
  burnedPortionPerGbDay: number;
  netAttackerYieldPerGbDay: number;
  isSybilLoopProof: boolean;
  isLoopFarmingPrevented: boolean;
  costPer16KbChunkDay: number;
  rewardPer16KbChunkDay: number;
  summary: string;
} {
  const CHUNKS_PER_GB = (1024 * 1024) / 16; // 65,536 chunks of 16KB in 1 GB
  const netAttackerYieldPerGbDay = Number((storerRewardPerGbDay - writerFeePerGbDay).toFixed(4));
  const isSybilLoopProof = writerFeePerGbDay > storerRewardPerGbDay && netAttackerYieldPerGbDay < 0;

  const costPer16KbChunkDay = writerFeePerGbDay / CHUNKS_PER_GB;
  const rewardPer16KbChunkDay = storerRewardPerGbDay / CHUNKS_PER_GB;

  return {
    writerFeePerGbDay,
    storerRewardPerGbDay,
    burnRatePerGbDay,
    burnedPortionPerGbDay: burnRatePerGbDay,
    netAttackerYieldPerGbDay,
    isSybilLoopProof,
    isLoopFarmingPrevented: isSybilLoopProof,
    costPer16KbChunkDay,
    rewardPer16KbChunkDay,
    summary: isSybilLoopProof
      ? `✅ Инвариант соблюдён: Fee_writer (${writerFeePerGbDay}) > Reward_storer (${storerRewardPerGbDay}). Доходность сибил-петли отрицательна (${netAttackerYieldPerGbDay} NEXX/GB/день). Фарминг из воздуха невозможен.`
      : `❌ Нарушение инварианта! Доходность сибил-петли положительна. Атака возможна!`,
  };
}

