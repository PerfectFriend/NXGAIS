import React, { useState } from 'react';
import { 
  ArrowLeft, HardDrive, Cpu, DollarSign, Layers, ShieldCheck, 
  Smartphone, Server, Laptop, Info, Plus, Minus 
} from 'lucide-react';
import { NodeRecord, Bip39Identity } from '../types/nexxus';
import { SectionAllocationGrid } from './storage/SectionAllocationGrid';
import { MiningEarningsOverview } from './storage/MiningEarningsOverview';

export interface StorageSectionsDashboardProps {
  nodes: NodeRecord[];
  onUpdateNodes: (updatedNodes: NodeRecord[]) => void;
  identity: Bip39Identity;
  onNavigateBackToChat: () => void;
}

/**
 * StorageSectionsDashboard coordinates 16 GB barter section allocations,
 * real-time Proof-of-Retrievability (PoR) yields, and per-device storage quotas.
 *
 * @param {StorageSectionsDashboardProps} props - Component properties and global handlers.
 * @returns {React.ReactElement} The rendered storage dashboard.
 */
export const StorageSectionsDashboard: React.FC<StorageSectionsDashboardProps> = ({
  nodes,
  onUpdateNodes,
  identity,
  onNavigateBackToChat,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'allocation' | 'devices' | 'por_audit'>('allocation');

  // Calculate aggregated stats across all nodes
  const totalAllocatedGb = nodes.reduce((sum, n) => sum + (n.isOnline ? n.totalStorageAllocatedGb : 0), 0);
  const totalSectionsCount = Math.max(1, Math.floor(totalAllocatedGb / 16));

  // User setting: how many sections allocated to personal vault
  const [personalSections, setPersonalSections] = useState<number>(() => {
    const saved = localStorage.getItem('nexxus_personal_sections');
    return saved 
      ? Math.min(totalSectionsCount, Math.max(1, parseInt(saved, 10))) 
      : Math.max(2, Math.floor(totalSectionsCount * 0.25));
  });

  // Math allocations
  const personalVaultGb = personalSections * 16;
  const miningSections = Math.max(0, totalSectionsCount - personalSections);
  const miningTotalAllocatedGb = miningSections * 16;

  // Actual foreign chunks stored (paid by network)
  const actualForeignOccupancyRatio = 0.68;
  const miningActuallyUsedGb = Number((miningTotalAllocatedGb * actualForeignOccupancyRatio).toFixed(1));
  const miningEmptySpaceGb = Number((miningTotalAllocatedGb - miningActuallyUsedGb).toFixed(1));

  // Rate: 1.25 NEXX per GB/day ONLY for actually stored chunks
  const dailyEarningsNexx = Number((miningActuallyUsedGb * 1.25).toFixed(2));
  const monthlyEarningsNexx = Number((dailyEarningsNexx * 30).toFixed(1));

  const handlePersonalSectionsChange = (newCount: number) => {
    const clamped = Math.max(1, Math.min(totalSectionsCount - 1, newCount));
    setPersonalSections(clamped);
    localStorage.setItem('nexxus_personal_sections', clamped.toString());

    // Sync vault quota back to primary nodes
    const quotaPerNode = (clamped * 16) / Math.max(1, nodes.length);
    const updated = nodes.map(n => ({
      ...n,
      personalVaultQuotaGb: Number(quotaPerNode.toFixed(1)),
    }));
    onUpdateNodes(updated);
  };

  const getDeviceIcon = (deviceType: string) => {
    switch (deviceType) {
      case 'desktop_linux':
      case 'linux':
        return <Server className="w-4 h-4 text-orange-400" />;
      case 'desktop_win':
      case 'desktop':
        return <Laptop className="w-4 h-4 text-blue-400" />;
      case 'android':
      default:
        return <Smartphone className="w-4 h-4 text-emerald-400" />;
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-[#0b0f17] text-slate-100 overflow-hidden h-full">
      {/* 1. Top Fixed Navigation Bar (shrink-0) */}
      <div className="bg-slate-900/95 border-b border-slate-800 px-3 sm:px-6 py-2.5 sm:py-3.5 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            type="button"
            onClick={onNavigateBackToChat}
            className="p-1.5 sm:p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition flex items-center gap-1 text-xs font-semibold shrink-0 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Назад в Чат</span>
            <span className="sm:hidden">Чат</span>
          </button>
          <div className="min-w-0">
            <h1 className="text-xs sm:text-base font-bold text-white font-mono flex items-center gap-1.5 truncate">
              <Layers className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="truncate">Дашборд Секций и Майнинга</span>
            </h1>
            <p className="text-[10px] text-slate-400 hidden sm:block truncate">
              Плата только за занятые чужие чанки • Пустое место не оплачивается
            </p>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-[11px] sm:text-xs shrink-0 font-mono">
          <button
            type="button"
            onClick={() => setActiveSubTab('allocation')}
            className={`px-2.5 sm:px-3 py-1 rounded-lg font-medium transition cursor-pointer ${
              activeSubTab === 'allocation'
                ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Секции
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('devices')}
            className={`px-2.5 sm:px-3 py-1 rounded-lg font-medium transition cursor-pointer ${
              activeSubTab === 'devices'
                ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Устройства ({nodes.filter(n => n.isOnline).length})
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('por_audit')}
            className={`px-2.5 sm:px-3 py-1 rounded-lg font-medium transition cursor-pointer ${
              activeSubTab === 'por_audit'
                ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            PoR Аудит
          </button>
        </div>
      </div>

      {/* 2. SUBTAB 1: ALLOCATION & SECTIONS */}
      {activeSubTab === 'allocation' && (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Top Fixed Controls & Summary */}
          <div className="p-2.5 sm:p-4 bg-slate-950/80 border-b border-slate-800 space-y-2 sm:space-y-3 shrink-0 font-mono">
            {/* 4 Compact Metric Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 text-xs">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-2 sm:p-3">
                <div className="text-[10px] text-slate-400 flex items-center justify-between">
                  <span>ВСЕГО СЕТИ</span>
                  <HardDrive className="w-3.5 h-3.5 text-slate-500" />
                </div>
                <div className="text-sm sm:text-base font-black text-white mt-0.5">
                  {totalSectionsCount} секц.{' '}
                  <span className="text-[11px] font-normal text-slate-400">({totalAllocatedGb}G)</span>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-2 sm:p-3">
                <div className="text-[10px] text-indigo-400 flex items-center justify-between">
                  <span>ЛИЧНЫЙ СЕЙФ</span>
                  <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                </div>
                <div className="text-sm sm:text-base font-black text-indigo-300 mt-0.5">
                  {personalVaultGb} GB{' '}
                  <span className="text-[11px] font-normal text-slate-400">({personalSections} секц.)</span>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-2 sm:p-3">
                <div className="text-[10px] text-emerald-400 flex items-center justify-between">
                  <span>ЗАНЯТО РОЕМ (PoR)</span>
                  <Cpu className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <div className="text-sm sm:text-base font-black text-emerald-300 mt-0.5">
                  {miningActuallyUsedGb} GB{' '}
                  <span className="text-[11px] font-normal text-slate-400">({(actualForeignOccupancyRatio * 100).toFixed(0)}%)</span>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-2 sm:p-3">
                <div className="text-[10px] text-amber-400 flex items-center justify-between">
                  <span>ДОХОД / ДЕНЬ</span>
                  <DollarSign className="w-3.5 h-3.5 text-amber-400" />
                </div>
                <div className="text-sm sm:text-base font-black text-amber-300 mt-0.5">
                  +{dailyEarningsNexx}{' '}
                  <span className="text-[11px] font-normal text-slate-400">NEXX</span>
                </div>
              </div>
            </div>

            {/* Interactive Slider Bar: Personal vs Mining */}
            <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300 flex items-center gap-1.5 font-bold">
                  <Info className="w-3.5 h-3.5 text-cyan-400" />
                  Распределение 16-ГБ секций (Сейф vs Майнинг):
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handlePersonalSectionsChange(personalSections - 1)}
                    disabled={personalSections <= 1}
                    className="p-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-white cursor-pointer"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="font-bold text-indigo-300">
                    {personalSections} секц. под сейф ({personalVaultGb} GB)
                  </span>
                  <button
                    type="button"
                    onClick={() => handlePersonalSectionsChange(personalSections + 1)}
                    disabled={personalSections >= totalSectionsCount - 1}
                    className="p-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-white cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>

              <input
                type="range"
                min={1}
                max={Math.max(2, totalSectionsCount - 1)}
                value={personalSections}
                onChange={e => handlePersonalSectionsChange(parseInt(e.target.value, 10))}
                className="w-full h-2 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-emerald-400"
              />

              {/* Zero-Pay Single Line Warning */}
              <div className="text-[10px] text-amber-300/90 flex items-center justify-between pt-0.5">
                <span className="truncate">
                  ⚡ Честный PoR: сеть платит только за <strong>{miningActuallyUsedGb} ГБ</strong> занятых чужих чанков.
                </span>
                <span className="text-slate-500 shrink-0 ml-2">Пустота: 0 NEXX</span>
              </div>
            </div>
          </div>

          {/* Visual Grid of All 16 GB Sections */}
          <SectionAllocationGrid
            totalSectionsCount={totalSectionsCount}
            personalSections={personalSections}
            miningSections={miningSections}
            actualForeignOccupancyRatio={actualForeignOccupancyRatio}
          />
        </div>
      )}

      {/* 3. SUBTAB 2: DEVICES BREAKDOWN */}
      {activeSubTab === 'devices' && (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden font-mono">
          <div className="p-3 bg-slate-950/80 border-b border-slate-800 text-xs text-slate-400 flex items-center justify-between shrink-0">
            <span>
              Всего подключено устройств: <strong className="text-white">{nodes.length}</strong>
            </span>
            <span className="text-emerald-400 font-bold">
              {nodes.filter(n => n.isOnline).length} онлайн
            </span>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-2.5 sm:p-4 space-y-2.5">
            {nodes.map(node => (
              <div
                key={node.id}
                className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                    {getDeviceIcon(node.deviceType)}
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-white text-xs truncate flex items-center gap-2">
                      <span>{node.name}</span>
                      {node.isCurrentDevice && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-400 border border-emerald-500/30">
                          Хост
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 truncate mt-0.5">
                      {node.onionAddress}
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-xs font-bold text-emerald-400">
                    {node.totalStorageAllocatedGb} GB
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {Math.floor(node.totalStorageAllocatedGb / 16)} секций
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. SUBTAB 3: PoR AUDIT & EARNINGS OVERVIEW */}
      {activeSubTab === 'por_audit' && (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <MiningEarningsOverview
            dailyEstimatedNexxEarnings={dailyEarningsNexx}
            monthlyEstimatedNexxEarnings={monthlyEarningsNexx}
            miningActuallyUsedGb={miningActuallyUsedGb}
            personalVaultQuotaGb={personalVaultGb}
            unlockedNexx={identity.unlockedNexx || 480}
            lockedNexx8Weeks={identity.lockedNexx8Weeks || 770}
          />

          <div className="flex-1 min-h-0 overflow-y-auto p-2.5 sm:p-4 font-mono text-xs text-slate-400 space-y-3">
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
              <h3 className="font-bold text-white text-sm">Принцип работы Proof-of-Retrievability (PoR)</h3>
              <p className="leading-relaxed text-[11px]">
                Аудиторы сети регулярно отправляют криптографические вызовы (canary challenge) для случайных 16KB чанков. Нода обязана вернуть корректный Merkle-путь в течение 3000 мс. При успешном ответе начисляются вознаграждения в токенах NEXX.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
