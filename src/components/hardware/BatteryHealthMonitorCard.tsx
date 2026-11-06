import React, { useState, useEffect, useMemo } from 'react';
import { 
  Battery, BatteryCharging, BatteryWarning, Zap, AlertTriangle, 
  ShieldAlert, ShieldCheck, Flame, RefreshCw, Sliders, CheckCircle2,
  Clock, Power, Activity, Thermometer
} from 'lucide-react';
import { NodeRecord } from '../../types/nexxus';
import { triggerHaptic } from '../../utils/haptics';

export interface BatteryHealthMonitorCardProps {
  currentNode: NodeRecord;
  onUpdateCurrentNode: (updated: NodeRecord) => void;
  className?: string;
}

/**
 * BatteryHealthMonitorCard provides real-time battery health telemetry,
 * dynamic drain/charge rate monitoring (%/hr, mA, Watts), estimated time remaining,
 * and automatically triggers 'Low Power Mode' when battery level drops below 20%.
 */
export const BatteryHealthMonitorCard: React.FC<BatteryHealthMonitorCardProps> = ({
  currentNode,
  onUpdateCurrentNode,
  className = '',
}) => {
  const batteryLevel = currentNode.batteryLevel ?? 85;
  const isCharging = currentNode.isCharging ?? true;
  const tempC = currentNode.temperatureC ?? 31.5;

  // Battery specifications for phone node
  const designCapacityMah = 4000;
  const healthPercent = currentNode.batteryHealthPercent ?? 94; // 94% SoH
  const currentMaxCapacityMah = Math.round(designCapacityMah * (healthPercent / 100)); // ~3760 mAh
  const cycleCount = currentNode.batteryCycles ?? 342;

  // Real-time Drain/Charge rate calculation
  // Discharging: -2.8% to -4.5%/hr depending on temperature & load
  // Charging: +18% to +26%/hr
  const drainRatePerHour = useMemo(() => {
    if (isCharging) {
      return 22.5; // +22.5%/hr fast USB-C charge
    }
    const tempFactor = tempC > 36 ? 0.6 : 0;
    return Number((- (3.2 + tempFactor)).toFixed(1)); // e.g. -3.2%/hr
  }, [isCharging, tempC]);

  // Current power draw in Watts and mA
  const currentMah = useMemo(() => {
    if (isCharging) {
      return 1850; // +1850 mA input
    }
    return Math.round(Math.abs(drainRatePerHour) * (currentMaxCapacityMah / 100)); // ~120 - 160 mA
  }, [isCharging, drainRatePerHour, currentMaxCapacityMah]);

  const powerWatts = useMemo(() => {
    const voltage = 3.85; // nominal Li-Ion voltage
    return ((currentMah * voltage) / 1000).toFixed(2);
  }, [currentMah]);

  // Estimated time remaining
  const estimatedTimeText = useMemo(() => {
    if (isCharging) {
      if (batteryLevel >= 100) return 'Полностью заряжен';
      const remainingPercent = 100 - batteryLevel;
      const hoursToFull = remainingPercent / drainRatePerHour;
      const hours = Math.floor(hoursToFull);
      const minutes = Math.round((hoursToFull - hours) * 60);
      return hours > 0 ? `${hours} ч ${minutes} мин до 100%` : `${minutes} мин до 100%`;
    } else {
      if (batteryLevel <= 0) return 'Батарея разряжена';
      const hoursToEmpty = batteryLevel / Math.abs(drainRatePerHour);
      const hours = Math.floor(hoursToEmpty);
      const minutes = Math.round((hoursToEmpty - hours) * 60);
      return `${hours} ч ${minutes} мин до 0%`;
    }
  }, [isCharging, batteryLevel, drainRatePerHour]);

  // Automatic Low Power Mode Trigger (< 20%)
  const isBelow20 = batteryLevel < 20;
  const isLowPowerMode = currentNode.isLowPowerMode ?? isBelow20;

  // Sync low power mode automatically when battery drops below 20%
  useEffect(() => {
    if (isBelow20 && !currentNode.isLowPowerMode) {
      triggerHaptic('warning');
      onUpdateCurrentNode({
        ...currentNode,
        isLowPowerMode: true,
      });
    } else if (!isBelow20 && currentNode.isLowPowerMode && batteryLevel >= 25) {
      // Automatically exit low power mode when battery recovers above 25% (hysteresis)
      onUpdateCurrentNode({
        ...currentNode,
        isLowPowerMode: false,
      });
    }
  }, [batteryLevel, isBelow20, currentNode, onUpdateCurrentNode]);

  // Manual toggle for Low Power Mode
  const handleToggleLowPowerMode = () => {
    triggerHaptic('medium');
    onUpdateCurrentNode({
      ...currentNode,
      isLowPowerMode: !isLowPowerMode,
    });
  };

  // Simulation helpers for testing battery behavior
  const handleSetBatteryLevel = (level: number) => {
    triggerHaptic('light');
    const newLowPower = level < 20;
    onUpdateCurrentNode({
      ...currentNode,
      batteryLevel: level,
      isLowPowerMode: newLowPower,
    });
  };

  const handleToggleCharging = () => {
    triggerHaptic('light');
    onUpdateCurrentNode({
      ...currentNode,
      isCharging: !isCharging,
    });
  };

  return (
    <div className={`bg-gradient-to-br from-slate-900 via-slate-900/95 to-slate-950 border ${
      isLowPowerMode 
        ? 'border-amber-500/60 shadow-amber-950/30' 
        : 'border-slate-800'
    } rounded-2xl p-4 sm:p-5 shadow-xl relative overflow-hidden space-y-4 ${className}`}>
      {/* Ambient background glow */}
      <div 
        className={`absolute -top-12 -left-12 w-48 h-48 rounded-full blur-3xl pointer-events-none transition-all duration-700 ${
          isLowPowerMode ? 'bg-amber-500/15' : isCharging ? 'bg-emerald-500/10' : 'bg-cyan-500/10'
        }`}
      />

      {/* Header with Title and Mode Badges */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-800/80 pb-3 relative z-10">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 ${
            isLowPowerMode 
              ? 'bg-amber-500/20 border-amber-500/40 text-amber-400' 
              : isCharging 
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
              : 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400'
          }`}>
            {isCharging ? (
              <BatteryCharging className="w-4 h-4 animate-pulse" />
            ) : isLowPowerMode ? (
              <BatteryWarning className="w-4 h-4 text-amber-400" />
            ) : (
              <Battery className="w-4 h-4" />
            )}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold font-mono text-white truncate">
                Мониторинг Батареи & Питания 24/7
              </h3>
              {isLowPowerMode ? (
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-950/90 border border-amber-500/50 text-amber-300 animate-pulse">
                  LOW POWER MODE
                </span>
              ) : isCharging ? (
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-950/90 border border-emerald-500/40 text-emerald-300">
                  CHARGING
                </span>
              ) : (
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                  DISCHARGING
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 font-mono truncate">
              Контроль скорости разряда, износа ячеек и автоматическое энергосбережение
            </p>
          </div>
        </div>

        {/* Low Power Mode Toggle Switch */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] font-mono text-slate-400 hidden xs:inline">
            Энергосбережение:
          </span>
          <button
            type="button"
            onClick={handleToggleLowPowerMode}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
              isLowPowerMode ? 'bg-amber-500' : 'bg-slate-700'
            }`}
            title="Ручное включение/выключение Low Power Mode"
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                isLowPowerMode ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Low Power Mode Active Alert Banner */}
      {isLowPowerMode && (
        <div className="p-3.5 rounded-xl bg-amber-950/60 border border-amber-500/50 space-y-2 relative z-10 animate-in fade-in">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs font-mono">
              <div className="font-bold text-amber-200 flex items-center gap-2">
                <span>Режим Low Power Mode активирован (Заряд {batteryLevel}% &lt; 20%)</span>
              </div>
              <p className="text-amber-300/80 text-[11px] mt-0.5 leading-relaxed">
                Во избежание аварийного отключения телефона и потери рейтинга (Slashing) применены защитные ограничения:
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[10px] font-mono pt-1 text-amber-200/90">
            <div className="bg-slate-950/70 p-2 rounded-lg border border-amber-500/20 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>Пинг ноды: интервал 30 сек</span>
            </div>
            <div className="bg-slate-950/70 p-2 rounded-lg border border-amber-500/20 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>Репликация 16Кб: на паузе</span>
            </div>
            <div className="bg-slate-950/70 p-2 rounded-lg border border-amber-500/20 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>WakeLock: отключён</span>
            </div>
          </div>
        </div>
      )}

      {/* Main Stats Grid: Battery Level & Drain Rate Breakdown */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center relative z-10">
        {/* Left Column: Visual Battery Capacity Card */}
        <div className="sm:col-span-5 p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400">Уровень заряда:</span>
            <div className="flex items-center gap-1 font-mono font-bold text-lg">
              <span className={
                isLowPowerMode ? 'text-amber-400' : isCharging ? 'text-emerald-400' : 'text-white'
              }>
                {batteryLevel}%
              </span>
              {isCharging && <Zap className="w-3.5 h-3.5 text-emerald-400" />}
            </div>
          </div>

          {/* Graphical Battery Bar */}
          <div className="space-y-1.5">
            <div className="w-full bg-slate-900 h-3 rounded-full overflow-hidden border border-slate-800 p-0.5">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  isLowPowerMode
                    ? 'bg-gradient-to-r from-red-500 to-amber-500'
                    : isCharging
                    ? 'bg-gradient-to-r from-emerald-500 to-cyan-400'
                    : 'bg-gradient-to-r from-cyan-500 to-emerald-400'
                }`}
                style={{ width: `${Math.min(100, Math.max(3, batteryLevel))}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
              <span>0%</span>
              <span className="text-amber-400 font-bold">20% (Порог Low Power)</span>
              <span>100%</span>
            </div>
          </div>

          {/* Time Remaining Metric */}
          <div className="pt-1 flex items-center gap-2 text-xs font-mono text-slate-300">
            <Clock className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span className="truncate">{estimatedTimeText}</span>
          </div>
        </div>

        {/* Right Column: Real-time Drain Rates & Battery Health */}
        <div className="sm:col-span-7 space-y-2.5">
          {/* Key Electrical Metrics */}
          <div className="grid grid-cols-3 gap-2 text-xs font-mono">
            {/* Drain Rate */}
            <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800/80">
              <div className="text-[10px] text-slate-400 truncate">Скорость разряда</div>
              <div className={`text-sm font-bold mt-0.5 ${
                isCharging ? 'text-emerald-400' : isLowPowerMode ? 'text-amber-400' : 'text-cyan-300'
              }`}>
                {drainRatePerHour > 0 ? `+${drainRatePerHour}` : drainRatePerHour} %/ч
              </div>
            </div>

            {/* Current Draw / Charge Current */}
            <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800/80">
              <div className="text-[10px] text-slate-400 truncate">Ток / Мощность</div>
              <div className="text-sm font-bold text-white mt-0.5 truncate">
                {currentMah} mA <span className="text-[10px] text-slate-400 font-normal">({powerWatts}W)</span>
              </div>
            </div>

            {/* Battery Health (SoH) */}
            <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800/80">
              <div className="text-[10px] text-slate-400 truncate">Здоровье ячеек</div>
              <div className="text-sm font-bold text-emerald-400 mt-0.5 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>{healthPercent}%</span>
              </div>
            </div>
          </div>

          {/* Cell Longevity Specs */}
          <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-[11px] font-mono space-y-1.5">
            <div className="flex items-center justify-between text-[10px] text-slate-400 border-b border-slate-800/80 pb-1">
              <span>Параметры аккумулятора ноды:</span>
              <span className="text-emerald-400 flex items-center gap-1">
                <Thermometer className="w-3 h-3 text-orange-400" />
                {tempC}°C (Норма &lt; 42°C)
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-300 pt-0.5">
              <div>
                <span className="text-slate-500">Ёмкость: </span>
                <span className="text-white font-bold">{currentMaxCapacityMah} / {designCapacityMah} mAh</span>
              </div>
              <div className="text-right">
                <span className="text-slate-500">Циклы зарядки: </span>
                <span className="text-white font-bold">{cycleCount} / 800</span>
              </div>
            </div>
          </div>

          {/* Quick Simulation Bar for Easy Testing */}
          <div className="flex items-center justify-between gap-1.5 pt-1 text-[10px] font-mono">
            <span className="text-slate-500 hidden sm:inline">Симуляция:</span>
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => handleSetBatteryLevel(15)}
                className={`px-2 py-0.5 rounded border transition cursor-pointer ${
                  batteryLevel === 15 
                    ? 'bg-amber-950 text-amber-300 border-amber-500/50' 
                    : 'bg-slate-800/70 hover:bg-slate-800 text-slate-300 border-slate-700'
                }`}
                title="Сымитировать падение до 15% для проверки Low Power Mode"
              >
                15% (Low Power)
              </button>

              <button
                type="button"
                onClick={() => handleSetBatteryLevel(50)}
                className={`px-2 py-0.5 rounded border transition cursor-pointer ${
                  batteryLevel === 50 
                    ? 'bg-cyan-950 text-cyan-300 border-cyan-500/50' 
                    : 'bg-slate-800/70 hover:bg-slate-800 text-slate-300 border-slate-700'
                }`}
              >
                50%
              </button>

              <button
                type="button"
                onClick={() => handleSetBatteryLevel(94)}
                className={`px-2 py-0.5 rounded border transition cursor-pointer ${
                  batteryLevel === 94 
                    ? 'bg-emerald-950 text-emerald-300 border-emerald-500/50' 
                    : 'bg-slate-800/70 hover:bg-slate-800 text-slate-300 border-slate-700'
                }`}
              >
                94% (Full)
              </button>

              <button
                type="button"
                onClick={handleToggleCharging}
                className="px-2 py-0.5 rounded bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1 cursor-pointer"
                title="Переключить USB-C питание"
              >
                <Zap className="w-3 h-3 text-emerald-400" />
                <span>{isCharging ? 'Кабель: ВКЛ' : 'Кабель: ВЫКЛ'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
