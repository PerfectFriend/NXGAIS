import React, { useState, useEffect, useRef } from 'react';
import { 
  Radio, Volume2, VolumeX, Send, AlertTriangle, ShieldCheck, 
  Activity, X, Zap, RefreshCw, Wifi, Signal, Play, Square
} from 'lucide-react';
import { p2pMeshBus } from '../utils/p2pMeshBus';
import { Bip39Identity } from '../types/nexxus';
import { ed25519 } from '@noble/curves/ed25519.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';

interface RadioMeshModalProps {
  isOpen: boolean;
  onClose: () => void;
  identity: Bip39Identity;
}

interface MeshPacket {
  id: string;
  type: 'BEACON_PING' | 'EMERGENCY_SOS' | 'VOICE_BURST';
  senderOnion: string;
  frequencyKhz: number;
  payload: string;
  timestamp: number;
  rssi: number;
}

export const RadioMeshModal: React.FC<RadioMeshModalProps> = ({
  isOpen,
  onClose,
  identity,
}) => {
  const [frequencyKhz, setFrequencyKhz] = useState<number>(433920); // 433.92 MHz ISM Band
  const [packetType, setPacketType] = useState<'BEACON_PING' | 'EMERGENCY_SOS'>('BEACON_PING');
  const [customPayload, setCustomPayload] = useState('NODE_ONLINE // STANDBY');
  const [packetsLog, setPacketsLog] = useState<MeshPacket[]>([]);
  const [isTransmitting, setIsTransmitting] = useState(false);
  const [isSoundMuted, setIsSoundMuted] = useState(false);
  const [activeChannelPeers, setActiveChannelPeers] = useState<number>(3);

  const audioCtxRef = useRef<AudioContext | null>(null);

  // Play audio frequency tone using Web Audio API
  const playRadioBeep = (freqHz = 880, durationMs = 150) => {
    if (isSoundMuted) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freqHz, ctx.currentTime);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + durationMs / 1000);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + durationMs / 1000);
    } catch {
      // Audio autoplay policy fallback
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    // Listen to local BroadcastChannel mesh packets
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel('nexxus_radio_mesh_channel');
      bc.onmessage = (e) => {
        if (e.data && e.data.type) {
          playRadioBeep(660, 100);
          setPacketsLog(prev => [e.data, ...prev].slice(0, 50));
        }
      };
    } catch {
      // BroadcastChannel fallback
    }

    // Seed initial active state
    if (packetsLog.length === 0) {
      setPacketsLog([
        {
          id: `pkt_${Date.now() - 45000}`,
          type: 'BEACON_PING',
          senderOnion: 'alice4p8q1w4e7r0t2y5u8i1o4p7a0s3d6f9g2h5j8k1l4z7x0c.onion',
          frequencyKhz: 433920,
          payload: 'HEARTBEAT // HOP_COUNT=1 // RF=6',
          timestamp: Date.now() - 45000,
          rssi: -58,
        },
        {
          id: `pkt_${Date.now() - 15000}`,
          type: 'BEACON_PING',
          senderOnion: 'satoshi77a4b8c2d6e0f4g8h2i6j0k4l8m2n6o0p4q8r2s6t0u4.onion',
          frequencyKhz: 433920,
          payload: 'KADEMLIA_ROUTING // BUCKET_ACTIVE',
          timestamp: Date.now() - 15000,
          rssi: -72,
        }
      ]);
    }

    return () => {
      if (bc) bc.close();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTransmitPacket = () => {
    setIsTransmitting(true);
    playRadioBeep(packetType === 'EMERGENCY_SOS' ? 1200 : 880, 250);

    setTimeout(() => {
      const newPacket: MeshPacket = {
        id: `pkt_${Date.now()}`,
        type: packetType,
        senderOnion: identity.onionAddress || 'current_node.onion:9050',
        frequencyKhz,
        payload: packetType === 'EMERGENCY_SOS' 
          ? `⚠️ SOS EMERGENCY // GPS_APPROX // NEED_RELAY // ${customPayload}`
          : customPayload,
        timestamp: Date.now(),
        rssi: -35, // Local transmitter
      };

      try {
        const bc = new BroadcastChannel('nexxus_radio_mesh_channel');
        bc.postMessage(newPacket);
        bc.close();
      } catch {}

      setPacketsLog(prev => [newPacket, ...prev]);
      setIsTransmitting(false);

      if (packetType === 'EMERGENCY_SOS') {
        playRadioBeep(1200, 300);
      }
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-hidden h-full">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-slate-950 px-5 py-4 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-pink-500/10 border border-pink-500/30 text-pink-400">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white font-mono flex items-center gap-2">
                Sovereign P2P Mesh Voice & Radio
                <span className="text-[10px] bg-pink-950 text-pink-400 border border-pink-500/40 px-2 py-0.5 rounded font-mono">
                  Off-Grid P2P
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Радио-маяк и связь без сотовых вышек и центрального интернета
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsSoundMuted(!isSoundMuted)}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
              title={isSoundMuted ? 'Включить звук' : 'Выключить звук'}
            >
              {isSoundMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Radio Dial & Transmitter Controls */}
        <div className="p-4 bg-slate-950/80 border-b border-slate-800 space-y-3 shrink-0 text-xs font-mono">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 text-[11px] mb-1">Рабочая частота ISM / LoRa:</label>
              <select
                value={frequencyKhz}
                onChange={e => setFrequencyKhz(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-pink-400 font-bold focus:outline-none focus:border-pink-500"
              >
                <option value={433920}>433.920 MHz (EU ISM LPD433)</option>
                <option value={868100}>868.100 MHz (EU LoRaWAN Mesh)</option>
                <option value={915000}>915.000 MHz (US ISM Band)</option>
                <option value={2400000}>2.400 GHz (Wi-Fi Direct / mDNS)</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-400 text-[11px] mb-1">Режим радио-пакета:</label>
              <div className="flex p-0.5 rounded-xl bg-slate-900 border border-slate-800">
                <button
                  type="button"
                  onClick={() => setPacketType('BEACON_PING')}
                  className={`flex-1 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                    packetType === 'BEACON_PING' ? 'bg-pink-600 text-white' : 'text-slate-400'
                  }`}
                >
                  Beacon Ping
                </button>
                <button
                  type="button"
                  onClick={() => setPacketType('EMERGENCY_SOS')}
                  className={`flex-1 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                    packetType === 'EMERGENCY_SOS' ? 'bg-red-600 text-white' : 'text-slate-400'
                  }`}
                >
                  Emergency SOS
                </button>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-slate-400 text-[11px] mb-1">Текст радио-пакета (Payload):</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={customPayload}
                onChange={e => setCustomPayload(e.target.value)}
                placeholder="Сообщение радиопередачи..."
                className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-pink-500"
              />
              <button
                type="button"
                onClick={handleTransmitPacket}
                disabled={isTransmitting}
                className="px-4 py-2 rounded-xl bg-pink-600 hover:bg-pink-500 disabled:opacity-50 text-white font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer shadow-md"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isTransmitting ? 'Передача...' : 'Передать в Mesh'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Live Received Packets Log */}
        <div className="p-4 flex-1 min-h-0 overflow-y-auto space-y-2 text-xs font-mono">
          <div className="flex items-center justify-between text-slate-400 pb-1">
            <span className="flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              Эфир частоты {(frequencyKhz / 1000).toFixed(3)} MHz:
            </span>
            <span className="text-[10px] text-slate-500">
              Локальных узлов в радиусе радиосвязи: ~{activeChannelPeers}
            </span>
          </div>

          {packetsLog.map(pkt => (
            <div
              key={pkt.id}
              className={`p-3 rounded-xl border space-y-1 transition ${
                pkt.type === 'EMERGENCY_SOS'
                  ? 'bg-red-950/40 border-red-500/50 text-red-200'
                  : 'bg-slate-950 border-slate-800 text-slate-300'
              }`}
            >
              <div className="flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-2">
                  <span className={`px-1.5 py-0.2 rounded font-bold uppercase text-[9px] ${
                    pkt.type === 'EMERGENCY_SOS'
                      ? 'bg-red-900 text-red-200 border border-red-500/60'
                      : 'bg-pink-950 text-pink-400 border border-pink-500/40'
                  }`}>
                    {pkt.type}
                  </span>
                  <span className="text-slate-400 text-[10px]">RSSI: {pkt.rssi} dBm</span>
                </div>
                <span className="text-[10px] text-slate-500">
                  {new Date(pkt.timestamp).toLocaleTimeString()}
                </span>
              </div>

              <div className="text-[11px] font-bold text-white break-words">
                {pkt.payload}
              </div>

              <div className="text-[10px] text-slate-500 truncate">
                Отправитель: {pkt.senderOnion}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
