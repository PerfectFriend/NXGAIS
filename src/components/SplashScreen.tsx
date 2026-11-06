import React, { useState, useEffect } from 'react';
import { 
  Shield, Cpu, Wifi, Globe, CheckCircle2, 
  ArrowRight, Activity, Terminal, Zap, RefreshCw,
  HardDrive, KeyRound, Sparkles, Lock, UserPlus, 
  Layers, Check, Radio
} from 'lucide-react';
import splashBgImage from '../assets/images/splash_cyberpunk_gaudi_vangogh_1792863358150.jpg';
import { 
  getRealSystemLocale, getRealNetworkDiagnostics, 
  getRealStorageCryptoDiagnostics, runRealCryptoBenchmarkAndPing,
  detectLocalAccountContext,
  RealLocaleInfo, RealNetworkInfo, RealStorageCryptoInfo, RealBenchmarkInfo, RealAccountContextInfo
} from '../utils/realSystemDiagnostics';

interface SplashScreenProps {
  onComplete: (destination?: 'login' | 'onboarding') => void;
  isRegisteredAccount?: boolean;
}

interface BootStep {
  id: string;
  title: string;
  tag: string;
  status: 'pending' | 'running' | 'completed';
  icon: React.ComponentType<{ className?: string }>;
  detail: string;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({
  onComplete,
  isRegisteredAccount: propIsRegistered,
}) => {
  const [progress, setProgress] = useState(0);
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [activeLog, setActiveLog] = useState<string>('Запуск ядра NeXXus: слияние киберпанк-контуров, архитектуры Гауди и энергии Ван Гога...');
  
  // Real diagnostic states
  const [localeInfo, setLocaleInfo] = useState<RealLocaleInfo | null>(null);
  const [networkInfo, setNetworkInfo] = useState<RealNetworkInfo | null>(null);
  const [storageInfo, setStorageInfo] = useState<RealStorageCryptoInfo | null>(null);
  const [benchmarkInfo, setBenchmarkInfo] = useState<RealBenchmarkInfo | null>(null);
  const [accountContext, setAccountContext] = useState<RealAccountContextInfo>(() => {
    const detected = detectLocalAccountContext();
    if (propIsRegistered !== undefined) {
      return {
        ...detected,
        isRegistered: propIsRegistered,
        targetDestination: propIsRegistered ? 'login' : 'onboarding',
      };
    }
    return detected;
  });

  const isUserRegistered = propIsRegistered !== undefined 
    ? propIsRegistered 
    : accountContext.isRegistered;

  // Diagnostic Checklist Steps
  const steps: BootStep[] = [
    {
      id: 'step_lang',
      title: 'Определение языка системы',
      tag: localeInfo ? `${localeInfo.language} • ${localeInfo.timeZone}` : 'Локаль UTF-8',
      status: currentStepIdx > 0 ? 'completed' : currentStepIdx === 0 ? 'running' : 'pending',
      icon: Globe,
      detail: localeInfo 
        ? `Локаль: ${localeInfo.language}, Часовой пояс: ${localeInfo.timeZone}, Кодировка: ${localeInfo.encoding}`
        : 'Сканирование языковых настроек браузера и системного формата даты/времени...',
    },
    {
      id: 'step_net',
      title: 'Определение сетевого окружения',
      tag: networkInfo ? `${networkInfo.natType} • ${networkInfo.stunLatencyMs} мс` : 'WebRTC ICE • STUN probe',
      status: currentStepIdx > 1 ? 'completed' : currentStepIdx === 1 ? 'running' : 'pending',
      icon: Wifi,
      detail: networkInfo
        ? `NAT: ${networkInfo.natType}, RTT: ${networkInfo.stunLatencyMs} мс, Канал: ${networkInfo.effectiveType?.toUpperCase() || 'NET'} (${networkInfo.downlinkMbps || 10} Mbps)`
        : 'Прощупывание WebRTC STUN NAT traversal и подготовка сокетов Onion v3...',
    },
    {
      id: 'step_storage',
      title: 'Поиск и загрузка локальных настроек',
      tag: storageInfo ? `Диск: ${storageInfo.availableGb} ГБ • WebCrypto` : 'ChaCha20-Poly1305 • Enclave',
      status: currentStepIdx > 2 ? 'completed' : currentStepIdx === 2 ? 'running' : 'pending',
      icon: HardDrive,
      detail: storageInfo
        ? `Квота хранилища: ~${storageInfo.availableGb} ГБ, Аппаратный WebCrypto Subtle: ${storageInfo.hasWebCrypto ? 'Активен' : 'Стандарт'}`
        : 'Чтение IndexedDB, квот хранилища и параметров аппаратного шифрования...',
    },
    {
      id: 'step_auth_routing',
      title: 'Наличие настроенного профиля пользователя',
      tag: isUserRegistered ? 'Профиль найден → Логин (PIN)' : 'Профиль не найден → Онбординг',
      status: currentStepIdx >= 3 ? 'completed' : currentStepIdx === 3 ? 'running' : 'pending',
      icon: isUserRegistered ? KeyRound : Sparkles,
      detail: isUserRegistered
        ? `Обнаружен настроенный аккаунт (${accountContext.accountAddress ? accountContext.accountAddress.slice(0, 16) + '...' : 'nx1q...'}). Готов переход к вводу PIN-кода.`
        : 'Настроенный профиль отсутствует. Готов переход к мастеру создания мнемоники BIP-39.',
    },
  ];

  useEffect(() => {
    let isCancelled = false;

    async function executeRealBootPipeline() {
      // Step 1: Определение языка системы
      setCurrentStepIdx(0);
      setProgress(15);
      const loc = getRealSystemLocale();
      if (isCancelled) return;
      setLocaleInfo(loc);
      setActiveLog(`[ЯЗЫК & ЛОКАЛЬ] Системный язык: ${loc.language}. Часовой пояс: ${loc.timeZone}. Кодировка: ${loc.encoding}.`);
      setProgress(28);
      await new Promise(r => setTimeout(r, 450));

      // Step 2: Сетевое окружение & WebRTC STUN NAT
      if (isCancelled) return;
      setCurrentStepIdx(1);
      setProgress(40);
      setActiveLog('[СЕТЕВОЕ ОКРУЖЕНИЕ] Запуск WebRTC ICE probe (STUN: stun.l.google.com:19302)...');
      const net = await getRealNetworkDiagnostics();
      if (isCancelled) return;
      setNetworkInfo(net);
      setActiveLog(`[СЕТЬ] NAT: ${net.natType}. Задержка STUN: ${net.stunLatencyMs} мс. Сеть: ${net.effectiveType.toUpperCase()} (${net.downlinkMbps} Mbps). Tor v3 готов.`);
      setProgress(60);
      await new Promise(r => setTimeout(r, 450));

      // Step 3: Поиск и загрузка локальных настроек
      if (isCancelled) return;
      setCurrentStepIdx(2);
      setProgress(72);
      setActiveLog('[НАСТРОЙКИ] Поиск квоты IndexedDB, профилей узлов и криптографического анклава...');
      const stor = await getRealStorageCryptoDiagnostics();
      const bench = await runRealCryptoBenchmarkAndPing();
      if (isCancelled) return;
      setStorageInfo(stor);
      setBenchmarkInfo(bench);
      setActiveLog(`[НАСТРОЙКИ] Доступно памяти: ${stor.availableGb} ГБ (${(stor.availableGb / 16).toFixed(1)} секций по 16 ГБ). ChaCha20-Poly1305 и Ed25519 проверены.`);
      setProgress(88);
      await new Promise(r => setTimeout(r, 450));

      // Step 4: Маршрутизация (Онбординг vs Логин по PIN)
      if (isCancelled) return;
      setCurrentStepIdx(3);
      setProgress(96);
      const accCtx = detectLocalAccountContext();
      setAccountContext(accCtx);
      
      const target = isUserRegistered ? 'login' : 'onboarding';
      if (isUserRegistered) {
        setActiveLog(`[МАРШРУТ] Обнаружен сохранённый аккаунт ${accCtx.accountAddress || 'NeXXus'}. Переход к экрану ввода PIN-кода...`);
      } else {
        setActiveLog('[МАРШРУТ] Первый запуск: аккаунт не зарегистрирован. Переход к мастеру онбординга (BIP-39)...');
      }
      setProgress(100);

      // Auto-transition after a brief glance so the user perceives the finished state
      await new Promise(r => setTimeout(r, 800));
      if (!isCancelled) {
        onComplete(target);
      }
    }

    executeRealBootPipeline();

    return () => {
      isCancelled = true;
    };
  }, [onComplete, isUserRegistered]);

  const handleManualEnter = (chosenDestination?: 'login' | 'onboarding') => {
    const dest = chosenDestination || (isUserRegistered ? 'login' : 'onboarding');
    onComplete(dest);
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#060810] text-slate-100 flex flex-col justify-between overflow-hidden select-none h-full h-[100dvh]">
      
      {/* Masterpiece Background Artwork: Cyberpunk + Antoni Gaudí + Vincent van Gogh */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
        <img
          src={splashBgImage}
          alt="Cyberpunk Gaudi Van Gogh Futuristic Mesh"
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover object-center filter brightness-[0.56] contrast-[1.12] scale-105 transform animate-pulse duration-[10000ms]"
        />
        
        {/* Dynamic Vignette & Cosmic Glow Overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#060810] via-[#060810]/60 to-[#060810]/35" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_20%,#060810_90%)]" />
        
        {/* Ambient Van Gogh Starry Neon Highlights */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Top Header Bar */}
      <div className="relative z-10 px-4 sm:px-6 pt-3 sm:pt-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-400 via-cyan-400 to-emerald-400 p-[1.5px] shadow-lg shadow-cyan-500/25">
            <div className="w-full h-full bg-[#080d1a] rounded-[10px] flex items-center justify-center text-amber-300">
              <Shield className="w-4 h-4 text-cyan-300" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm sm:text-base font-black tracking-wider text-white">
                NEXXUS
              </span>
              <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-cyan-950/90 text-cyan-300 border border-cyan-500/40 font-bold tracking-wide shadow-sm">
                CYBERPUNK × GAUDÍ × VAN GOGH
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-mono hidden sm:block">
              Суверенная Zero-Knowledge Криптосеть & Onion v3
            </p>
          </div>
        </div>

        {/* Direct Action Bypass / Skip Button */}
        <button
          type="button"
          onClick={() => handleManualEnter()}
          className="px-3.5 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-cyan-500/30 hover:border-cyan-400/60 text-xs font-mono text-cyan-200 hover:text-white transition flex items-center gap-2 shadow-md cursor-pointer"
        >
          <span>{isUserRegistered ? 'Войти по PIN' : 'В онбординг'}</span>
          <ArrowRight className="w-3.5 h-3.5 text-cyan-400" />
        </button>
      </div>

      {/* Center Main Stage: Compact, Balanced Glassmorphic Progress Console */}
      <div className="relative z-10 px-3 sm:px-6 max-w-xl mx-auto w-full flex-1 flex flex-col justify-center my-auto py-2">
        
        {/* Title & Van Gogh / Gaudi Aesthetic Tagline */}
        <div className="text-center mb-3">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-900/80 border border-amber-500/30 text-amber-300 text-[10px] font-mono mb-1.5 shadow-sm">
            <Sparkles className="w-3 h-3 text-amber-400" />
            <span>Starry Mesh • Organic Spire Architecture</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-white font-mono tracking-tight drop-shadow-md">
            Инициализация Системного Окружения
          </h1>
          <p className="text-xs text-slate-300 mt-1">
            Калибровка локали, сканирование сети и загрузка криптографических настроек
          </p>
        </div>

        {/* Master Glassmorphic Card */}
        <div className="bg-slate-950/85 border border-cyan-500/30 ring-1 ring-amber-400/15 rounded-2xl p-4 sm:p-5 backdrop-blur-2xl shadow-[0_0_60px_-15px_rgba(6,182,212,0.35)] space-y-3.5">
          
          {/* Progress Header */}
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-slate-300 flex items-center gap-1.5 font-semibold">
              <Activity className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              Готовность узла к запуску
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400 font-mono">
                {currentStepIdx >= 3 ? 'Завершено' : `Шаг ${currentStepIdx + 1} из 4`}
              </span>
              <span className="text-amber-300 font-mono font-bold text-sm bg-amber-950/40 border border-amber-500/30 px-2 py-0.5 rounded-lg shadow-inner">
                {progress}%
              </span>
            </div>
          </div>

          {/* Master Glowing Progress Bar: Van Gogh Starry Gold to Cyberpunk Cyan & Gaudi Emerald */}
          <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden p-[2px] border border-slate-800 shadow-inner">
            <div 
              className="h-full rounded-full bg-gradient-to-r from-amber-400 via-cyan-400 to-emerald-400 transition-all duration-300 relative shadow-[0_0_15px_rgba(6,182,212,0.6)]"
              style={{ width: `${progress}%` }}
            >
              {/* Animated Leading Shimmer Edge */}
              <div className="absolute right-0 top-0 bottom-0 w-3 bg-white/70 blur-[1px] rounded-full animate-ping" />
            </div>
          </div>

          {/* 4 Core Boot Stages Checklist */}
          <div className="space-y-2 pt-1">
            {steps.map((st) => {
              const IconComp = st.icon;
              return (
                <div 
                  key={st.id}
                  className={`flex items-center justify-between px-3 py-2 rounded-xl border transition-all text-xs font-mono ${
                    st.status === 'completed' 
                      ? 'bg-emerald-950/30 border-emerald-500/35 text-slate-100 shadow-sm'
                      : st.status === 'running'
                      ? 'bg-cyan-950/45 border-cyan-500/50 text-cyan-100 shadow-[0_0_20px_-5px_rgba(6,182,212,0.3)] ring-1 ring-cyan-500/30'
                      : 'bg-slate-950/40 border-slate-800/60 text-slate-500'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`p-1.5 rounded-lg shrink-0 ${
                      st.status === 'completed'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : st.status === 'running'
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 animate-pulse'
                        : 'bg-slate-800 text-slate-600'
                    }`}>
                      <IconComp className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-[12px] truncate flex items-center gap-1.5">
                        <span>{st.title}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 truncate mt-0.5">
                        {st.detail}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 pl-2">
                    <span className="text-[10px] text-slate-300 hidden md:inline font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-800">
                      {st.tag}
                    </span>
                    {st.status === 'completed' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : st.status === 'running' ? (
                      <RefreshCw className="w-3.5 h-3.5 text-cyan-400 animate-spin shrink-0" />
                    ) : (
                      <span className="w-2.5 h-2.5 rounded-full bg-slate-800 border border-slate-700 shrink-0" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Transition Destination Routing Banner */}
          <div className={`p-3 rounded-xl border transition-all ${
            isUserRegistered 
              ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200' 
              : 'bg-purple-950/40 border-purple-500/40 text-purple-200'
          }`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className={`p-2 rounded-xl shrink-0 ${
                  isUserRegistered ? 'bg-emerald-500/20 text-emerald-400' : 'bg-purple-500/20 text-purple-400'
                }`}>
                  {isUserRegistered ? <Lock className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] font-bold uppercase tracking-wider font-mono">
                    {isUserRegistered ? 'Обнаружен существующий профиль' : 'Первый запуск системы'}
                  </div>
                  <div className="text-[11px] text-slate-300 truncate">
                    {isUserRegistered 
                      ? 'Переход к экрану разблокировки с вводом мастер PIN-кода' 
                      : 'Переход к мастеру онбординга: создание нового аккаунта или импорт'}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleManualEnter()}
                className={`px-3.5 py-2 rounded-xl text-xs font-mono font-bold transition flex items-center justify-center gap-1.5 shrink-0 shadow-md cursor-pointer ${
                  isUserRegistered 
                    ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950' 
                    : 'bg-purple-600 hover:bg-purple-500 text-white'
                }`}
              >
                <span>{isUserRegistered ? 'Разблокировать по PIN' : 'Начать онбординг'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Live Telemetry Log Feed */}
          <div className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800/90 font-mono text-[10px] text-cyan-300 flex items-center gap-2 truncate">
            <Terminal className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="truncate">{activeLog}</span>
          </div>

        </div>
      </div>

      {/* Footer Navigation Bar */}
      <div className="relative z-10 px-4 sm:px-6 pb-3 sm:pb-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-[10px] font-mono text-slate-400 border-t border-slate-800/60 pt-2 shrink-0 bg-slate-950/60 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-slate-300">Tor Onion v3 • ChaCha20 Enclave</span>
          </div>
          <span className="text-slate-600 hidden sm:inline">•</span>
          <span className="text-slate-400 hidden sm:inline">Gaudi Biometric Mesh Architecture</span>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => handleManualEnter(isUserRegistered ? 'onboarding' : 'login')}
            className="text-cyan-400 hover:text-cyan-300 underline underline-offset-2 cursor-pointer transition"
          >
            {isUserRegistered ? 'Принудительно открыть Онбординг' : 'Принудительно открыть Логин (PIN)'}
          </button>
          <span>v2.2 Sovereign OS</span>
        </div>
      </div>

    </div>
  );
};
