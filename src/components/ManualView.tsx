import React, { useState } from 'react';
import { 
  BookOpen, Terminal, Shield, User, HardDrive, Cpu, 
  Download, CheckCircle2, AlertTriangle, Copy, Check, 
  ExternalLink, Key, RefreshCw, Network, Zap, Lock, 
  Activity, ArrowRight
} from 'lucide-react';

interface ManualViewProps {
  onNavigateTab: (tab: 'node' | 'vault' | 'fleet' | 'messenger' | 'dex') => void;
  onOpenBip39Modal: () => void;
}

export const ManualView: React.FC<ManualViewProps> = ({
  onNavigateTab,
  onOpenBip39Modal,
}) => {
  const [activeSection, setActiveSection] = useState<'user' | 'admin' | 'matrix' | 'troubleshooting'>('user');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-8">
      {/* Visual Header Banner (Cyberpunk + Gaudí + Van Gogh) */}
      <div className="relative rounded-2xl overflow-hidden border border-cyan-500/30 shadow-2xl group">
        <img
          src="/assets/images/banner-top.jpg"
          alt="NeXXUs Sovereign Crypto-Cloud Hosting — Cyberpunk Gaudí Van Gogh Banner"
          className="w-full h-48 sm:h-64 md:h-80 object-cover object-center transition duration-700 group-hover:scale-105"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent flex flex-col justify-end p-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="px-3 py-1 rounded-full bg-cyan-500/20 text-cyan-300 text-xs font-mono font-bold border border-cyan-500/40 backdrop-blur-md">
              СУВЕРЕННОЕ КРИПТООБЛАКО • КИБЕРПАНК × ГАУДИ × ВАН ГОГ
            </span>
            <span className="text-xs text-amber-300 font-mono hidden sm:inline-block">Децентрализованный Хостинг Секретов</span>
          </div>
          <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-white font-mono tracking-tight drop-shadow-md">
            NeXXUs Zero-Knowledge Crypto-Cloud
          </h2>
        </div>
      </div>

      {/* Top Hero Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-emerald-950/40 to-slate-900 border border-emerald-500/30 rounded-2xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-mono font-bold border border-emerald-500/40">
                РУКОВОДСТВО ПО ЭКСПЛУАТАЦИИ v2.0
              </span>
              <span className="text-xs text-slate-400 font-mono">User & SysAdmin Operations Guide</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight font-mono">
              Суверенное Руководство NeXXUs
            </h1>
            <p className="text-slate-300 text-sm max-w-3xl leading-relaxed">
              Полное руководство для пользователей сейфа и системных администраторов хостинг-нод: от первого запуска и шифрования секретов до развёртывания демона в Linux, настройки systemd, мониторинга PoR и аварийного восстановления.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 shrink-0">
            <a
              href="/nexxus-v2.0-source-and-audit.zip"
              download="nexxus-v2.0-source-and-audit.zip"
              className="px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs font-mono transition flex items-center gap-2 shadow-lg shadow-cyan-500/20"
              title="Полный дистрибутив: баннеры Киберпанк-Гауди-Ван Гог, README, Курилка, векторы и исходники (5.4 MB)"
            >
              <Download className="w-4 h-4" />
              <span>Архив v2.0 + Баннеры (5.4 MB)</span>
            </a>
            <a
              href="/packages/nexxus-node_latest_amd64.deb"
              download="nexxus-node_2.0.0_amd64.deb"
              className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs font-mono transition flex items-center gap-2 shadow-lg shadow-emerald-500/20"
            >
              <Download className="w-4 h-4" />
              <span>Скачать .DEB (51 KB)</span>
            </a>
            <a
              href="/MARKET_FORECAST_AND_TOKENOMICS_3Y.md"
              download="NeXXUs_3Y_Market_Forecast_and_Tokenomics.md"
              className="px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs font-mono transition flex items-center gap-2 shadow-lg shadow-cyan-600/20"
              title="Скачать полный отчет по рыночному прогнозу на 3 года и токеномике старых смартфонов"
            >
              <Download className="w-4 h-4" />
              <span>Отчёт на 3 года (.MD)</span>
            </a>
            <button
              onClick={onOpenBip39Modal}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono transition flex items-center gap-2 border border-slate-700"
            >
              <Key className="w-4 h-4 text-amber-400" />
              <span>BIP-39 Сид-фраза</span>
            </button>
          </div>
        </div>

        {/* Quick Nav Switches */}
        <div className="mt-6 pt-5 border-t border-slate-800/80 flex items-center gap-2 overflow-x-auto text-xs sm:text-sm font-medium">
          <button
            onClick={() => setActiveSection('user')}
            className={`px-4 py-2 rounded-xl transition flex items-center gap-2 shrink-0 ${
              activeSection === 'user'
                ? 'bg-emerald-600 text-white shadow-sm font-bold'
                : 'bg-slate-900/80 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <User className="w-4 h-4" />
            <span>Для Пользователя (Сейф & Файлы)</span>
          </button>

          <button
            onClick={() => setActiveSection('admin')}
            className={`px-4 py-2 rounded-xl transition flex items-center gap-2 shrink-0 ${
              activeSection === 'admin'
                ? 'bg-cyan-600 text-white shadow-sm font-bold'
                : 'bg-slate-900/80 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Terminal className="w-4 h-4" />
            <span>Для Сисадмина (Linux Daemon & CLI)</span>
          </button>

          <button
            onClick={() => setActiveSection('matrix')}
            className={`px-4 py-2 rounded-xl transition flex items-center gap-2 shrink-0 ${
              activeSection === 'matrix'
                ? 'bg-purple-600 text-white shadow-sm font-bold'
                : 'bg-slate-900/80 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>Архитектура Защиты (Побег из Матрицы)</span>
          </button>

          <button
            onClick={() => setActiveSection('troubleshooting')}
            className={`px-4 py-2 rounded-xl transition flex items-center gap-2 shrink-0 ${
              activeSection === 'troubleshooting'
                ? 'bg-amber-600 text-white shadow-sm font-bold'
                : 'bg-slate-900/80 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            <span>Устранение неполадок (FAQ)</span>
          </button>
        </div>
      </div>

      {/* SECTION 1: USER GUIDE */}
      {activeSection === 'user' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg space-y-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-2.5 font-mono">
              <User className="w-5 h-5 text-emerald-400" />
              <span>1. Руководство Пользователя: Суверенный Сейф (Vault)</span>
            </h2>
            <p className="text-slate-300 text-sm leading-relaxed">
              NeXXUs устроен так, что вам не нужно регистрироваться по номеру телефона или передавать электронную почту. Вся ваша цифровая личность деривируется из криптографического стандарта <strong className="text-white">BIP-39 (12 секретных слов)</strong>.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-mono font-bold text-sm">
                  1
                </div>
                <h3 className="font-bold text-white text-sm">Сохраните 12 слов сид-фразы</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Нажмите на кнопку «BIP-39 Ключ» в шапке. Запишите 12 слов на бумагу. Если вы потеряете фразу, файлы невозможно восстановить — никто в мире не знает мастер-ключ, кроме вас.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="w-8 h-8 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center font-mono font-bold text-sm">
                  2
                </div>
                <h3 className="font-bold text-white text-sm">Бартер: 16 ГБ диска ➔ 2 ГБ Сейфа</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Вам не нужно платить абонентскую плату. Выделяя на телефоне или компьютере 16 ГБ свободного пространства под чужие зашифрованные шарды, вы получаете 2.0 ГБ личного нерушимого Сейфа.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-mono font-bold text-sm">
                  3
                </div>
                <h3 className="font-bold text-white text-sm">Загрузка и нарезка на 16KB чанки</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Перетащите любой файл во вкладку «Приватное Облако». Файл зашифруется ключом ChaCha20, нарежется на блоки по 16 КБ и с избыточностью Reed-Solomon (4+2) рассеется по независимым узлам сети.
                </p>
              </div>
            </div>
          </div>

          {/* User Operations Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg space-y-4">
            <h3 className="text-base font-bold text-white font-mono flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-purple-400" />
              <span>Основные операции в веб-интерфейсе</span>
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-950 text-slate-400 font-mono border-b border-slate-800">
                  <tr>
                    <th className="p-3">Действие</th>
                    <th className="p-3">Где находится</th>
                    <th className="p-3">Что происходит под капотом</th>
                    <th className="p-3">Перейти</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono text-slate-300">
                  <tr>
                    <td className="p-3 font-semibold text-white">Загрузить файл в Сейф</td>
                    <td className="p-3 text-slate-400">Вкладка «Приватное Облако»</td>
                    <td className="p-3 text-slate-400">Шифрование ChaCha20-Poly1305 + матрица Рида-Соломона (4 данных + 2 четности).</td>
                    <td className="p-3">
                      <button 
                        onClick={() => onNavigateTab('vault')}
                        className="text-purple-400 hover:text-purple-300 flex items-center gap-1"
                      >
                        Открыть <ArrowRight className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                  <tr>
                    <td className="p-3 font-semibold text-white">Скачать / Восстановить файл</td>
                    <td className="p-3 text-slate-400">Список файлов в Сейфе</td>
                    <td className="p-3 text-slate-400">Параллельный опрос пиров. Для восстановления исходного файла достаточно получить любые 4 шарды из 6.</td>
                    <td className="p-3">
                      <button 
                        onClick={() => onNavigateTab('vault')}
                        className="text-purple-400 hover:text-purple-300 flex items-center gap-1"
                      >
                        Открыть <ArrowRight className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                  <tr>
                    <td className="p-3 font-semibold text-white">Управление квотой диска</td>
                    <td className="p-3 text-slate-400">Вкладка «Станция Ноды»</td>
                    <td className="p-3 text-slate-400">Переключатель авто-аллокации квантует диск секциями по 16 ГБ. Каждые дополнительные 16 ГБ увеличивают ваш Сейф.</td>
                    <td className="p-3">
                      <button 
                        onClick={() => onNavigateTab('node')}
                        className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                      >
                        Открыть <ArrowRight className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                  <tr>
                    <td className="p-3 font-semibold text-white">Анонимная связь SMP/xFTP</td>
                    <td className="p-3 text-slate-400">Вкладка «Мессенджер»</td>
                    <td className="p-3 text-slate-400">Маршрутизация сообщений через оверлей Tor v3 без сохранения метаданных и номеров телефонов.</td>
                    <td className="p-3">
                      <button 
                        onClick={() => onNavigateTab('messenger')}
                        className="text-blue-400 hover:text-blue-300 flex items-center gap-1"
                      >
                        Открыть <ArrowRight className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: ADMIN & DEBIAN GUIDE */}
      {activeSection === 'admin' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg space-y-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-2.5 font-mono">
              <Terminal className="w-5 h-5 text-cyan-400" />
              <span>2. Руководство Системного Администратора (Ubuntu Server / Debian)</span>
            </h2>
            <p className="text-slate-300 text-sm leading-relaxed">
              Пакет <strong className="text-cyan-300 font-mono">nexxus-node_2.0.0_amd64.deb</strong> (51 KB) содержит предкомпилированный бинарный демон, встроенную службу <code className="text-white">systemd</code>, оптимизацию прав доступа под пользователя <code className="text-white">nexxus:nexxus</code> и автоматическую регистрацию консольной команды <code className="text-cyan-300 font-mono">nexxusd</code> в <code className="text-slate-300">/usr/local/bin</code>.
            </p>

            {/* Quick Install Workflow */}
            <div className="space-y-3 pt-2">
              <h3 className="font-bold text-white text-sm font-mono flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Порядок установки и ввода в эксплуатацию:</span>
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Step 1 */}
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-cyan-400">ШАГ 1: Установка пакета</span>
                    <span className="text-[10px] text-slate-500 font-mono">root / sudo</span>
                  </div>
                  <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800 flex items-center justify-between font-mono text-xs text-white">
                    <span className="truncate">sudo dpkg -i nexxus-node_2.0.0_amd64.deb</span>
                    <button
                      onClick={() => handleCopy('sudo dpkg -i nexxus-node_2.0.0_amd64.deb', 'admin-dpkg')}
                      className="p-1 hover:text-cyan-300 ml-2"
                    >
                      {copiedId === 'admin-dpkg' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Создаёт пользователя nexxus, дерево каталогов <code className="text-slate-300">/var/lib/nexxus</code> и ставит юнит systemd.
                  </p>
                </div>

                {/* Step 2 */}
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-emerald-400">ШАГ 2: Запуск службы</span>
                    <span className="text-[10px] text-slate-500 font-mono">systemd</span>
                  </div>
                  <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800 flex items-center justify-between font-mono text-xs text-white">
                    <span className="truncate">sudo systemctl enable --now nexxus-node</span>
                    <button
                      onClick={() => handleCopy('sudo systemctl enable --now nexxus-node', 'admin-start')}
                      className="p-1 hover:text-emerald-300 ml-2"
                    >
                      {copiedId === 'admin-start' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Включает автозапуск при перезагрузке ОС и немедленно поднимает процесс демона.
                  </p>
                </div>

                {/* Step 3 */}
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-purple-400">ШАГ 3: Проверка статуса</span>
                    <span className="text-[10px] text-slate-500 font-mono">CLI</span>
                  </div>
                  <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800 flex items-center justify-between font-mono text-xs text-white">
                    <span className="truncate">nexxusd status</span>
                    <button
                      onClick={() => handleCopy('nexxusd status', 'admin-status')}
                      className="p-1 hover:text-purple-300 ml-2"
                    >
                      {copiedId === 'admin-status' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Выводит Node ID, размер пула, количество секций по 16 ГБ и статус Tor v3 адреса.
                  </p>
                </div>

                {/* Step 4 */}
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-amber-400">ШАГ 4: Тест PoR аудита</span>
                    <span className="text-[10px] text-slate-500 font-mono">NVMe I/O</span>
                  </div>
                  <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 flex items-center justify-between font-mono text-xs text-white">
                    <span className="truncate">nexxusd test-por</span>
                    <button
                      onClick={() => handleCopy('nexxusd test-por', 'admin-por')}
                      className="p-1 hover:text-amber-300 ml-2"
                    >
                      {copiedId === 'admin-por' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Проверяет скорость отклика диска на криптографический аудит (&lt; 3000 мс).
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Linux Admin CLI Cheat Sheet */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg space-y-4">
            <h3 className="text-base font-bold text-white font-mono flex items-center gap-2">
              <Cpu className="w-4 h-4 text-cyan-400" />
              <span>Полная таблица команд администратора CLI (`nexxusd`)</span>
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-950 text-slate-400 font-mono border-b border-slate-800">
                  <tr>
                    <th className="p-3">Команда</th>
                    <th className="p-3">Назначение</th>
                    <th className="p-3">Пример использования</th>
                    <th className="p-3">Копировать</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono text-slate-300">
                  <tr>
                    <td className="p-3 text-cyan-300 font-bold">nexxusd status</td>
                    <td className="p-3 text-slate-400">Сводка состояния, Node ID, аптайм, секции 16GB.</td>
                    <td className="p-3 text-slate-500">nexxusd status</td>
                    <td className="p-3">
                      <button onClick={() => handleCopy('nexxusd status', 'cmd-1')} className="text-cyan-400 hover:text-cyan-300">
                        {copiedId === 'cmd-1' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </td>
                  </tr>
                  <tr>
                    <td className="p-3 text-cyan-300 font-bold">nexxusd benchmark</td>
                    <td className="p-3 text-slate-400">Замер производительности случайного 16KB I/O на NVMe.</td>
                    <td className="p-3 text-slate-500">nexxusd benchmark</td>
                    <td className="p-3">
                      <button onClick={() => handleCopy('nexxusd benchmark', 'cmd-2')} className="text-cyan-400 hover:text-cyan-300">
                        {copiedId === 'cmd-2' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </td>
                  </tr>
                  <tr>
                    <td className="p-3 text-cyan-300 font-bold">nexxusd test-interhost</td>
                    <td className="p-3 text-slate-400">Сквозное P2P тестирование всех 6 фаз против другого сервера.</td>
                    <td className="p-3 text-slate-500">nexxusd test-interhost 192.168.1.50:3999</td>
                    <td className="p-3">
                      <button onClick={() => handleCopy('nexxusd test-interhost <IP>:3999', 'cmd-3')} className="text-cyan-400 hover:text-cyan-300">
                        {copiedId === 'cmd-3' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </td>
                  </tr>
                  <tr>
                    <td className="p-3 text-cyan-300 font-bold">nexxusd upload</td>
                    <td className="p-3 text-slate-400">Шифрование, нарезка и распределение файла по пирам.</td>
                    <td className="p-3 text-slate-500">nexxusd upload /var/backup.tar.gz</td>
                    <td className="p-3">
                      <button onClick={() => handleCopy('nexxusd upload /path/file.dat', 'cmd-4')} className="text-cyan-400 hover:text-cyan-300">
                        {copiedId === 'cmd-4' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </td>
                  </tr>
                  <tr>
                    <td className="p-3 text-cyan-300 font-bold">nexxusd download</td>
                    <td className="p-3 text-slate-400">Сборка файла из любых 4 шард и расшифровка.</td>
                    <td className="p-3 text-slate-500">nexxusd download &lt;HASH&gt; ./file.dat</td>
                    <td className="p-3">
                      <button onClick={() => handleCopy('nexxusd download <HASH> ./file.dat', 'cmd-5')} className="text-cyan-400 hover:text-cyan-300">
                        {copiedId === 'cmd-5' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </td>
                  </tr>
                  <tr>
                    <td className="p-3 text-cyan-300 font-bold">journalctl -u nexxus-node -f</td>
                    <td className="p-3 text-slate-400">Просмотр потока системных логов в реальном времени.</td>
                    <td className="p-3 text-slate-500">journalctl -u nexxus-node -f</td>
                    <td className="p-3">
                      <button onClick={() => handleCopy('journalctl -u nexxus-node -f', 'cmd-6')} className="text-cyan-400 hover:text-cyan-300">
                        {copiedId === 'cmd-6' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 3: MATRIX ESCAPE & PROTOCOL ARCHITECTURE */}
      {activeSection === 'matrix' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg space-y-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-2.5 font-mono">
              <Shield className="w-5 h-5 text-purple-400" />
              <span>3. Архитектура Защиты от «Большого Брата» (Matrix Escape)</span>
            </h2>
            <p className="text-slate-300 text-sm leading-relaxed">
              Почему централизованные облака (Google Drive, AWS, Яндекс.Диск) уязвимы перед цензурой, и как протокол NeXXUs делает блокировку математически и физически невозможной:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="p-4 rounded-xl bg-slate-950 border border-red-500/30 space-y-2">
                <div className="text-red-400 font-bold font-mono text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Старый Интернет (Матрица Большого Брата)</span>
                </div>
                <ul className="text-xs text-slate-400 space-y-2 list-disc pl-4 leading-relaxed">
                  <li>Файлы хранятся целиком на серверах одной корпорации в одной юрисдикции.</li>
                  <li>Доступ блокируется по щелчку цензора через отзыв учетной записи или закрытый ордер.</li>
                  <li>Ключи шифрования хранятся у провайдера (он видит содержимое файлов и обучает на них ИИ).</li>
                  <li>Абонентская плата каждый месяц: перестал платить — данные удалили.</li>
                </ul>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-emerald-500/30 space-y-2">
                <div className="text-emerald-400 font-bold font-mono text-sm flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Суверенное Облако NeXXUs</span>
                </div>
                <ul className="text-xs text-slate-400 space-y-2 list-disc pl-4 leading-relaxed">
                  <li>Файл фрагментируется на 16 КБ чанки и шифруется ChaCha20 еще до отправки в провод.</li>
                  <li>Код Рида-Соломона (4+2): падение 2 любых нод или дата-центров не повреждает данные.</li>
                  <li>Разброс шард по разным подсетям (/24) и разным автономным системам BGP ASN.</li>
                  <li>Бесплатный пожизненный бартер: вы делитесь 16 ГБ диска — взамен сеть держит ваши 2 ГБ.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 4: TROUBLESHOOTING & FAQ */}
      {activeSection === 'troubleshooting' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg space-y-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-2.5 font-mono">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              <span>4. Часто задаваемые вопросы и решение проблем (FAQ)</span>
            </h2>

            <div className="space-y-4 pt-2">
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <h3 className="font-bold text-white text-sm font-mono text-amber-300">
                  Вопрос: Что произойдет, если я выключу сервер на ночь или перезагружу роутер?
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Ответ: В протоколе действует <strong>Льготный период (Grace Period) в 1 час</strong>. Сеть не штрафует узел за кратковременную перезагрузку. Ваши шарды остаются зарезервированными. Если узел не вернется в сеть через 1 час, сработает петля самоисцеления (Self-Healing Loop), и сеть восстановит утерянные шарды на других активных участников.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <h3 className="font-bold text-white text-sm font-mono text-amber-300">
                  Вопрос: Нужен ли мне белый статический IP-адрес для ноды?
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Ответ: <strong>Нет, белый IP не требуется.</strong> Демон использует встроенный оверлей Tor v3 и механизм UPnP/STUN hole punching. Соединение между узлами устанавливается через скрытые сервисы (.onion) даже из-за «серого» мобильного интернета (CGNAT) без проброса портов на роутере.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <h3 className="font-bold text-white text-sm font-mono text-amber-300">
                  Вопрос: Как убедиться, что служба systemd работает после перезагрузки?
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Ответ: Выполните команду <code className="text-cyan-300 font-mono">sudo systemctl is-enabled nexxus-node</code> (должно вернуть <code className="text-emerald-400">enabled</code>) и <code className="text-cyan-300 font-mono">sudo systemctl is-active nexxus-node</code> (должно вернуть <code className="text-emerald-400">active</code>).
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Bottom Visual Sentinel Banner (Cyberpunk + Gaudí + Van Gogh) */}
      <div className="relative rounded-2xl overflow-hidden border border-emerald-500/30 shadow-2xl group mt-12">
        <img
          src="/assets/images/banner-bottom.jpg"
          alt="NeXXUs Decentralized Swarm — Cyberpunk Gaudí Van Gogh Banner"
          className="w-full h-48 sm:h-64 md:h-80 object-cover object-center transition duration-700 group-hover:scale-105"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent flex flex-col justify-end p-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-mono font-bold border border-emerald-500/40 backdrop-blur-md">
              СУВЕРЕННЫЙ РОЙ ХРАНЕНИЯ
            </span>
            <span className="text-xs text-cyan-300 font-mono hidden sm:inline-block">24/7/365 Независимый P2P-Хостинг</span>
          </div>
          <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-white font-mono tracking-tight drop-shadow-md">
            NeXXUs Crypto-Cloud Swarm • Бескомпромиссная Защита Секретов
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 max-w-2xl mt-1 font-mono">
            Хранение конфиденциальных данных и секретов с гарантией математической недосягаемости для провайдеров, блокировок и цензуры.
          </p>
        </div>
      </div>
    </div>
  );
};
