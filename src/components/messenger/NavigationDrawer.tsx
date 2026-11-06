import React from 'react';
import { 
  ArrowLeft, Star, Cpu, Server, ShoppingBag, 
  Activity, Globe, QrCode, Settings, BookOpen, 
  LogOut, Lock, Terminal 
} from 'lucide-react';
import { Bip39Identity } from '../../types/nexxus';

export interface NavigationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  identity: Bip39Identity;
  onSelectFavorites: () => void;
  onOpenDrawerTab: (
    tab: 'sections' | 'fleet' | 'appstore' | 'dex' | 'security' | 'manual' | 'splash' | 'health' | 'node'
  ) => void;
  onOpenNetworkModal: () => void;
  onOpenContactModal: () => void;
  onQuickLock: () => void;
  onSwitchAccount?: () => void;
}

/**
 * NavigationDrawer renders the sliding side-panel menu providing quick access
 * to decentralized applets, network settings, security profiles, and fleet consoles.
 *
 * @param {NavigationDrawerProps} props - Component properties and event handlers.
 * @returns {React.ReactElement | null} The drawer element, or null when closed.
 */
export const NavigationDrawer: React.FC<NavigationDrawerProps> = ({
  isOpen,
  onClose,
  identity,
  onSelectFavorites,
  onOpenDrawerTab,
  onOpenNetworkModal,
  onOpenContactModal,
  onQuickLock,
  onSwitchAccount,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Drawer content */}
      <div className="relative w-[85vw] max-w-xs sm:w-80 bg-slate-900 border-r border-slate-800 flex flex-col justify-between p-4 sm:p-5 z-10 shadow-2xl animate-in slide-in-from-left duration-200 overflow-y-auto max-h-[100dvh]">
        <div className="space-y-6">
          {/* Drawer Header & Profile */}
          <div className="space-y-3 pb-4 border-b border-slate-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-cyan-500 flex items-center justify-center font-bold text-slate-950 font-mono shadow-md">
                  NX
                </div>
                <div>
                  <h2 className="text-sm font-bold font-mono text-white">NeXXus Protocol</h2>
                  <div className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Onion v3 • Active
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            </div>

            {/* Identity address snippet */}
            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono space-y-1">
              <div className="text-slate-400 flex items-center justify-between">
                <span>Адрес аккаунта:</span>
                <span className="text-emerald-400 font-bold">{identity.balances.nexx.toFixed(1)} NEXX</span>
              </div>
              <div className="text-slate-300 truncate">
                {identity.accountAddress || 'nx1q_sovereign_identity...'}
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1 text-xs font-mono">
            <button
              type="button"
              onClick={() => {
                onSelectFavorites();
                onClose();
              }}
              className="w-full p-2.5 rounded-xl hover:bg-slate-800 text-slate-200 hover:text-white transition flex items-center gap-3 text-left cursor-pointer"
            >
              <Star className="w-4 h-4 text-amber-400" />
              <span>⭐️ Избранное (Хранилище)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenDrawerTab('sections');
              }}
              className="w-full p-2.5 rounded-xl hover:bg-slate-800 text-slate-200 hover:text-white transition flex items-center gap-3 text-left cursor-pointer"
            >
              <Cpu className="w-4 h-4 text-emerald-400" />
              <span>Дашборд Секций и Майнинга</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenDrawerTab('fleet');
              }}
              className="w-full p-2.5 rounded-xl hover:bg-slate-800 text-slate-200 hover:text-white transition flex items-center gap-3 text-left cursor-pointer"
            >
              <Server className="w-4 h-4 text-cyan-400" />
              <span>Флот Устройств & Криптофон</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenDrawerTab('node');
              }}
              className="w-full p-2.5 rounded-xl hover:bg-slate-800 text-slate-200 hover:text-white transition flex items-center justify-between text-left cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <Terminal className="w-4 h-4 text-emerald-400" />
                <span>Демон Ноды (Beelink / Linux)</span>
              </div>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 font-mono">
                CLI v2.0
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenDrawerTab('health');
              }}
              className="w-full p-2.5 rounded-xl hover:bg-slate-800 text-slate-200 hover:text-white transition flex items-center gap-3 text-left cursor-pointer"
            >
              <Activity className="w-4 h-4 text-emerald-400" />
              <span>Health Dashboard (D3.js Графики)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenDrawerTab('appstore');
              }}
              className="w-full p-2.5 rounded-xl hover:bg-slate-800 text-slate-200 hover:text-white transition flex items-center gap-3 text-left cursor-pointer"
            >
              <ShoppingBag className="w-4 h-4 text-purple-400" />
              <span>dApp Store (Магазин приложений)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenDrawerTab('dex');
              }}
              className="w-full p-2.5 rounded-xl hover:bg-slate-800 text-slate-200 hover:text-white transition flex items-center gap-3 text-left cursor-pointer"
            >
              <Activity className="w-4 h-4 text-yellow-400" />
              <span>DEX Биржа (Обмен NEXX/TON)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenNetworkModal();
              }}
              className="w-full p-2.5 rounded-xl hover:bg-slate-800 text-slate-200 hover:text-white transition flex items-center gap-3 text-left cursor-pointer"
            >
              <Globe className="w-4 h-4 text-cyan-400" />
              <span>Сетевые настройки (VPN / Tor)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenContactModal();
              }}
              className="w-full p-2.5 rounded-xl hover:bg-slate-800 text-slate-200 hover:text-white transition flex items-center gap-3 text-left cursor-pointer"
            >
              <QrCode className="w-4 h-4 text-emerald-400" />
              <span>Контакты & QR-Визитка</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenDrawerTab('splash');
              }}
              className="w-full p-2.5 rounded-xl hover:bg-slate-800 text-slate-200 hover:text-white transition flex items-center gap-3 text-left cursor-pointer"
            >
              <Activity className="w-4 h-4 text-cyan-400" />
              <span>Инициализация и Бридж Сети</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenDrawerTab('security');
              }}
              className="w-full p-2.5 rounded-xl hover:bg-slate-800 text-slate-200 hover:text-white transition flex items-center gap-3 text-left cursor-pointer"
            >
              <Settings className="w-4 h-4 text-blue-400" />
              <span>Безопасность и PIN-коды</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenDrawerTab('manual');
              }}
              className="w-full p-2.5 rounded-xl hover:bg-slate-800 text-slate-200 hover:text-white transition flex items-center gap-3 text-left cursor-pointer"
            >
              <BookOpen className="w-4 h-4 text-slate-400" />
              <span>Инструкция и GitHub репо</span>
            </button>
          </nav>
        </div>

        {/* Bottom Quick Lock & Switch Account Buttons */}
        <div className="pt-4 border-t border-slate-800 space-y-2">
          <button
            type="button"
            onClick={() => {
              onClose();
              onQuickLock();
            }}
            className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-red-500/50 text-slate-300 hover:text-red-300 transition flex items-center justify-center gap-2 text-xs font-mono cursor-pointer"
          >
            <Lock className="w-3.5 h-3.5 text-red-400" />
            <span>Заблокировать PIN-кодом</span>
          </button>

          {onSwitchAccount && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onSwitchAccount();
              }}
              className="w-full p-2.5 rounded-xl bg-red-950/20 border border-red-500/30 hover:bg-red-950/40 text-red-300 transition flex items-center justify-center gap-2 text-xs font-mono cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Сменить / Сбросить аккаунт</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
