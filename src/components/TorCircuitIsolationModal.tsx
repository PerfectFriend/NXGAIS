import React, { useState } from 'react';
import { Globe, Shield, RefreshCw, Layers, CheckCircle2, Zap, ArrowRight, Lock, Key, Server } from 'lucide-react';
import {
  generateIsolatedCircuits,
  TRANSPORT_CONFIGS,
  type TransportMode,
  type TorCircuitRecord
} from '../utils/torIsolationEngine';

export const TorCircuitIsolationModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const [transportMode, setTransportMode] = useState<TransportMode>('v2ray_websocket');
  const [rotationNonce, setRotationNonce] = useState(1);
  const [isRotating, setIsRotating] = useState(false);
  const [circuits, setCircuits] = useState<TorCircuitRecord[]>(() =>
    generateIsolatedCircuits('v2ray_websocket', 1)
  );

  if (!isOpen) return null;

  const currentConfig = TRANSPORT_CONFIGS[transportMode];

  const handleSelectTransport = (mode: TransportMode) => {
    setTransportMode(mode);
    setCircuits(generateIsolatedCircuits(mode, rotationNonce));
  };

  const handleRotateCircuits = () => {
    setIsRotating(true);
    setTimeout(() => {
      const nextNonce = rotationNonce + 1;
      setRotationNonce(nextNonce);
      setCircuits(generateIsolatedCircuits(transportMode, nextNonce));
      setIsRotating(false);
    }, 200);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="relative bg-slate-900 border border-cyan-500/30 rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-[0_0_50px_rgba(6,182,212,0.15)] overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-cyan-950 text-cyan-400 border border-cyan-500/30">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white font-mono">
                  Tor SOCKS5 Изоляция Потоков & Pluggable Transports
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-emerald-950 text-emerald-300 border border-emerald-500/30">
                  LIVE ENGINE
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Криптографическая изоляция потоков (IsolateSOCKSAuth) & Obfs4 / V2Ray
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-sm font-mono px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Transport Selector */}
        <div className="space-y-2 shrink-0">
          <div className="text-xs font-semibold text-slate-300 font-mono">Режим маскировки входящего/исходящего сетевого трафика:</div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <button
              onClick={() => handleSelectTransport('direct_onion')}
              className={`p-3 rounded-xl border text-left transition cursor-pointer font-mono ${
                transportMode === 'direct_onion'
                  ? 'bg-cyan-950/80 border-cyan-500 text-cyan-200'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="font-bold">Прямой Tor v3</div>
              <div className="text-[10px] text-slate-400 mt-1">Чистый onion-роутинг</div>
            </button>

            <button
              onClick={() => handleSelectTransport('obfs4_bridge')}
              className={`p-3 rounded-xl border text-left transition cursor-pointer font-mono ${
                transportMode === 'obfs4_bridge'
                  ? 'bg-cyan-950/80 border-cyan-500 text-cyan-200'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="font-bold">obfs4 Мосты</div>
              <div className="text-[10px] text-slate-400 mt-1">Рандомизация пакетов</div>
            </button>

            <button
              onClick={() => handleSelectTransport('v2ray_websocket')}
              className={`p-3 rounded-xl border text-left transition cursor-pointer font-mono ${
                transportMode === 'v2ray_websocket'
                  ? 'bg-cyan-950/80 border-cyan-500 text-cyan-200'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="font-bold">v2ray / WS-TLS</div>
              <div className="text-[10px] text-slate-400 mt-1">Маскировка под HTTPS</div>
            </button>
          </div>
        </div>

        {/* Selected Transport Spec */}
        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono space-y-1">
          <div className="text-cyan-400 font-bold">{currentConfig.protocol}</div>
          <div className="text-slate-400 flex items-center justify-between">
            <span>DPI сигнатура: {currentConfig.obfuscationHeader}</span>
            <span>Локальный порт: 127.0.0.1:{currentConfig.socksPort}</span>
          </div>
          <div className="text-slate-500 text-[10px]">
            TLS эмуляция: {currentConfig.tlsFingerprintEmulation}
          </div>
        </div>

        <div className="overflow-y-auto space-y-4 pr-1 text-xs">
          {/* Active Circuits */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-white font-mono flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-cyan-400" />
                Изолированные SOCKS-цепочки сессии (#{rotationNonce}):
              </span>
              <button
                onClick={handleRotateCircuits}
                disabled={isRotating}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono text-[11px] flex items-center gap-1 transition cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 ${isRotating ? 'animate-spin' : ''}`} />
                <span>Ротировать цепочки</span>
              </button>
            </div>

            <div className="space-y-2 font-mono">
              {circuits.map(c => (
                <div key={c.streamId} className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-xs">{c.purpose}</span>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-500/30">
                      ✓ {c.latencyMs} мс
                    </span>
                  </div>

                  <div className="text-[10px] text-slate-400 flex items-center gap-1 overflow-x-auto py-1">
                    <span className="text-slate-300 bg-slate-900 px-1.5 py-0.5 rounded">Клиент</span>
                    <ArrowRight className="w-3 h-3 text-slate-600 shrink-0" />
                    <span className="text-cyan-300 bg-cyan-950/60 px-1.5 py-0.5 rounded shrink-0">{c.guardNode}</span>
                    <ArrowRight className="w-3 h-3 text-slate-600 shrink-0" />
                    <span className="text-amber-300 bg-amber-950/60 px-1.5 py-0.5 rounded shrink-0">{c.middleNode}</span>
                    <ArrowRight className="w-3 h-3 text-slate-600 shrink-0" />
                    <span className="text-purple-300 bg-purple-950/60 px-1.5 py-0.5 rounded shrink-0">{c.targetOnion}</span>
                  </div>

                  <div className="text-[10px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-900">
                    <div className="flex items-center gap-1">
                      <Key className="w-3 h-3 text-slate-500" />
                      <span>SOCKS5 Auth: <code className="text-cyan-400">{c.socksAuth}</code></span>
                    </div>
                    <span>Circuit ID: <code className="text-slate-300">{c.circuitHash}</code></span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-500 font-mono shrink-0">
          <span>* RFC 1928 SOCKS5 Protocol & Tor IsolateSOCKSAuth Specification</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold transition cursor-pointer"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};
