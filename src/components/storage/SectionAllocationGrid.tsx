import React, { useState } from 'react';
import { Layers, X } from 'lucide-react';

export interface SectionAllocationGridProps {
  totalSectionsCount: number;
  personalSections: number;
  miningSections: number;
  actualForeignOccupancyRatio: number;
}

/**
 * SectionAllocationGrid visualizes all 16 GB storage sections across the swarm,
 * color-coding them into private secret vault space, active foreign chunk storage (RF=6×),
 * and empty unused capacity.
 *
 * @param {SectionAllocationGridProps} props - Component properties and ratio parameters.
 * @returns {React.ReactElement} The rendered section grid.
 */
export const SectionAllocationGrid: React.FC<SectionAllocationGridProps> = ({
  totalSectionsCount,
  personalSections,
  miningSections,
  actualForeignOccupancyRatio,
}) => {
  const [selectedSectionDetail, setSelectedSectionDetail] = useState<number | null>(null);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-2.5 sm:p-4 space-y-3 font-mono">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-bold text-white flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-cyan-400" />
          <span>Карта 16-ГБ секций ({totalSectionsCount} шт.)</span>
        </div>

        {/* Mini Legend */}
        <div className="flex items-center gap-2 text-[10px]">
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded bg-indigo-500" />
            <span className="text-slate-300">Сейф</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded bg-emerald-500" />
            <span className="text-slate-300">Занято</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded bg-slate-800 border border-slate-700" />
            <span className="text-slate-500">Пусто</span>
          </div>
        </div>
      </div>

      {/* Visual Grid of All 16 GB Sections */}
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
        {Array.from({ length: totalSectionsCount }).map((_, index) => {
          const isPersonal = index < personalSections;
          const miningIndex = index - personalSections;
          const isOccupiedMining =
            !isPersonal && miningIndex < Math.round(miningSections * actualForeignOccupancyRatio);

          return (
            <button
              key={index}
              type="button"
              onClick={() => setSelectedSectionDetail(index)}
              className={`h-16 rounded-xl border p-2 text-left flex flex-col justify-between transition group relative cursor-pointer ${
                isPersonal
                  ? 'bg-indigo-950/40 border-indigo-500/50 hover:border-indigo-400'
                  : isOccupiedMining
                  ? 'bg-emerald-950/40 border-emerald-500/50 hover:border-emerald-400'
                  : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
              } ${selectedSectionDetail === index ? 'ring-2 ring-white' : ''}`}
            >
              <div className="flex items-center justify-between text-[10px]">
                <span
                  className={
                    isPersonal ? 'text-indigo-300' : isOccupiedMining ? 'text-emerald-300' : 'text-slate-500'
                  }
                >
                  #{index + 1}
                </span>
                <span className="text-[9px] text-slate-500">16 ГБ</span>
              </div>
              <div className="text-[10px] truncate">
                {isPersonal ? (
                  <span className="text-indigo-400 font-bold">СЕЙФ</span>
                ) : isOccupiedMining ? (
                  <span className="text-emerald-400 font-bold">RF=6×</span>
                ) : (
                  <span className="text-slate-600">ПУСТО</span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected Section Inspection Detail Modal/Card */}
      {selectedSectionDetail !== null && (
        <div className="p-4 rounded-xl bg-slate-950 border border-slate-700 space-y-3 animate-in fade-in slide-in-from-bottom-2 shadow-xl">
          <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="font-bold text-white text-sm">Секция #{selectedSectionDetail + 1} (16.0 GB)</span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                  selectedSectionDetail < personalSections
                    ? 'bg-indigo-950 text-indigo-300 border border-indigo-500/40'
                    : selectedSectionDetail - personalSections <
                      Math.round(miningSections * actualForeignOccupancyRatio)
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                    : 'bg-slate-900 text-slate-400 border border-slate-700'
                }`}
              >
                {selectedSectionDetail < personalSections
                  ? 'Личный Неуничтожимый Сейф'
                  : selectedSectionDetail - personalSections <
                    Math.round(miningSections * actualForeignOccupancyRatio)
                  ? 'Майнинг Сети (Занято RF=6×)'
                  : 'Майнинг Сети (Резерв • В ожидании чанков)'}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setSelectedSectionDetail(null)}
              className="text-xs text-slate-400 hover:text-white p-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 shrink-0 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
            <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800">
              <span className="text-slate-400 block text-[10px]">Шифрование & RS:</span>
              <span className="text-indigo-400 font-bold">ChaCha20 + RS(4+2)</span>
            </div>

            <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800">
              <span className="text-slate-400 block text-[10px]">Ёмкость чанков:</span>
              <span className="text-white font-bold">1,048,576 × 16 KB</span>
            </div>

            <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800">
              <span className="text-slate-400 block text-[10px]">Доход секции:</span>
              <span className={
                selectedSectionDetail < personalSections
                  ? 'text-slate-400'
                  : selectedSectionDetail - personalSections < Math.round(miningSections * actualForeignOccupancyRatio)
                  ? 'text-emerald-400 font-bold'
                  : 'text-amber-400'
              }>
                {selectedSectionDetail < personalSections
                  ? '0 NEXX (Личный сейф)'
                  : selectedSectionDetail - personalSections < Math.round(miningSections * actualForeignOccupancyRatio)
                  ? '+20.00 NEXX / день'
                  : '0 NEXX (Пустое место)'}
              </span>
            </div>

            <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800">
              <span className="text-slate-400 block text-[10px]">Хост-устройство:</span>
              <span className="text-cyan-300 font-bold truncate block">
                {selectedSectionDetail > 3 && selectedSectionDetail <= 27
                  ? 'Beelink SER9 (Linux NVMe)'
                  : 'Galaxy S9 (Android UFS)'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
