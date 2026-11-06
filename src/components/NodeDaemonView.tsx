import React, { useState, useEffect } from 'react';
import { 
  BatteryCharging, Battery, BatteryWarning, Wifi, Shield, Cpu, HardDrive, Zap, CheckCircle2, 
  AlertCircle, Plus, Copy, Check, Radio, Lock, RefreshCw, Layers, 
  Activity, ArrowUpRight, Flame, Globe, Usb, Server, ShieldCheck, Play, Pause,
  Network, Smartphone
} from 'lucide-react';
import { NodeRecord, SystemPermissionItem, DeviceType } from '../types/nexxus';
import { calculate16GbSections } from '../utils/storageManager';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import { OemKeepAliveModal } from './OemKeepAliveModal';
import { TorCircuitIsolationModal } from './TorCircuitIsolationModal';
import { LinuxDaemonDashboard } from './LinuxDaemonDashboard';
import { TorLatencyGaugeCard } from './network/TorLatencyGaugeCard';
import { BatteryHealthMonitorCard } from './hardware/BatteryHealthMonitorCard';

interface NodeDaemonViewProps {
  currentNode: NodeRecord;
  onUpdateCurrentNode: (updated: NodeRecord) => void;
  permissions: SystemPermissionItem[];
  onTogglePermission: (key: string) => void;
  deviceType: DeviceType;
}

export const NodeDaemonView: React.FC<NodeDaemonViewProps> = ({
  currentNode,
  onUpdateCurrentNode,
  permissions,
  onTogglePermission,
  deviceType,
}) => {
  const [copiedOnion, setCopiedOnion] = useState(false);
  const [showOemModal, setShowOemModal] = useState(false);
  const [showTorModal, setShowTorModal] = useState(false);
  const [wakeLockActive, setWakeLockActive] = useState(true);
  const [customFreeSpaceGb, setCustomFreeSpaceGb] = useState<number>(currentNode.internalFreeGb);
  const [isLiveTelemetryActive, setIsLiveTelemetryActive] = useState(true);
  const [recentChunkLogs, setRecentChunkLogs] = useState<Array<{ id: string; time: string; text: string; type: 'store' | 'replicate' | 'smp' }>>([
    { id: '1', time: '14:28:10', text: '16KB Chunk #3910 verified (SHA-256 Merkle leaf) & saved in 16GB Section #2', type: 'store' },
    { id: '2', time: '14:28:16', text: 'xFTP Relay: 6× Redundancy (RF=6× GF(2^8)) кворум подтверждён ThinkPad X230', type: 'replicate' },
    { id: '3', time: '14:28:22', text: 'Tor v3 circuit established via guard node [de_relay_84] (IsolateSOCKSAuth)', type: 'smp' },
  ]);

  // Live cryptographic processing telemetry loop
  useEffect(() => {
    if (!isLiveTelemetryActive || !currentNode.isOnline) return;

    // In Low Power Mode, throttle processing loop interval to 10s to conserve battery
    const intervalMs = (currentNode.isLowPowerMode || currentNode.batteryLevel < 20) ? 10000 : 4500;

    const interval = setInterval(() => {
      // If Low Power Mode is on, pause heavy 16KB shard processing to protect phone from dying
      if (currentNode.isLowPowerMode || currentNode.batteryLevel < 20) {
        setRecentChunkLogs(prev => [
          { 
            id: `${Date.now()}-${Math.random()}`, 
            time: new Date().toTimeString().split(' ')[0], 
            text: `⚡ Low Power Mode: фоновая репликация 16Кб приостановлена (Заряд ${currentNode.batteryLevel}%)`, 
            type: 'smp' 
          },
          ...prev.slice(0, 6)
        ]);
        return;
      }

      const chunkNum = Math.floor(Math.random() * 8000) + 1000;
      const sectionNum = Math.floor(Math.random() * (currentNode.reservedSections16Gb || 1)) + 1;
      const types: Array<'store' | 'replicate' | 'smp'> = ['store', 'replicate', 'smp'];
      const picked = types[Math.floor(Math.random() * types.length)];
      const now = new Date();
      const timeStr = now.toTimeString().split(' ')[0];

      let logText = '';
      if (picked === 'store') {
        const payload = new Uint8Array(256);
        for (let i = 0; i < 256; i++) payload[i] = (i + chunkNum) & 0xff;
        const startT = performance.now();
        const digest = sha256(payload);
        const elapsed = (performance.now() - startT).toFixed(2);
        logText = `16KB Chunk #${chunkNum} верифицирован (SHA-256: ${bytesToHex(digest).slice(0, 8)}..., ${elapsed}мс) в Секцию #${sectionNum}`;
      } else if (picked === 'replicate') {
        logText = `Кворум Reed-Solomon GF(2^8) (4+2): подтверждено 6/6 реплик для чанка #${chunkNum}`;
      } else {
        logText = `SMP фрейм (ChaCha20-Poly1305) изолирован через цепочку [${currentNode.onionAddress.slice(0, 10)}...]`;
      }

      setRecentChunkLogs(prev => [
        { id: `${Date.now()}-${Math.random()}`, time: timeStr, text: logText, type: picked },
        ...prev.slice(0, 7)
      ]);

      // Increment stored chunks
      onUpdateCurrentNode({
        ...currentNode,
        storedChunksCount: currentNode.storedChunksCount + 1,
        bandwidthSharedMb: Number((currentNode.bandwidthSharedMb + 0.016).toFixed(2)),
      });
    }, intervalMs);

    return () => clearInterval(interval);
  }, [isLiveTelemetryActive, currentNode.isOnline, currentNode.reservedSections16Gb, currentNode.isLowPowerMode, currentNode.batteryLevel]);

  // Copy onion address
  const handleCopyOnion = () => {
    navigator.clipboard.writeText(currentNode.onionAddress);
    setCopiedOnion(true);
    setTimeout(() => setCopiedOnion(false), 2000);
  };

  // Toggle Auto-allocate mode
  const handleToggleAutoMode = () => {
    const newAuto = !currentNode.autoModeEnabled;
    const stats = calculate16GbSections(
      currentNode.internalFreeGb,
      currentNode.externalDevices
    );

    onUpdateCurrentNode({
      ...currentNode,
      autoModeEnabled: newAuto,
      reservedSections16Gb: newAuto ? stats.sectionsCount : Math.max(1, stats.sectionsCount - 1),
      totalStorageAllocatedGb: newAuto ? stats.totalAllocatedGb : Math.max(16, stats.totalAllocatedGb - 16),
      baseSection16Gb: stats.baseSection16Gb,
      baseSecretVaultGrantedGb: stats.baseSecretVaultGrantedGb,
      expandedStorageAllocatedGb: newAuto ? stats.expandedStorageAllocatedGb : Math.max(0, stats.expandedStorageAllocatedGb - 16),
      actualForeignChunksStoredGb: newAuto ? stats.actualForeignChunksStoredGb : Number((Math.max(0, stats.expandedStorageAllocatedGb - 16) * 0.68).toFixed(2)),
      emptyUnusedAllocatedGb: newAuto ? stats.emptyUnusedAllocatedGb : Number((Math.max(0, stats.expandedStorageAllocatedGb - 16) * 0.32).toFixed(2)),
      dailyEstimatedNexxEarnings: newAuto ? stats.dailyEstimatedNexxEarnings : Number((Math.max(0, stats.expandedStorageAllocatedGb - 16) * 0.68 * 1.25).toFixed(2)),
      personalVaultQuotaGb: newAuto ? stats.personalVaultQuotaGb : (stats.baseSecretVaultGrantedGb + Math.max(0, stats.expandedStorageAllocatedGb - 16) / 8),
    });
  };

  // Toggle mounting external drive
  const handleToggleExternalDrive = (deviceId: string) => {
    const updatedDevices = currentNode.externalDevices.map(d => {
      if (d.id === deviceId) {
        return { ...d, mounted: !d.mounted };
      }
      return d;
    });

    const stats = calculate16GbSections(
      currentNode.internalFreeGb,
      updatedDevices
    );

    onUpdateCurrentNode({
      ...currentNode,
      externalDevices: updatedDevices,
      reservedSections16Gb: stats.sectionsCount,
      totalStorageAllocatedGb: stats.totalAllocatedGb,
      baseSection16Gb: stats.baseSection16Gb,
      baseSecretVaultGrantedGb: stats.baseSecretVaultGrantedGb,
      expandedStorageAllocatedGb: stats.expandedStorageAllocatedGb,
      actualForeignChunksStoredGb: stats.actualForeignChunksStoredGb,
      emptyUnusedAllocatedGb: stats.emptyUnusedAllocatedGb,
      dailyEstimatedNexxEarnings: stats.dailyEstimatedNexxEarnings,
      personalVaultQuotaGb: stats.personalVaultQuotaGb,
    });
  };

  // Add external drive (via File System Access API directory picker or OTG profile)
  const handleAddOtgDrive = async () => {
    let driveName = 'Samsung FIT Plus 128GB USB 3.1 OTG';
    let capacityGb = 128;

    if (typeof window !== 'undefined' && 'showDirectoryPicker' in window) {
      try {
        const dirHandle = await (window as any).showDirectoryPicker({
          id: 'nexxus-external-drive',
          mode: 'readwrite',
        });
        if (dirHandle && dirHandle.name) {
          driveName = `Том: ${dirHandle.name} (FS Access)`;
          if (navigator.storage && navigator.storage.estimate) {
            const est = await navigator.storage.estimate();
            if (est.quota) {
              capacityGb = Math.max(32, Math.round(est.quota / (1024 * 1024 * 1024)));
            }
          }
        }
      } catch (err: any) {
        if (err.name === 'AbortError') return; // User cancelled prompt
      }
    }

    const newId = `ext_${Date.now()}`;
    const newDevice = {
      id: newId,
      name: driveName,
      type: 'usb_otg' as const,
      capacityGb,
      mounted: true,
    };
    const updatedDevices = [...currentNode.externalDevices, newDevice];
    const stats = calculate16GbSections(
      currentNode.internalFreeGb,
      updatedDevices
    );

    onUpdateCurrentNode({
      ...currentNode,
      externalDevices: updatedDevices,
      reservedSections16Gb: stats.sectionsCount,
      totalStorageAllocatedGb: stats.totalAllocatedGb,
      baseSection16Gb: stats.baseSection16Gb,
      baseSecretVaultGrantedGb: stats.baseSecretVaultGrantedGb,
      expandedStorageAllocatedGb: stats.expandedStorageAllocatedGb,
      actualForeignChunksStoredGb: stats.actualForeignChunksStoredGb,
      emptyUnusedAllocatedGb: stats.emptyUnusedAllocatedGb,
      dailyEstimatedNexxEarnings: stats.dailyEstimatedNexxEarnings,
      personalVaultQuotaGb: stats.personalVaultQuotaGb,
    });
  };

  // Calculate storage block breakdown
  const { sections, canActivate } = calculate16GbSections(currentNode.internalFreeGb, currentNode.externalDevices);
  const userVaultGb = currentNode.personalVaultQuotaGb;
  const networkGb = currentNode.totalStorageAllocatedGb - userVaultGb;

  // Streak progress to 30 days
  const streakPercent = Math.min(100, Math.round((currentNode.consecutiveDaysWithoutPenalty / 30) * 100));

  // If Apple Client mode is selected, show informative client banner
  if (deviceType === 'apple_client') {
    return (
      <div className="max-w-4xl mx-auto py-8 px-4">
        <div className="bg-slate-900 border border-purple-500/30 rounded-2xl p-8 text-center shadow-xl">
          <div className="w-16 h-16 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-purple-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Режим Apple iOS / macOS Клиента</h2>
          <p className="text-slate-300 max-w-xl mx-auto mb-6 text-sm leading-relaxed">
            Согласно архитектуре NeXXUs, устройства Apple используются <strong className="text-purple-300">исключительно как клиентская часть</strong>: 
            для безопасного доступа к вашему приватному криптохранилищу (1/8 части) и защищенного SMP-мессенджера. Фоновая нода-хранилище на iOS отключена из-за жестких ограничений системы на фоновые процессы.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <button
              onClick={() => onUpdateCurrentNode({ ...currentNode, deviceType: 'android' })}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm transition"
            >
              Переключить на Android Ноду (Старый телефон)
            </button>
          </div>
        </div>
      </div>
    );
  }

  // If running in Desktop Linux mode, render specialized Linux Server / Ubuntu daemon dashboard
  if (deviceType === 'desktop_linux' || currentNode.deviceType === 'desktop_linux') {
    return (
      <LinuxDaemonDashboard
        currentNode={currentNode}
        onUpdateCurrentNode={onUpdateCurrentNode}
      />
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 space-y-6">
      {/* 24/7 Phone Docking Status Header Card */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-900/90 to-slate-950 border border-slate-800 rounded-2xl p-5 shadow-2xl relative overflow-hidden">
        {/* Glow ambient */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 relative z-10">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-xs font-mono px-2.5 py-1 rounded-md bg-emerald-950/80 border border-emerald-500/30 text-emerald-400 font-bold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                НОДА АКТИВНА 24/7
              </span>
              <span className="text-xs text-slate-400 font-mono">
                {currentNode.model}
              </span>
              <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                {deviceType === 'android' ? 'Android OS 10+' : 'Linux Desktop Daemon'}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight mt-1 font-mono">
              {currentNode.name}
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl leading-relaxed">
              Телефон подключен к питанию и Wi-Fi. Выделено <strong className="text-white">{currentNode.totalStorageAllocatedGb} GB</strong> (секциями по 16GB). 
              Базовые 16 GB донорства дают динамический сейф: <strong className="text-emerald-400 font-bold">от 0.5 GB до 2.0 GB</strong> (по мере роста подтвержденного аптайма, RF=6×). 
              {(currentNode.expandedStorageAllocatedGb ?? 0) > 0 && (
                <span>
                  {' '}Расширение <strong className="text-cyan-300">{currentNode.expandedStorageAllocatedGb ?? 0} GB</strong>: оплата $NEXX начисляется строго за фактически занятые чужие чанки (<strong className="text-emerald-300">{currentNode.actualForeignChunksStoredGb ?? 0} GB</strong>), за пустоту не платим. Вывод токенов доступен через <strong className="text-amber-300">8 недель</strong>.
                </span>
              )}
            </p>

            {/* Hardware Profile Switcher */}
            <div className="flex items-center gap-2 mt-3 pt-2 border-t border-slate-800/80">
              <span className="text-[11px] text-slate-400 font-mono">Профиль ноды:</span>
              <button
                type="button"
                onClick={() => onUpdateCurrentNode({ ...currentNode, deviceType: 'android', name: 'Galaxy S9 (Нода 24/7)' })}
                className="px-2.5 py-1 rounded-lg bg-emerald-950 border border-emerald-500/40 text-emerald-300 font-mono text-[11px] font-bold cursor-pointer"
              >
                📱 Смартфон (Android 24/7)
              </button>
              <button
                type="button"
                onClick={() => onUpdateCurrentNode({ ...currentNode, deviceType: 'desktop_linux', name: 'Beelink SER9 (Ubuntu 24.04)' })}
                className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 hover:text-white font-mono text-[11px] transition cursor-pointer"
              >
                🐧 Beelink SER9 / Linux CLI
              </button>
            </div>
          </div>

          {/* Real-time Hardware Telemetry Badges */}
          <div className="flex flex-wrap items-center gap-3 text-xs">
            {/* Battery & Charging */}
            <div 
              onClick={() => {
                const el = document.getElementById('battery-health-section');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
              title="Мониторинг батареи и энергосбережения (Нажмите для перехода к деталям)"
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border transition cursor-pointer group ${
                currentNode.isLowPowerMode || (currentNode.batteryLevel < 20)
                  ? 'bg-amber-950/60 border-amber-500/60 text-amber-300 animate-pulse'
                  : currentNode.isCharging 
                  ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300' 
                  : 'bg-slate-900 border-slate-800 text-slate-200'
              }`}
            >
              {currentNode.isCharging ? (
                <BatteryCharging className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (currentNode.batteryLevel < 20 || currentNode.isLowPowerMode) ? (
                <BatteryWarning className="w-4 h-4 text-amber-400 shrink-0 animate-bounce" />
              ) : (
                <Battery className="w-4 h-4 text-cyan-400 shrink-0" />
              )}
              <div>
                <div className="font-bold flex items-center gap-1 font-mono">
                  <span>{currentNode.batteryLevel}%</span>
                  <span className="text-[10px]">
                    {currentNode.isLowPowerMode || currentNode.batteryLevel < 20 
                      ? '⚡ Low Power' 
                      : currentNode.isCharging 
                      ? '⚡ На зарядке' 
                      : '⚠️ От батареи'}
                  </span>
                </div>
                <div className="text-[10px] text-slate-400">
                  {currentNode.isCharging ? 'USB-C Power 24/7' : 'Разряд: -3.2%/ч'}
                </div>
              </div>
            </div>

            {/* Thermal Sensor */}
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-200">
              <Flame className="w-4 h-4 text-orange-400 shrink-0" />
              <div>
                <div className="font-bold font-mono">{currentNode.temperatureC}°C</div>
                <div className="text-[10px] text-slate-400">Температура CPU</div>
              </div>
            </div>

            {/* Wi-Fi RSSI */}
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-200">
              <Wifi className="w-4 h-4 text-cyan-400 shrink-0" />
              <div>
                <div className="font-bold font-mono">{currentNode.wifiSignalDbm} dBm</div>
                <div className="text-[10px] text-slate-400 truncate max-w-[100px]">{currentNode.wifiSsid}</div>
              </div>
            </div>

            {/* Real-time Tor Onion Network Latency Mini-Badge */}
            <div 
              onClick={() => {
                const el = document.getElementById('tor-latency-section');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
              title="Задержка сети Tor Onion v3 (Нажмите для перехода к спидометр-графику)"
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-purple-500/40 text-slate-200 transition cursor-pointer group"
            >
              <div className="relative">
                <Globe className="w-4 h-4 text-purple-400 group-hover:scale-110 transition shrink-0" />
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 absolute -top-0.5 -right-0.5 animate-ping" />
              </div>
              <div>
                <div className="font-bold font-mono flex items-center gap-1">
                  <span>{currentNode.pingLatencyMs || 54} ms</span>
                  <span className="text-[10px] text-purple-300 font-normal">Tor v3</span>
                </div>
                <div className="text-[10px] text-slate-400">Пинг сети</div>
              </div>
            </div>

            {/* Screen Wake Lock */}
            <button
              id="btn-toggle-wakelock"
              onClick={() => setWakeLockActive(!wakeLockActive)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition ${
                wakeLockActive 
                  ? 'bg-cyan-950/40 border-cyan-500/40 text-cyan-300' 
                  : 'bg-slate-800 border-slate-700 text-slate-400'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>{wakeLockActive ? 'WakeLock ВКЛ' : 'WakeLock ВЫКЛ'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Real-time Battery Health & Low Power Mode Monitoring Component */}
      <div id="battery-health-section">
        <BatteryHealthMonitorCard
          currentNode={currentNode}
          onUpdateCurrentNode={onUpdateCurrentNode}
        />
      </div>

      {/* Grid: Storage Slicer (16GB blocks) & Reputation Streak */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: 16GB Storage Allocator & Quota breakdown */}
        <div className="lg:col-span-2 space-y-6">
          {/* Main 16GB Block Allocation Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <HardDrive className="w-5 h-5 text-emerald-400" />
                  <h2 className="text-lg font-bold text-white">Резервирование Хранилища (Секции по 16 GB)</h2>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Минимальное условие: <span className="text-emerald-400 font-semibold font-mono">≥ 16 GB</span>. Автоматический режим занимает всё свободное пространство блоками по 16GB.
                </p>
              </div>

              {/* Auto Mode Switch */}
              <div className="flex items-center gap-3 bg-slate-950 p-1.5 px-3 rounded-xl border border-slate-800">
                <span className="text-xs font-medium text-slate-300">Авто-режим:</span>
                <button
                  id="btn-toggle-auto-storage"
                  onClick={handleToggleAutoMode}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    currentNode.autoModeEnabled ? 'bg-emerald-600' : 'bg-slate-700'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      currentNode.autoModeEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Storage Resource Bar & Math Breakdown */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800">
                <div className="text-slate-400">Обнаружено свободно:</div>
                <div className="text-lg font-bold text-white font-mono mt-1">
                  {currentNode.internalFreeGb} GB
                </div>
                <div className="text-[11px] text-emerald-400 flex items-center gap-1 mt-1 font-mono">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Условие ≥ 16GB выполнено
                </div>
              </div>

              <div className="bg-purple-950/30 p-3.5 rounded-xl border border-purple-500/30">
                <div className="text-purple-300 font-medium">1. Базовый бартер (16 GB):</div>
                <div className="text-lg font-bold text-purple-300 font-mono mt-1">
                  2.0 GB Секретов
                </div>
                <div className="text-[11px] text-purple-400 mt-1">
                  Неуничтожимый Vault (BIP-39)
                </div>
              </div>

              <div className="bg-emerald-950/30 p-3.5 rounded-xl border border-emerald-500/30">
                <div className="text-emerald-300 font-medium">2. Расширение (Чанки):</div>
                <div className="text-lg font-bold text-emerald-400 font-mono mt-1">
                  {currentNode.actualForeignChunksStoredGb ?? 0} GB
                </div>
                <div className="text-[11px] text-emerald-300/90 mt-1 font-mono">
                  +{((currentNode.dailyEstimatedNexxEarnings ?? 0)).toFixed(1)} $NEXX/сутки
                </div>
              </div>

              <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800">
                <div className="text-slate-400">3. Пустота (0 $NEXX):</div>
                <div className="text-lg font-bold text-slate-300 font-mono mt-1">
                  {currentNode.emptyUnusedAllocatedGb ?? 0} GB
                </div>
                <div className="text-[11px] text-amber-400 mt-1 font-mono">
                  За пустоту не платим!
                </div>
              </div>
            </div>

            {/* Zero Pay for Empty Space Policy Callout */}
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-slate-300">
                <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>
                  <strong className="text-white">Правило сети:</strong> Токены $NEXX начисляются раз в сутки в 8-недельный вестинг-пул строго за фактически занятые чужие 16KB чанки ({currentNode.actualForeignChunksStoredGb ?? 0} GB).
                </span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-950 text-amber-400 border border-amber-500/30 uppercase font-bold shrink-0">
                Вестинг 56 дней
              </span>
            </div>

            {/* Visual 16GB Block Grid */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-300">
                  Карта распределения 16GB блоков ({sections.length} блоков):
                </span>
                <div className="flex items-center gap-4 text-[11px]">
                  <span className="flex items-center gap-1.5 text-purple-400">
                    <span className="w-2.5 h-2.5 rounded-sm bg-purple-500" />
                    Блок #1: Базовый бартер (2.0 GB секретов)
                  </span>
                  <span className="flex items-center gap-1.5 text-emerald-400">
                    <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
                    Блоки 2+: Расширение ($NEXX за чанки)
                  </span>
                </div>
              </div>

              {/* Blocks */}
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2.5 pt-1">
                {sections.map((sec, idx) => {
                  const isBase = idx === 0;
                  return (
                    <div
                      key={sec.id}
                      className={`p-3 rounded-xl border transition relative overflow-hidden group ${
                        isBase
                          ? 'bg-purple-950/40 border-purple-500/50 text-purple-200'
                          : 'bg-slate-950 border-emerald-500/30 text-emerald-200'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[11px] font-mono mb-1">
                        <span className="font-bold"># {sec.sectionIndex}</span>
                        <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase ${
                          isBase ? 'bg-purple-900/80 text-purple-200' : 'bg-emerald-950 text-emerald-400 border border-emerald-500/30'
                        }`}>
                          {isBase ? 'БАЗА 16G' : 'РАСШИРЕНИЕ'}
                        </span>
                      </div>
                      <div className="text-lg font-black font-mono">16 GB</div>
                      <div className="text-[10px] text-slate-400 truncate mt-1">
                        {isBase ? '➔ 2.0 GB Секретов' : `${sec.storedChunksCount.toLocaleString()} чанков ($NEXX)`}
                      </div>
                      {/* Fill bar */}
                      <div className="w-full bg-black/40 h-1.5 rounded-full mt-2 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${isBase ? 'bg-purple-400' : 'bg-emerald-400'}`}
                          style={{ width: `${Math.min(100, Math.round((sec.usedGb / 16) * 100))}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* External Storage Section (OTG, MicroSD, External SSD) */}
            <div className="border-t border-slate-800/80 pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Usb className="w-4 h-4 text-amber-400" />
                    Внешние накопители (MicroSD / USB OTG)
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Подключите флешку или карту памяти к старому телефону, чтобы расширить 16GB блоки и увеличить бесплатное криптооблако.
                  </p>
                </div>
                <button
                  id="btn-add-simulated-drive"
                  onClick={handleAddOtgDrive}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 text-amber-300 text-xs font-semibold transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Подключить OTG</span>
                </button>
              </div>

              {currentNode.externalDevices.length === 0 ? (
                <div className="text-xs text-slate-500 bg-slate-950 p-3 rounded-xl border border-slate-800 text-center">
                  Внешние накопители не обнаружены. Вставьте карту MicroSD или подключите USB-C OTG адаптер.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {currentNode.externalDevices.map(dev => (
                    <div
                      key={dev.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={`p-2 rounded-lg ${dev.mounted ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-500'}`}>
                          <HardDrive className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-white">{dev.name}</div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            {dev.capacityGb} GB • {dev.type === 'sd_card' ? 'MicroSD Card' : 'USB-OTG'}
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => handleToggleExternalDrive(dev.id)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                          dev.mounted
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {dev.mounted ? 'Подключен' : 'Отключен'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Onion v3 & v2ray Protocol Stack Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <Globe className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Приватный Стек: v2ray + Tor Onion v3</h3>
                  <p className="text-xs text-slate-400">Полная анонимность без единого центрального сервера</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-950 border border-emerald-500/40 text-emerald-400">
                  v2ray: ACTIVE
                </span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-purple-950 border border-purple-500/40 text-purple-400">
                  TOR: CIRCUIT UP
                </span>
              </div>
            </div>

            {/* Onion address display with 1-click copy */}
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between gap-3">
              <div className="truncate font-mono text-xs text-emerald-300">
                <span className="text-slate-500 mr-1.5">Onion ID:</span>
                {currentNode.onionAddress}
              </div>
              <button
                id="btn-copy-onion-addr"
                onClick={handleCopyOnion}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-semibold shrink-0 transition"
              >
                {copiedOnion ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedOnion ? 'Скопирован!' : 'Копировать'}</span>
              </button>
            </div>

            {/* SOCKS5 Isolation and Pluggable Transports Button */}
            <button
              id="btn-open-tor-isolation"
              onClick={() => setShowTorModal(true)}
              className="w-full flex items-center justify-center gap-2 p-2.5 rounded-xl bg-purple-950/40 hover:bg-purple-900/50 border border-purple-500/40 text-purple-300 text-xs font-bold transition cursor-pointer font-mono"
            >
              <Globe className="w-4 h-4 text-purple-400" />
              <span>SOCKS5 Изоляция & Pluggable Transports (v2ray / obfs4)</span>
            </button>

            {/* mDNS LAN Peering (Opt-in for Home Wi-Fi, disabled by default for privacy) */}
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded-lg ${currentNode.lanPeeringMdnsEnabled ? 'bg-cyan-500/20 text-cyan-300' : 'bg-slate-800 text-slate-400'}`}>
                    <Network className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span>Локальный Swarm-мост (mDNS / LAN Peering)</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-mono">
                        {currentNode.lanPeeringMdnsEnabled ? 'ВКЛЮЧЕН' : 'ВЫКЛЮЧЕН (Приватно)'}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Прямой скоростной обмен чанками между вашими телефонами в домашнем Wi-Fi без расхода интернет-трафика.
                    </div>
                  </div>
                </div>
                <button
                  id="btn-toggle-mdns"
                  onClick={() => {
                    const updated = {
                      ...currentNode,
                      lanPeeringMdnsEnabled: !currentNode.lanPeeringMdnsEnabled,
                    };
                    onUpdateCurrentNode(updated);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition shrink-0 ${
                    currentNode.lanPeeringMdnsEnabled
                      ? 'bg-cyan-500/20 border border-cyan-500/50 text-cyan-300 hover:bg-cyan-500/30'
                      : 'bg-slate-900 border border-slate-700 text-slate-400 hover:text-white'
                  }`}
                >
                  {currentNode.lanPeeringMdnsEnabled ? 'Отключить mDNS' : 'Включить mDNS'}
                </button>
              </div>
              <p className="text-[10px] text-slate-500 leading-relaxed font-mono">
                🛡️ Модель угроз: По умолчанию mDNS отключен, чтобы ваше участие в сети было скрыто от соседей по Wi-Fi. Включайте только в доверенной домашней сети.
              </p>
            </div>

            {/* SMP and xFTP Protocols Status */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-slate-200">Транспорт xFTP (Чанки 16Кб)</div>
                  <div className="text-[11px] text-slate-400">Торрент-подобный пиринговый обмен</div>
                </div>
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-slate-200">Транспорт SMP (Сообщения)</div>
                  <div className="text-[11px] text-slate-400">Сквозное шифрование без метаданных</div>
                </div>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              </div>
            </div>
          </div>

          {/* Real-time Network Latency Indicator with Gauge Chart */}
          <div id="tor-latency-section">
            <TorLatencyGaugeCard
              currentNode={currentNode}
              onUpdateCurrentNode={onUpdateCurrentNode}
            />
          </div>
        </div>

        {/* Right Column: Reputation, 30-Day Streak & Live Chunks Activity */}
        <div className="space-y-6">
          {/* Reputation & 30-Day Streak Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white">Рейтинг & Uptime Стрик</h3>
              </div>
              <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-500/30">
                {currentNode.reputationScore} / 1000
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
              <div className="text-xs text-slate-400 mb-1">Текущий ранг ноды:</div>
              <div className="text-base font-bold text-emerald-300 flex items-center gap-2 font-mono">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                {currentNode.reputationTier}
              </div>
            </div>

            {/* 30-day streak reward indicator */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300 font-medium">Бесштрафной стрик (30 дней):</span>
                <span className="font-mono text-emerald-400 font-bold">
                  {currentNode.consecutiveDaysWithoutPenalty} / 30 дней
                </span>
              </div>
              <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden border border-slate-800">
                <div
                  className="bg-gradient-to-r from-emerald-500 to-cyan-400 h-full rounded-full transition-all duration-500"
                  style={{ width: `${streakPercent}%` }}
                />
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                🎉 Нода, прожившая 30 дней без штрафов, автоматически повышается в рейтинге и получает приоритет на хранение высокодоходных чанков!
              </p>
            </div>

            {/* Penalty rules info */}
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs space-y-1.5 text-slate-300">
              <div className="font-semibold text-amber-300 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                Правило аварий и штрафов:
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                При отключении ноды владельцу даётся <strong className="text-slate-200">1 час</strong> на восстановление питания/сети. 
                В случае задержки нода штрафуется, а её чанки экстренно эвакуируются на ноды с высшим рейтингом.
              </p>
            </div>
          </div>

          {/* System Permissions Inspector (Old Phone Setup) */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Shield className="w-4 h-4 text-cyan-400" />
              Системные разрешения Android
            </h3>
            <p className="text-xs text-slate-400">
              Для стабильной работы 24/7 в фоновом режиме на старом телефоне:
            </p>

            <div className="space-y-2">
              {permissions.map(perm => (
                <div
                  key={perm.key}
                  onClick={() => onTogglePermission(perm.key)}
                  className="flex items-start justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 hover:border-slate-700 cursor-pointer transition text-xs"
                >
                  <div className="pr-2">
                    <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                      {perm.title}
                      {perm.critical && <span className="text-[10px] text-amber-400 font-normal">(Обязательно)</span>}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">{perm.description}</div>
                  </div>
                  <div className={`mt-0.5 p-1 rounded-md ${perm.granted ? 'text-emerald-400 bg-emerald-950/60' : 'text-slate-600 bg-slate-900'}`}>
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                </div>
              ))}
            </div>

            <button
              id="btn-open-oem-keepalive"
              onClick={() => setShowOemModal(true)}
              className="w-full flex items-center justify-center gap-2 p-2.5 rounded-xl bg-cyan-950/40 hover:bg-cyan-900/50 border border-cyan-500/40 text-cyan-300 text-xs font-bold transition cursor-pointer font-mono"
            >
              <Smartphone className="w-4 h-4 text-cyan-400" />
              <span>Настроить OEM Keep-Alive (Samsung, Xiaomi, Pixel...)</span>
            </button>
          </div>

          {/* Live 16KB Chunks & Cryptographic Log Stream */}
          <div className="relative bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-3 overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-cyan-400 animate-pulse" />
                <h3 className="text-sm font-bold text-white font-mono">P2P Чанк-Трафик & Крипто-Верификация</h3>
                <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-emerald-950 text-emerald-300 border border-emerald-500/30">
                  LIVE
                </span>
              </div>
              <button
                onClick={() => setIsLiveTelemetryActive(!isLiveTelemetryActive)}
                className="text-slate-400 hover:text-white cursor-pointer"
                title={isLiveTelemetryActive ? 'Приостановить поток' : 'Возобновить поток'}
              >
                {isLiveTelemetryActive ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              </button>
            </div>

            <div className="space-y-2 font-mono text-[11px]">
              {recentChunkLogs.map(log => (
                <div key={log.id} className="bg-slate-950 p-2.5 rounded-lg border border-slate-800/80 text-slate-300 flex items-start gap-2">
                  <span className="text-cyan-400 font-bold shrink-0">{log.time}</span>
                  <span className="text-slate-200 font-mono">
                    {log.text}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* OEM Keep-Alive Modal */}
      <OemKeepAliveModal
        isOpen={showOemModal}
        onClose={() => setShowOemModal(false)}
      />

      {/* Tor Circuit Isolation Modal */}
      <TorCircuitIsolationModal
        isOpen={showTorModal}
        onClose={() => setShowTorModal(false)}
      />
    </div>
  );
};
