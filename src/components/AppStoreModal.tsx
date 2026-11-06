import React, { useState } from 'react';
import { 
  ArrowLeft, ShoppingBag, Download, Check, Shield, Lock, 
  Sparkles, ExternalLink, Smartphone, Star, Terminal, Radio, HardDrive, MessageSquare, Play
} from 'lucide-react';
import { Bip39Identity } from '../types/nexxus';
import { SdkPlaygroundModal } from './SdkPlaygroundModal';
import { RadioMeshModal } from './RadioMeshModal';

interface AppItem {
  id: string;
  name: string;
  tagline: string;
  description: string;
  category: 'core' | 'privacy' | 'storage' | 'devtools';
  icon: React.ReactNode;
  installed: boolean;
  version: string;
  sizeMb: number;
  rating: number;
  isPreinstalledSuite?: boolean;
}

interface AppStoreModalProps {
  onNavigateBackToChat: () => void;
  onOpenVault?: () => void;
  onOpenNodeDaemon?: () => void;
  identity?: Bip39Identity;
}

export const AppStoreModal: React.FC<AppStoreModalProps> = ({
  onNavigateBackToChat,
  onOpenVault,
  onOpenNodeDaemon,
  identity,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'core' | 'privacy' | 'storage' | 'devtools'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSdkOpen, setIsSdkOpen] = useState(false);
  const [isRadioOpen, setIsRadioOpen] = useState(false);
  const [apps, setApps] = useState<AppItem[]>([
    {
      id: 'app_messenger',
      name: 'NeXXus Sovereign Messenger',
      tagline: 'P2P E2EE мессенджер нового поколения',
      description: 'Обмен сообщениями по протоколу SMP без метаданных и серверов. Передача файлов по протоколу xFTP в виде 16-Кб чанков через Tor v3 onion hidden services.',
      category: 'core',
      icon: <MessageSquare className="w-6 h-6 text-emerald-400" />,
      installed: true,
      version: 'v2.4.0',
      sizeMb: 18.4,
      rating: 5.0,
      isPreinstalledSuite: true,
    },
    {
      id: 'app_vault',
      name: 'NeXXus Cloud Vault (Сейф)',
      tagline: 'Личный шифрованный диск ChaCha20',
      description: 'Суверенное персональное облако. Автоматическая нарезка файлов на 16-Кб блоки с 6-кратной избыточностью (RF=6×) по распределенной сети нод.',
      category: 'storage',
      icon: <HardDrive className="w-6 h-6 text-cyan-400" />,
      installed: true,
      version: 'v2.4.0',
      sizeMb: 12.1,
      rating: 4.9,
      isPreinstalledSuite: true,
    },
    {
      id: 'app_daemon',
      name: 'NeXXus Node Daemon & Miner',
      tagline: 'Фоновая микронода и майнинг на излишках',
      description: 'Превращает старый или текущий смартфон в 24/7 крипто-хостинг. Доказывает хранение чужих чанков (PoR) и начисляет вознаграждения в токенах $NEXX.',
      category: 'core',
      icon: <Smartphone className="w-6 h-6 text-purple-400" />,
      installed: true,
      version: 'v2.4.0',
      sizeMb: 24.8,
      rating: 4.9,
      isPreinstalledSuite: true,
    },
    {
      id: 'app_tor_gateway',
      name: 'Tor & V2Ray Circuit Gateway',
      tagline: 'Анти-блокировочный транспортный туннель',
      description: 'Многослойная маршрутизация через v2ray VMess/VLESS и Tor Circuit Isolation. Полная маскировка трафика под стандартный HTTPS.',
      category: 'privacy',
      icon: <Shield className="w-6 h-6 text-amber-400" />,
      installed: true,
      version: 'v1.9.2',
      sizeMb: 15.6,
      rating: 4.8,
    },
    {
      id: 'app_radio_mesh',
      name: 'Sovereign P2P Mesh Voice & Radio',
      tagline: 'Голосовая связь без сотовой сети и интернета',
      description: 'Децентрализованная передача голоса и экстренных пакетов по локальным Wi-Fi/mDNS и Bluetooth Low Energy mesh-сетям.',
      category: 'privacy',
      icon: <Radio className="w-6 h-6 text-pink-400" />,
      installed: false,
      version: 'v1.1.0',
      sizeMb: 9.3,
      rating: 4.7,
    },
    {
      id: 'app_sdk',
      name: 'NeXXus Developer SDK & Node CLI',
      tagline: 'Комплект разработки для сторонних dApps',
      description: 'TypeScript, Rust и Go библиотеки для интеграции децентрализованного хранилища NeXXus, проверки PoR и криптографических вызовов.',
      category: 'devtools',
      icon: <Terminal className="w-6 h-6 text-teal-400" />,
      installed: false,
      version: 'v3.0.1',
      sizeMb: 31.0,
      rating: 4.9,
    },
  ]);

  const handleToggleInstall = (appId: string) => {
    setApps(prev => prev.map(a => {
      if (a.id === appId && !a.isPreinstalledSuite) {
        return { ...a, installed: !a.installed };
      }
      return a;
    }));
  };

  const filteredApps = apps.filter(app => {
    const matchesCat = selectedCategory === 'all' || app.category === selectedCategory;
    const matchesQuery = app.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         app.tagline.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesQuery;
  });

  const handleLaunchApp = (appId: string) => {
    if (appId === 'app_messenger') {
      onNavigateBackToChat();
    } else if (appId === 'app_vault') {
      if (onOpenVault) onOpenVault();
    } else if (appId === 'app_daemon') {
      if (onOpenNodeDaemon) onOpenNodeDaemon();
    } else if (appId === 'app_sdk') {
      setIsSdkOpen(true);
    } else if (appId === 'app_radio_mesh') {
      setIsRadioOpen(true);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-[#0b0f17] text-slate-100 overflow-hidden h-full">
      {/* Top Header (shrink-0) */}
      <div className="bg-slate-900/95 border-b border-slate-800 px-3 sm:px-6 py-2.5 sm:py-3.5 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            onClick={onNavigateBackToChat}
            className="p-1.5 sm:p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition flex items-center gap-1 text-xs font-semibold shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Назад в Чат</span>
            <span className="sm:hidden">Чат</span>
          </button>
          <div className="min-w-0">
            <h1 className="text-xs sm:text-base font-bold text-white font-mono flex items-center gap-1.5 truncate">
              <ShoppingBag className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="truncate">Магазин Приложений (dApp Store)</span>
            </h1>
            <p className="text-[10px] text-slate-400 hidden sm:block truncate">
              Суверенная экосистема • Открытый код • Без цензуры Google Play / App Store
            </p>
          </div>
        </div>
      </div>

      {/* Top Controls: Compact Suite Badge + Category Filter & Search (shrink-0) */}
      <div className="p-2.5 sm:p-3.5 bg-slate-950/80 border-b border-slate-800 space-y-2 shrink-0">
        <div className="flex items-center justify-between gap-2 text-[10px] sm:text-xs font-mono">
          <span className="text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded truncate font-bold">
            📱 Cryptophone Suite: Мессенджер + Облачный Сейф + Нода
          </span>
          <span className="text-slate-500 hidden sm:inline">P2P Onion & Tor v3</span>
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 overflow-x-auto pb-0.5 scrollbar-none min-w-0">
            {[
              { id: 'all', label: 'Все' },
              { id: 'core', label: 'Базовые' },
              { id: 'storage', label: 'Хранилище' },
              { id: 'privacy', label: 'Приватность' },
              { id: 'devtools', label: 'SDK' },
            ].map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id as any)}
                className={`px-2.5 py-1 rounded-lg text-[10px] sm:text-xs font-mono transition shrink-0 ${
                  selectedCategory === cat.id
                    ? 'bg-emerald-500 text-slate-950 font-bold'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Поиск dApp..."
            className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-[11px] text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono w-28 sm:w-48 shrink-0"
          />
        </div>
      </div>

      {/* Dedicated Scrollable App Catalog List (flex-1 min-h-0 overflow-y-auto) */}
      <div className="flex-1 min-h-0 overflow-y-auto p-2.5 sm:p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredApps.map(app => (
            <div
              key={app.id}
              className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 flex flex-col justify-between space-y-4 transition group shadow-sm"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div className="w-12 h-12 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center shadow-inner">
                    {app.icon}
                  </div>
                  <div className="flex items-center gap-1 bg-slate-950 px-2 py-0.5 rounded-lg border border-slate-800 text-[10px] font-mono text-amber-400">
                    <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                    <span>{app.rating.toFixed(1)}</span>
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-white text-sm group-hover:text-emerald-300 transition">
                      {app.name}
                    </h3>
                  </div>
                  <div className="text-[11px] text-emerald-400 font-mono mt-0.5">
                    {app.tagline}
                  </div>
                  <p className="text-xs text-slate-400 mt-2 line-clamp-3 leading-relaxed">
                    {app.description}
                  </p>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono">
                <span className="text-[10px] text-slate-500">
                  {app.version} • {app.sizeMb} MB
                </span>

                <div className="flex items-center gap-1.5">
                  {app.installed && (
                    <button
                      onClick={() => handleLaunchApp(app.id)}
                      className="px-2.5 py-1.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs flex items-center gap-1 shadow transition cursor-pointer"
                    >
                      <Play className="w-3 h-3 fill-current" /> Запуск
                    </button>
                  )}

                  {app.isPreinstalledSuite ? (
                    <span className="px-2.5 py-1.5 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs flex items-center gap-1">
                      <Check className="w-3 h-3 text-emerald-400" /> В комплекте
                    </span>
                  ) : (
                    <button
                      onClick={() => handleToggleInstall(app.id)}
                      className={`px-2.5 py-1.5 rounded-xl font-bold text-xs transition flex items-center gap-1 ${
                        app.installed
                          ? 'bg-slate-800 text-slate-400 hover:text-red-300 hover:bg-red-950/40'
                          : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-sm'
                      }`}
                    >
                      {app.installed ? <Check className="w-3 h-3 text-emerald-400" /> : <Download className="w-3 h-3" />}
                      <span>{app.installed ? 'Готово' : 'Установить'}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Sdk Developer Console Modal */}
      <SdkPlaygroundModal
        isOpen={isSdkOpen}
        onClose={() => setIsSdkOpen(false)}
      />

      {/* Sovereign P2P Radio & Mesh Modal */}
      <RadioMeshModal
        isOpen={isRadioOpen}
        onClose={() => setIsRadioOpen(false)}
        identity={identity || ({} as any)}
      />
    </div>
  );
};
