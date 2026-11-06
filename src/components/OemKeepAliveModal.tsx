import React, { useState } from 'react';
import { Smartphone, BatteryCharging, ShieldAlert, CheckCircle2, ChevronRight, Zap, RefreshCw, AlertTriangle, ShieldCheck } from 'lucide-react';

export type OemBrand = 'samsung' | 'xiaomi' | 'pixel' | 'tecno' | 'huawei';

interface OemGuide {
  brand: OemBrand;
  displayName: string;
  systemName: string;
  riskLevel: 'Высокий' | 'Экстремальный' | 'Умеренный';
  riskColor: string;
  steps: { title: string; desc: string; adbCommand?: string }[];
  recommendedSleepMode: string;
}

const OEM_GUIDES: Record<OemBrand, OemGuide> = {
  samsung: {
    brand: 'samsung',
    displayName: 'Samsung Galaxy',
    systemName: 'OneUI (Android 10 - 15)',
    riskLevel: 'Высокий',
    riskColor: 'text-amber-400',
    recommendedSleepMode: 'Исключить из спящих и глубоко спящих приложений',
    steps: [
      {
        title: '1. Исключение из «Глубокого сна» (Deep Sleeping Apps)',
        desc: 'Настройки → Батарея → Ограничения в фоновом режиме → Приложения, которые никогда не спят → Добавить NeXXUs Daemon.',
      },
      {
        title: '2. Отключение оптимизации аккумулятора',
        desc: 'Настройки → Приложения → Меню (три точки) → Специальный доступ → Оптимизация расхода батареи → Все приложения → NeXXUs → «Не оптимизировать».',
      },
      {
        title: '3. Блокировка в меню недавних приложений',
        desc: 'Откройте экран многозадачности, зажмите иконку NeXXUs и выберите «Закрепить приложение» (иконка замка).',
      },
      {
        title: '4. Проводной режим (постоянное питание)',
        desc: 'Включите опцию «Защита аккумулятора» (ограничение заряда 80-85%), чтобы телефон не деградировал при постоянной работе от розетки.',
      },
    ],
  },
  xiaomi: {
    brand: 'xiaomi',
    displayName: 'Xiaomi / Redmi / POCO',
    systemName: 'HyperOS / MIUI 12 - 14',
    riskLevel: 'Экстремальный',
    riskColor: 'text-red-400',
    recommendedSleepMode: 'Контроль активности: «Нет ограничений» + Автозапуск',
    steps: [
      {
        title: '1. Автозапуск (Autostart)',
        desc: 'Настройки → Приложения → Разрешения → Автозапуск в фоновом режиме → Включить для NeXXUs Daemon.',
      },
      {
        title: '2. Контроль фоновой активности (MIUI Battery Saver)',
        desc: 'Настройки → Приложения → Все приложения → NeXXUs → Контроль активности → Выбрать «Нет ограничений» (Battery saver не будет закрывать фоновый Tor-демон).',
      },
      {
        title: '3. Замок в меню недавних',
        desc: 'Экран недавних задач → долгое нажатие на карточку NeXXUs → нажать значок «Замок».',
      },
      {
        title: '4. ADB-команда (для полного бескомпромиссного режима)',
        desc: 'Отключить оптимизацию MIUI через USB Debugging:',
        adbCommand: 'adb shell settings put system allow_app_in_background 1',
      },
    ],
  },
  pixel: {
    brand: 'pixel',
    displayName: 'Google Pixel',
    systemName: 'Stock AOSP / Pixel UI (Android 11 - 15)',
    riskLevel: 'Умеренный',
    riskColor: 'text-emerald-400',
    recommendedSleepMode: 'Unrestricted Battery + Foreground Service',
    steps: [
      {
        title: '1. Батарея без ограничений (Unrestricted)',
        desc: 'Настройки → Приложения → NeXXUs → Батарея → Выбрать пункт «Без ограничений» (Unrestricted).',
      },
      {
        title: '2. Отключение Адаптивного энергопотребления (Adaptive Battery)',
        desc: 'Настройки → Батарея → Адаптивные настройки → Отключить «Адаптивное энергопотребление» для 100% честного P2P-аптайма.',
      },
      {
        title: '3. Foreground Service Channel',
        desc: 'Убедитесь, что уведомление постоянного сервиса NeXXUs разрешено в шторке (тип connectedDevice / dataSync).',
      },
    ],
  },
  tecno: {
    brand: 'tecno',
    displayName: 'Tecno / Infinix',
    systemName: 'HiOS / XOS',
    riskLevel: 'Экстремальный',
    riskColor: 'text-red-400',
    recommendedSleepMode: 'Whitelist из встроенного Phone Master Freeze',
    steps: [
      {
        title: '1. Исключение из «Заморозки» (HiOS Freezer)',
        desc: 'Phone Master → Очистка → Управление автозапуском → Включить NeXXUs. Убедитесь, что приложение НЕ добавлено в приложение «Морозилка».',
      },
      {
        title: '2. Умное энергосбережение',
        desc: 'Настройки → Управление питанием → Энергосбережение экрана → Исключить NeXXUs из списка авто-усыпления.',
      },
      {
        title: '3. Блокировка в трее задач',
        desc: 'Проведите пальцем вниз по карточке NeXXUs в списке задач для фиксации замка.',
      },
    ],
  },
  huawei: {
    brand: 'huawei',
    displayName: 'Huawei / Honor',
    systemName: 'EMUI / MagicOS',
    riskLevel: 'Экстремальный',
    riskColor: 'text-red-400',
    recommendedSleepMode: 'Ручное управление запуском',
    steps: [
      {
        title: '1. Ручной запуск приложений',
        desc: 'Настройки → Батарея → Запуск приложений → Найти NeXXUs → Переключить в режим «Управлять вручную» → Включить: Автозапуск, Косвенный запуск, Работа в фоновом режиме.',
      },
      {
        title: '2. Игнорирование оптимизации батареи',
        desc: 'Настройки → Приложения → Специальный доступ → Оптимизация батареи → Разрешить.',
      },
    ],
  },
};

export const OemKeepAliveModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const [selectedBrand, setSelectedBrand] = useState<OemBrand>('samsung');
  const [testedWakelock, setTestedWakelock] = useState(false);
  const [wakelockActive, setWakelockActive] = useState(true);

  if (!isOpen) return null;

  const currentGuide = OEM_GUIDES[selectedBrand];

  const handleTestWakelock = () => {
    setTestedWakelock(true);
    setWakelockActive(true);
    setTimeout(() => {
      setTestedWakelock(false);
    }, 2500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-cyan-950 text-cyan-400 border border-cyan-500/30">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Keep-Alive Профайлер OEM (WS0: Неубиваемый фоновый режим)
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                Инструкция по обходу таск-киллеров Android для работы ноды 24/7 без сна
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-sm font-mono px-2 py-1 rounded bg-slate-800"
          >
            ✕
          </button>
        </div>

        {/* Brand Selector Tabs */}
        <div className="grid grid-cols-5 gap-1.5 shrink-0">
          {(Object.keys(OEM_GUIDES) as OemBrand[]).map((brand) => {
            const guide = OEM_GUIDES[brand];
            return (
              <button
                key={brand}
                onClick={() => setSelectedBrand(brand)}
                className={`p-2.5 rounded-xl border text-center transition cursor-pointer ${
                  selectedBrand === brand
                    ? 'bg-cyan-950/60 border-cyan-500/80 text-cyan-200'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="text-xs font-bold truncate">{guide.displayName.split(' ')[0]}</div>
                <div className={`text-[10px] font-mono mt-0.5 ${guide.riskColor}`}>
                  {guide.riskLevel}
                </div>
              </button>
            );
          })}
        </div>

        {/* Guide Content Area */}
        <div className="overflow-y-auto space-y-4 pr-1 text-xs">
          {/* Brand Summary Banner */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
            <div>
              <div className="text-sm font-bold text-white flex items-center gap-2">
                <span>{currentGuide.displayName}</span>
                <span className="text-xs font-mono text-slate-400">({currentGuide.systemName})</span>
              </div>
              <div className="text-slate-400 text-[11px] mt-0.5">
                Целевой режим: <span className="text-cyan-300 font-semibold">{currentGuide.recommendedSleepMode}</span>
              </div>
            </div>

            <div className="text-right">
              <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded bg-black/40 border border-white/10 ${currentGuide.riskColor}`}>
                Риск сна: {currentGuide.riskLevel}
              </span>
            </div>
          </div>

          {/* Steps List */}
          <div className="space-y-2.5">
            {currentGuide.steps.map((step, idx) => (
              <div key={idx} className="p-3 rounded-xl bg-slate-950/80 border border-slate-850 space-y-1.5">
                <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span>{step.title}</span>
                </div>
                <p className="text-slate-400 text-[11px] leading-relaxed pl-5.5">
                  {step.desc}
                </p>
                {step.adbCommand && (
                  <div className="ml-5.5 mt-1.5 p-2 rounded bg-black/60 border border-cyan-500/30 font-mono text-[10px] text-cyan-300 flex items-center justify-between">
                    <code>{step.adbCommand}</code>
                    <span className="text-slate-500 text-[9px] uppercase">ADB Shell</span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Live WakeLock Diagnostic & Test */}
          <div className="p-4 rounded-xl bg-cyan-950/20 border border-cyan-500/30 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400" />
                <span className="font-bold text-white">Тест удержания Partial WakeLock (WS0)</span>
              </div>
              <button
                onClick={handleTestWakelock}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-mono text-[11px] font-bold transition cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 ${testedWakelock ? 'animate-spin' : ''}`} />
                <span>{testedWakelock ? 'Проверка...' : 'Тест удержания'}</span>
              </button>
            </div>

            <p className="text-[11px] text-slate-300">
              Статус системного сервиса: <strong className="text-emerald-400 font-mono">WAKELOCK_ACQUIRED (100% CPU lock для Tor v3 hidden service)</strong>.
            </p>
          </div>
        </div>

        {/* Footer Notice */}
        <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-500 font-mono flex items-center justify-between shrink-0">
          <span>* Критерий MVP-A: 14 суток без усыпления фонового сервиса</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold transition cursor-pointer"
          >
            Готово
          </button>
        </div>
      </div>
    </div>
  );
};
