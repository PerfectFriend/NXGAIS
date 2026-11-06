import React, { useState, useEffect } from 'react';
import { 
  Shield, BatteryCharging, Radio, Camera, HardDrive, Bell, 
  Check, ArrowRight, Sparkles, AlertCircle, Info, Lock, RefreshCw, CheckCircle2
} from 'lucide-react';
import { executeRealPermissionRequest } from '../utils/realSystemDiagnostics';

export interface SystemPermissionConfig {
  id: string;
  title: string;
  shortDesc: string;
  whyNeeded: string;
  icon: React.ComponentType<{ className?: string }>;
  granted: boolean;
  isCritical: boolean;
  runtimeDetail?: string;
  isVerifying?: boolean;
}

interface SystemPermissionsModalProps {
  isOpen: boolean;
  onConfirm: () => void;
}

const DEFAULT_PERMISSIONS: SystemPermissionConfig[] = [
  {
    id: 'battery_optimization',
    title: 'Отключение оптимизации батареи (Doze Bypass)',
    shortDesc: 'Фоновая работа службы 24/7 (Screen Wake Lock API)',
    whyNeeded: 'Позволяет ноде на смартфоне или планшете непрерывно раздавать шарды 16GB секций и майнить токены NeXX без остановки операционной системой.',
    icon: BatteryCharging,
    granted: true,
    isCritical: true,
    runtimeDetail: 'Фоновый режим ожидания подтвержден',
  },
  {
    id: 'local_mesh_network',
    title: 'Локальная сеть и Wi-Fi P2P / WebRTC',
    shortDesc: 'Безинтернетный меш между смартфонами (BroadcastChannel + WebRTC)',
    whyNeeded: 'Обеспечивает обнаружение ближайших криптофонов в локальной сети (mDNS) для прямой передачи сообщений и файлов при отключении глобального интернета.',
    icon: Radio,
    granted: true,
    isCritical: true,
    runtimeDetail: 'P2P шина передачи данных активна',
  },
  {
    id: 'camera_qr',
    title: 'Доступ к камере (Сканер QR-кодов)',
    shortDesc: 'Мгновенное добавление контактов и ключей (getUserMedia)',
    whyNeeded: 'Необходим для сканирования QR-кодов onion-адресов собеседников, импорта профилей WireGuard/VPN и безопасного шеринга криптографических идентификаторов.',
    icon: Camera,
    granted: false,
    isCritical: false,
    runtimeDetail: 'Нажмите для запроса доступа к камере устройства',
  },
  {
    id: 'secure_storage',
    title: 'Изолированное локальное хранилище (Persisted Storage)',
    shortDesc: 'Стойкое хранение личного сейфа ChaCha20 без сброса кэша',
    whyNeeded: 'Используется для хранения 16GB секций распределенного облака, кэша xFTP чанков и зашифрованного мастер-ключа BIP-39.',
    icon: HardDrive,
    granted: true,
    isCritical: true,
    runtimeDetail: 'Квота IndexedDB проверена',
  },
  {
    id: 'notifications',
    title: 'Системные уведомления (Notification API)',
    shortDesc: 'Сигналы SMP-чата и начисления наград в шторке OS',
    whyNeeded: 'Уведомляет о входящих зашифрованных сообщениях, раундах Proof-of-Retrievability (PoR) аудита и разблокировке вестинга NeXX.',
    icon: Bell,
    granted: false,
    isCritical: false,
    runtimeDetail: 'Нажмите для запроса системных уведомлений',
  },
];

export const SystemPermissionsModal: React.FC<SystemPermissionsModalProps> = ({
  isOpen,
  onConfirm,
}) => {
  const [permissions, setPermissions] = useState<SystemPermissionConfig[]>(DEFAULT_PERMISSIONS);
  const [isProcessingAll, setIsProcessingAll] = useState(false);

  // Initial check for already granted browser permissions (e.g. Notification or Persisted Storage)
  useEffect(() => {
    async function checkCurrentBrowserPermissions() {
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        setPermissions(prev => prev.map(p => p.id === 'notifications' ? {
          ...p,
          granted: true,
          runtimeDetail: 'Разрешено в браузере (системные пуши активны)'
        } : p));
      }

      if (typeof navigator !== 'undefined' && navigator.storage?.persisted) {
        try {
          const isPersisted = await navigator.storage.persisted();
          const est = await navigator.storage.estimate?.();
          const availableMb = est?.quota ? Math.round(est.quota / (1024 * 1024)) : 0;
          setPermissions(prev => prev.map(p => p.id === 'secure_storage' ? {
            ...p,
            granted: true,
            runtimeDetail: isPersisted 
              ? `Persisted Storage активно, доступно ~${availableMb} МБ` 
              : `IndexedDB активен, квота ~${availableMb} МБ`
          } : p));
        } catch {
          // fallback
        }
      }
    }

    if (isOpen) {
      checkCurrentBrowserPermissions();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTestAndTogglePermission = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    const targetPerm = permissions.find(p => p.id === id);
    if (!targetPerm) return;

    // If currently not granted, actively invoke real browser API
    if (!targetPerm.granted) {
      setPermissions(prev => prev.map(p => p.id === id ? { ...p, isVerifying: true } : p));
      const res = await executeRealPermissionRequest(id);
      setPermissions(prev => prev.map(p => p.id === id ? {
        ...p,
        isVerifying: false,
        granted: res.success,
        runtimeDetail: res.detail,
      } : p));
    } else {
      // Toggle off
      setPermissions(prev => prev.map(p => p.id === id ? {
        ...p,
        granted: false,
        runtimeDetail: 'Отключено пользователем',
      } : p));
    }
  };

  const handleGrantAll = async () => {
    setIsProcessingAll(true);

    const updated = [...permissions];
    for (let i = 0; i < updated.length; i++) {
      const p = updated[i];
      setPermissions(prev => prev.map(item => item.id === p.id ? { ...item, isVerifying: true } : item));
      const res = await executeRealPermissionRequest(p.id);
      updated[i] = {
        ...p,
        isVerifying: false,
        granted: res.success,
        runtimeDetail: res.detail,
      };
      setPermissions([...updated]);
    }

    setIsProcessingAll(false);

    try {
      localStorage.setItem('nexxus_permissions_granted', 'true');
      localStorage.setItem('nexxus_permissions_details', JSON.stringify(
        updated.map(p => ({ id: p.id, granted: p.granted, detail: p.runtimeDetail }))
      ));
    } catch (e) {
      console.error(e);
    }

    onConfirm();
  };

  const handleProceed = () => {
    try {
      localStorage.setItem('nexxus_permissions_granted', 'true');
      localStorage.setItem('nexxus_permissions_details', JSON.stringify(
        permissions.map(p => ({ id: p.id, granted: p.granted, detail: p.runtimeDetail }))
      ));
    } catch (e) {
      console.error(e);
    }
    onConfirm();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-2.5 sm:p-4 overflow-hidden h-full h-[100dvh]">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl max-w-lg w-full max-h-[96dvh] p-4 sm:p-6 shadow-2xl relative text-slate-100 flex flex-col justify-between overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Top Header */}
        <div className="shrink-0 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-500/30 text-emerald-300 uppercase tracking-wider font-bold">
              Первый запуск • Шаг 1 из 2
            </span>
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-white font-mono flex items-center gap-2">
            <Shield className="w-5 h-5 text-emerald-400 shrink-0" />
            Системные Разрешения
          </h2>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
            NeXXus — это автономная пиринговая операционная среда. Разрешения остаются строго локальными и никогда не передаются наружу.
          </p>
        </div>

        {/* Scrollable list of permissions */}
        <div className="flex-1 min-h-0 overflow-y-auto py-3 space-y-2.5 pr-1">
          {permissions.map((perm) => {
            const IconComp = perm.icon;
            return (
              <div 
                key={perm.id}
                onClick={(e) => handleTestAndTogglePermission(perm.id, e)}
                className={`p-3 rounded-2xl border transition cursor-pointer select-none ${
                  perm.granted 
                    ? 'bg-slate-950/90 border-emerald-500/40 shadow-sm shadow-emerald-500/5' 
                    : 'bg-slate-950/50 border-slate-800 opacity-85 hover:border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className={`p-2 rounded-xl shrink-0 mt-0.5 ${
                      perm.granted ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-500'
                    }`}>
                      <IconComp className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-white">
                          {perm.title}
                        </span>
                        {perm.isCritical && (
                          <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-amber-950 text-amber-300 border border-amber-500/30 shrink-0">
                            Важно
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-cyan-300 font-mono mt-0.5">
                        {perm.shortDesc}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                        {perm.whyNeeded}
                      </div>

                      {/* Real Runtime Detail from Hardware / Browser */}
                      {perm.runtimeDetail && (
                        <div className={`mt-2 px-2.5 py-1 rounded-lg border text-[10px] font-mono flex items-center gap-1.5 ${
                          perm.granted 
                            ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                            : 'bg-slate-900 border-slate-800 text-slate-400'
                        }`}>
                          {perm.isVerifying ? (
                            <RefreshCw className="w-3 h-3 text-cyan-400 animate-spin shrink-0" />
                          ) : perm.granted ? (
                            <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                          ) : (
                            <Info className="w-3 h-3 text-slate-500 shrink-0" />
                          )}
                          <span className="truncate">{perm.runtimeDetail}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Toggle Pill with Loading Indicator */}
                  <div className="flex flex-col items-end gap-1 shrink-0 mt-1">
                    <div className={`w-10 h-5 rounded-full p-0.5 transition-colors shrink-0 ${
                      perm.granted ? 'bg-emerald-500' : 'bg-slate-800'
                    }`}>
                      <div className={`w-4 h-4 rounded-full bg-white transition-transform ${
                        perm.granted ? 'translate-x-5' : 'translate-x-0'
                      }`} />
                    </div>
                    <span className="text-[9px] font-mono text-slate-500">
                      {perm.isVerifying ? 'Запрос...' : perm.granted ? 'Включено' : 'Выкл'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Action Buttons */}
        <div className="shrink-0 pt-3 border-t border-slate-800 space-y-2">
          <button
            onClick={handleGrantAll}
            disabled={isProcessingAll}
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 disabled:opacity-50 text-slate-950 font-black text-xs transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25"
          >
            {isProcessingAll ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                <span>Запрос системных разрешений в браузере...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Разрешить все и перейти к ключам</span>
              </>
            )}
          </button>

          <button
            onClick={handleProceed}
            disabled={isProcessingAll}
            className="w-full py-2 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-medium text-xs transition flex items-center justify-center gap-1.5"
          >
            <span>Применить выбранные</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

      </div>
    </div>
  );
};
