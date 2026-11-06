import React from 'react';
import { Shield, Radio, Cpu, Smartphone, Laptop, Apple, AlertTriangle, Key, ArrowRightLeft, MessageSquare, HardDrive, Network, BookOpen } from 'lucide-react';
import { DeviceType, NodeRecord, Bip39Identity } from '../types/nexxus';

interface HeaderProps {
  activeTab: 'node' | 'vault' | 'fleet' | 'messenger' | 'dex' | 'manual';
  setActiveTab: (tab: 'node' | 'vault' | 'fleet' | 'messenger' | 'dex' | 'manual') => void;
  nodes: NodeRecord[];
  identity: Bip39Identity;
  selectedDeviceType: DeviceType;
  setSelectedDeviceType: (type: DeviceType) => void;
  onOpenKeyModal: () => void;
  offlineGraceNode: NodeRecord | null;
  graceRemainingSeconds: number | null;
  onRestoreNode: (nodeId: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  nodes,
  identity,
  selectedDeviceType,
  setSelectedDeviceType,
  onOpenKeyModal,
  offlineGraceNode,
  graceRemainingSeconds,
  onRestoreNode,
}) => {
  const onlineCount = nodes.filter(n => n.isOnline).length;
  const totalAllocated = nodes.reduce((sum, n) => sum + (n.isOnline ? n.totalStorageAllocatedGb : 0), 0);
  const totalVaultQuota = nodes.reduce((sum, n) => sum + (n.isOnline ? n.personalVaultQuotaGb : 0), 0) + identity.subscribedStorageGb;

  const formatGraceCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40">
      {/* Emergency Grace Period Alert Banner if any node is offline */}
      {offlineGraceNode && graceRemainingSeconds !== null && (
        <div id="emergency-grace-banner" className="bg-gradient-to-r from-amber-600/90 via-red-600/90 to-amber-600/90 text-white px-4 py-2.5 shadow-lg border-b border-amber-400/40 animate-pulse">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-sm font-medium">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-200 shrink-0" />
              <span>
                <strong className="font-bold">АВАРИЯ НОДЫ:</strong> Нода <span className="underline decoration-amber-300 font-semibold">{offlineGraceNode.name}</span> отключилась от сети!
              </span>
              <span className="bg-black/40 px-2 py-0.5 rounded text-amber-200 font-mono text-xs">
                Льготный период: {formatGraceCountdown(graceRemainingSeconds)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-amber-100 hidden sm:inline">
                Верните в сеть в течении 1 часа, иначе репутация будет снижена, а чанки перенаправлены.
              </span>
              <button
                id="btn-restore-offline-node"
                onClick={() => onRestoreNode(offlineGraceNode.id)}
                className="bg-white text-red-950 hover:bg-amber-100 px-3 py-1 rounded-md text-xs font-bold transition shadow-sm cursor-pointer"
              >
                Восстановить питание/Wi-Fi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Header Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-4">
        {/* Logo & Protocol Title */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 via-teal-600 to-cyan-700 flex items-center justify-center shadow-lg shadow-emerald-950/50 border border-emerald-400/30">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-black tracking-tight text-white font-mono">NeXXUs</span>
              <span className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                v2ray + Tor v3
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              Децентрализованная сеть мобильных нод & 16KB чанк-хранилище
            </p>
          </div>
        </div>

        {/* Global Network Stats */}
        <div className="hidden lg:flex items-center gap-6 text-xs text-slate-300">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/90 border border-slate-800">
            <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
            <div>
              <span className="text-slate-400">Рой нод: </span>
              <span className="font-semibold text-emerald-400">{onlineCount}/{nodes.length} в сети</span>
            </div>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/90 border border-slate-800">
            <HardDrive className="w-4 h-4 text-cyan-400" />
            <div>
              <span className="text-slate-400">Пул сети: </span>
              <span className="font-semibold text-white">{totalAllocated} GB</span>
            </div>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/90 border border-slate-800">
            <Shield className="w-4 h-4 text-purple-400" />
            <div>
              <span className="text-slate-400">Хранилище (16G➔2G): </span>
              <span className="font-semibold text-purple-300">{(totalVaultQuota ?? 0).toFixed(1)} GB</span>
            </div>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/90 border border-slate-800 font-mono">
            <span className="text-emerald-400 font-bold">$NEXX: {(identity.balances?.nexx ?? 0).toFixed(0)}</span>
            <span className="text-slate-400 text-[10px]">(Доступно: {(identity.unlockedNexx ?? identity.balances?.nexx ?? 0).toFixed(0)})</span>
          </div>
        </div>

        {/* Device Emulator Selector & Key Badge */}
        <div className="flex items-center gap-2">
          {/* Device Context Switcher */}
          <div className="flex items-center p-1 rounded-lg bg-slate-900 border border-slate-800 text-xs">
            <button
              title="Режим Android (Нода на старом телефоне)"
              onClick={() => setSelectedDeviceType('android')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md transition font-medium ${
                selectedDeviceType === 'android'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Android Нода</span>
            </button>
            <button
              title="Режим Linux (Ubuntu Daemon узел)"
              onClick={() => setSelectedDeviceType('desktop_linux')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md transition font-medium ${
                selectedDeviceType === 'desktop_linux' || selectedDeviceType === 'desktop_win'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Laptop className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Linux (Ubuntu)</span>
            </button>
            <button
              title="Режим Apple (Только клиент-хранилище, без ноды)"
              onClick={() => setSelectedDeviceType('apple_client')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md transition font-medium ${
                selectedDeviceType === 'apple_client'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Apple className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Apple Клиент</span>
            </button>
          </div>

          {/* BIP-39 Key button */}
          <button
            id="btn-open-bip39-key"
            onClick={onOpenKeyModal}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs text-slate-200 transition font-mono"
          >
            <Key className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">BIP-39 Ключ</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-t border-slate-800/60 bg-slate-950/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center gap-1 overflow-x-auto py-1 text-sm no-scrollbar">
          <button
            id="tab-node-daemon"
            onClick={() => setActiveTab('node')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition shrink-0 ${
              activeTab === 'node'
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            <span>Станция Ноды (Телефон)</span>
            {selectedDeviceType === 'apple_client' && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">Клиент</span>
            )}
          </button>

          <button
            id="tab-vault"
            onClick={() => setActiveTab('vault')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition shrink-0 ${
              activeTab === 'vault'
                ? 'bg-purple-500/15 text-purple-400 border border-purple-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            <HardDrive className="w-4 h-4" />
            <span>Приватное Облако (1/8)</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-900/50 text-purple-300 font-mono">
              16KB Чанки
            </span>
          </button>

          <button
            id="tab-fleet"
            onClick={() => setActiveTab('fleet')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition shrink-0 ${
              activeTab === 'fleet'
                ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            <Network className="w-4 h-4" />
            <span>Флот Нод & Симуляция Аварий</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
              {nodes.length}
            </span>
          </button>

          <button
            id="tab-messenger"
            onClick={() => setActiveTab('messenger')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition shrink-0 ${
              activeTab === 'messenger'
                ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>SMP/xFTP Мессенджер</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-900/50 text-blue-300 font-mono">
              Onion
            </span>
          </button>

          <button
            id="tab-dex"
            onClick={() => setActiveTab('dex')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition shrink-0 ${
              activeTab === 'dex'
                ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            <ArrowRightLeft className="w-4 h-4" />
            <span>Биржа $NEXX & Подписки</span>
          </button>

          <button
            id="tab-manual"
            onClick={() => setActiveTab('manual')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition shrink-0 ${
              activeTab === 'manual'
                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            <BookOpen className="w-4 h-4 text-emerald-400" />
            <span>Руководство & CLI</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-500/30 font-mono">
              v2.0
            </span>
          </button>
        </div>
      </div>
    </header>
  );
};
