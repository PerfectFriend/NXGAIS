import { useMemo } from 'react';
import { NodeRecord } from '../types/nexxus';

export interface StorageBarterMetrics {
  /** Total storage capacity across all nodes in GB */
  totalCapacityGb: number;
  /** Online storage capacity in GB */
  onlineCapacityGb: number;
  /** Total count of 16 GB storage sections */
  totalSections: number;
  /** Total private vault quota granted in GB */
  totalVaultQuotaGb: number;
  /** Estimated daily earnings in NEXX tokens */
  dailyEarningsNexx: number;
  /** Estimated monthly earnings in NEXX tokens */
  monthlyEarningsNexx: number;
  /** Foreign chunks stored in GB */
  foreignChunksStoredGb: number;
  /** Empty unused allocated capacity in GB */
  emptyUnusedAllocatedGb: number;
}

/**
 * Custom React hook calculating the exact barter mathematics and tokenomics
 * defined by the NeXXus Protocol Specification:
 * - 1 base barter section (16 GB) provides 2.0 GB of private encrypted vault space.
 * - Expansion storage provides 1/8 private quota and yields 1.25 NEXX/GB/day from foreign chunks.
 *
 * @param {NodeRecord[]} nodes - Current cluster node records.
 * @returns {StorageBarterMetrics} Computed barter metrics and economic yield.
 */
export function useStorageBarter(nodes: NodeRecord[]): StorageBarterMetrics {
  return useMemo(() => {
    let totalCapacityGb = 0;
    let onlineCapacityGb = 0;
    let totalVaultQuotaGb = 0;
    let dailyEarningsNexx = 0;
    let foreignChunksStoredGb = 0;
    let emptyUnusedAllocatedGb = 0;

    for (const node of nodes) {
      totalCapacityGb += node.totalStorageAllocatedGb;
      if (node.isOnline) {
        onlineCapacityGb += node.totalStorageAllocatedGb;
        totalVaultQuotaGb += node.personalVaultQuotaGb;
        dailyEarningsNexx += node.dailyEstimatedNexxEarnings;
        foreignChunksStoredGb += node.actualForeignChunksStoredGb;
        emptyUnusedAllocatedGb += node.emptyUnusedAllocatedGb;
      }
    }

    const totalSections = Math.max(1, Math.floor(onlineCapacityGb / 16));
    const monthlyEarningsNexx = Number((dailyEarningsNexx * 30).toFixed(2));

    return {
      totalCapacityGb,
      onlineCapacityGb,
      totalSections,
      totalVaultQuotaGb: Number(totalVaultQuotaGb.toFixed(1)),
      dailyEarningsNexx: Number(dailyEarningsNexx.toFixed(2)),
      monthlyEarningsNexx,
      foreignChunksStoredGb: Number(foreignChunksStoredGb.toFixed(1)),
      emptyUnusedAllocatedGb: Number(emptyUnusedAllocatedGb.toFixed(1)),
    };
  }, [nodes]);
}
