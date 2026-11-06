import React, { useState, useEffect } from 'react';
import { 
  Plus, X, Copy, Check, QrCode, Smartphone, Laptop, 
  Radio, Network, ArrowRight, ShieldCheck, Activity, RefreshCw
} from 'lucide-react';
import { NodeRecord, DeviceType } from '../../types/nexxus';
import { generateQrDataUrl } from '../../utils/qrCodeService';
import { secureRandomInt } from '../../utils/cryptoRandom';
import { 
  webrtcPeerEngine, 
  WebRTCConnectionState, 
  PeerSessionStats 
} from '../../utils/webrtcPeerEngine';

export interface ConnectDeviceModalProps {
  isOpen: boolean;
  onClose: () => void;
  masterPublicKey: string;
  onAddNewNode: (newNode: Partial<NodeRecord>) => void;
}

/**
 * ConnectDeviceModal provides two pairing modes:
 * 1. BIP-39 swarm pairing via QR / Onion URI
 * 2. Real serverless WebRTC P2P DataChannel cross-device link with SDP Offer/Answer tickets
 */
export const ConnectDeviceModal: React.FC<ConnectDeviceModalProps> = ({
  isOpen,
  onClose,
  masterPublicKey,
  onAddNewNode,
}) => {
  const [activeTab, setActiveTab] = useState<'bip39' | 'webrtc'>('bip39');

  // BIP-39 State
  const [newNodeName, setNewNodeName] = useState('');
  const [newNodeType, setNewNodeType] = useState<DeviceType>('android');
  const [newNodeStorageGb, setNewNodeStorageGb] = useState<number>(64);
  const [copiedPairing, setCopiedPairing] = useState(false);
  const [pairingQrUrl, setPairingQrUrl] = useState<string>('');

  // WebRTC P2P State
  const [rtcRole, setRtcRole] = useState<'initiator' | 'receiver'>('initiator');
  const [rtcState, setRtcState] = useState<WebRTCConnectionState>('idle');
  const [rtcStats, setRtcStats] = useState<PeerSessionStats>(webrtcPeerEngine.getStats());
  const [generatedTicket, setGeneratedTicket] = useState<string>('');
  const [remoteTicketInput, setRemoteTicketInput] = useState<string>('');
  const [copiedTicket, setCopiedTicket] = useState(false);
  const [ticketQrUrl, setTicketQrUrl] = useState<string>('');
  const [rtcError, setRtcError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const pairingUri = `nexxus://pair?key=${masterPublicKey.slice(0, 32)}&net=onion`;

  useEffect(() => {
    if (!isOpen) return;
    generateQrDataUrl(pairingUri, { width: 200, margin: 1, darkColor: '#090d16', lightColor: '#ffffff' })
      .then(url => setPairingQrUrl(url))
      .catch(() => {});
  }, [isOpen, pairingUri]);

  // Subscribe to real WebRTC engine events
  useEffect(() => {
    if (!isOpen) return;
    const unsubscribe = webrtcPeerEngine.subscribe((state, stats) => {
      setRtcState(state);
      setRtcStats(stats);

      if (state === 'connected' && stats.peerNodeId) {
        // Automatically inject the live connected WebRTC peer into node fleet!
        onAddNewNode({
          id: stats.peerNodeId,
          name: stats.peerNodeName || `P2P Peer (${stats.peerNodeId.slice(0, 8)})`,
          deviceType: 'desktop_linux',
          model: 'WebRTC Direct DataChannel',
          isOnline: true,
          isCurrentDevice: false,
          onionAddress: `webrtc://${stats.peerNodeId.slice(0, 16)}.mesh`,
          v2rayActive: false,
          torActive: false,
          smpServerRunning: false,
          xFTPRelayRunning: true,
          batteryLevel: 100,
          isCharging: true,
          temperatureC: 32.0,
          wifiSsid: 'Direct_P2P_SCTP',
          wifiSignalDbm: -45,
          asn: 'AS-P2P-DIRECT',
          isp: 'Serverless WebRTC Mesh',
          internalTotalGb: 128,
          internalFreeGb: 96,
          autoModeEnabled: true,
          reservedSections16Gb: 8,
          totalStorageAllocatedGb: 128,
          personalVaultQuotaGb: 16,
          personalVaultUsedGb: 0.1,
          reputationScore: 500,
          reputationTier: 'Reliable Node (301-600)',
          consecutiveDaysWithoutPenalty: 1,
          penaltiesCount: 0,
          storedChunksCount: 450,
          replicatedChunksServed: 120,
          bandwidthSharedMb: 50.0,
          pingLatencyMs: stats.rttMs || 18,
          lastPingTimestamp: Date.now(),
          pingStatus: 'healthy',
          externalDevices: [],
        });
      }
    });

    return () => unsubscribe();
  }, [isOpen, onAddNewNode]);

  if (!isOpen) return null;

  // Handle WebRTC Offer generation
  const handleGenerateOffer = async () => {
    try {
      setIsGenerating(true);
      setRtcError(null);
      webrtcPeerEngine.configure(
        `peer_${masterPublicKey.slice(0, 12)}`,
        newNodeName.trim() || 'NeXXus Browser Node'
      );
      const ticket = await webrtcPeerEngine.createOfferTicket();
      setGeneratedTicket(ticket);
      const qr = await generateQrDataUrl(ticket, { width: 180, margin: 1, darkColor: '#090d16', lightColor: '#ffffff' });
      setTicketQrUrl(qr);
    } catch (err: any) {
      setRtcError(err?.message || 'Ошибка генерации WebRTC Offer');
    } finally {
      setIsGenerating(false);
    }
  };

  // Handle remote Offer and create Answer
  const handleAcceptOfferAndCreateAnswer = async () => {
    try {
      if (!remoteTicketInput.trim()) return;
      setIsGenerating(true);
      setRtcError(null);
      webrtcPeerEngine.configure(
        `peer_${masterPublicKey.slice(0, 12)}`,
        newNodeName.trim() || 'NeXXus Receiver Node'
      );
      const answerTicket = await webrtcPeerEngine.acceptOfferAndCreateAnswer(remoteTicketInput.trim());
      setGeneratedTicket(answerTicket);
      const qr = await generateQrDataUrl(answerTicket, { width: 180, margin: 1, darkColor: '#090d16', lightColor: '#ffffff' });
      setTicketQrUrl(qr);
    } catch (err: any) {
      setRtcError(err?.message || 'Ошибка создания WebRTC Answer');
    } finally {
      setIsGenerating(false);
    }
  };

  // Handle applying Answer on Initiator side
  const handleApplyAnswer = async () => {
    try {
      if (!remoteTicketInput.trim()) return;
      setRtcError(null);
      await webrtcPeerEngine.acceptAnswerTicket(remoteTicketInput.trim());
    } catch (err: any) {
      setRtcError(err?.message || 'Ошибка применения Answer билета');
    }
  };

  // Standard BIP-39 node registration
  const handleCreateNodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNodeName.trim()) return;

    const reserved16Gb = Math.floor(newNodeStorageGb / 16);
    const totalAllocated = reserved16Gb * 16;
    const personalQuota = totalAllocated / 8;

    const chars = 'abcdefghijklmnopqrstuvwxyz234567';
    let randOnion = 'nexxus';
    for (let i = 0; i < 48; i++) randOnion += chars[secureRandomInt(chars.length)];

    const randomAsns = [
      { asn: 'AS9009', isp: 'M247 Global Network' },
      { asn: 'AS15169', isp: 'Google Fiber Direct' },
      { asn: 'AS3301', isp: 'Telia Company AB' },
      { asn: 'AS2516', isp: 'KDDI Corporation Japan' },
      { asn: 'AS1273', isp: 'Vodafone Backbone' },
    ];
    const pickedAsn = randomAsns[secureRandomInt(randomAsns.length)];

    onAddNewNode({
      name: newNodeName.trim(),
      deviceType: newNodeType,
      model: newNodeType === 'android' ? 'Android Device (Node)' : 'Desktop Station',
      isOnline: true,
      isCurrentDevice: false,
      onionAddress: `${randOnion.slice(0, 56)}.onion:9050`,
      v2rayActive: true,
      torActive: true,
      smpServerRunning: false,
      xFTPRelayRunning: true,
      batteryLevel: 100,
      isCharging: true,
      temperatureC: 33.5,
      wifiSsid: 'Home_Decentralized_Mesh',
      wifiSignalDbm: -52,
      asn: pickedAsn.asn,
      isp: pickedAsn.isp,
      internalTotalGb: newNodeStorageGb,
      internalFreeGb: newNodeStorageGb - 8,
      autoModeEnabled: true,
      reservedSections16Gb: reserved16Gb,
      totalStorageAllocatedGb: totalAllocated,
      personalVaultQuotaGb: personalQuota,
      personalVaultUsedGb: 0.1,
      reputationScore: 400,
      reputationTier: 'Reliable Node (301-600)',
      consecutiveDaysWithoutPenalty: 0,
      penaltiesCount: 0,
      storedChunksCount: 1200,
      replicatedChunksServed: 400,
      bandwidthSharedMb: 120.0,
      externalDevices: [],
    });

    setNewNodeName('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-4 sm:p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-cyan-950 text-cyan-400 border border-cyan-500/30">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white font-mono">Подключить Устройство</h3>
              <p className="text-[10px] text-slate-400 font-mono">BIP-39 Swarm / Прямой WebRTC DataChannel</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="grid grid-cols-2 gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-mono">
          <button
            type="button"
            onClick={() => setActiveTab('bip39')}
            className={`py-1.5 px-3 rounded-lg font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'bip39'
                ? 'bg-cyan-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>BIP-39 & Onion QR</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('webrtc')}
            className={`py-1.5 px-3 rounded-lg font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'webrtc'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>Прямой WebRTC P2P</span>
          </button>
        </div>

        {/* MODE 1: BIP-39 SWARM QR */}
        {activeTab === 'bip39' && (
          <form onSubmit={handleCreateNodeSubmit} className="space-y-4 text-xs font-mono">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Название Ноды / Устройства:</label>
              <input
                type="text"
                value={newNodeName}
                onChange={e => setNewNodeName(e.target.value)}
                placeholder="Например: Старый Galaxy S10 (Балкон)"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-400"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Тип платформы:</label>
                <select
                  value={newNodeType}
                  onChange={e => setNewNodeType(e.target.value as DeviceType)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-400"
                >
                  <option value="android">Android смартфон</option>
                  <option value="desktop_linux">Linux Сервер / ПК</option>
                  <option value="desktop_win">Windows / macOS Station</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Память под секции:</label>
                <select
                  value={newNodeStorageGb}
                  onChange={e => setNewNodeStorageGb(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-400"
                >
                  <option value={16}>16 GB (1 секция • Базовый сейф)</option>
                  <option value={32}>32 GB (2 секции • 4 GB сейф)</option>
                  <option value={64}>64 GB (4 секции • 8 GB сейф)</option>
                  <option value={128}>128 GB (8 секций • 16 GB сейф)</option>
                  <option value={256}>256 GB (16 секций • 32 GB сейф)</option>
                </select>
              </div>
            </div>

            {/* Optical Pairing QR Code */}
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-slate-300 font-semibold">
                <span className="flex items-center gap-1.5">
                  <QrCode className="w-4 h-4 text-cyan-400" />
                  Оптический QR-код сопряжения ноды:
                </span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(pairingUri);
                    setCopiedPairing(true);
                    setTimeout(() => setCopiedPairing(false), 2000);
                  }}
                  className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 text-[11px] cursor-pointer"
                >
                  {copiedPairing ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedPairing ? 'Скопировано!' : 'Копировать URI'}</span>
                </button>
              </div>

              <div className="flex items-center justify-center p-2 bg-white rounded-lg">
                {pairingQrUrl ? (
                  <img
                    src={pairingQrUrl}
                    alt="Pairing QR"
                    className="w-32 h-32"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-32 h-32 bg-slate-200 animate-pulse rounded" />
                )}
              </div>

              <p className="text-[10px] text-slate-400 text-center">
                Откройте камеру на подключаемом смартфоне для авторизации в текущем BIP-39 Swarm.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold cursor-pointer"
              >
                Отмена
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold cursor-pointer"
              >
                Зарегистрировать Ноду
              </button>
            </div>
          </form>
        )}

        {/* MODE 2: DIRECT WEBRTC P2P DATACHANNEL */}
        {activeTab === 'webrtc' && (
          <div className="space-y-4 text-xs font-mono">
            {/* Live WebRTC Connection Status Banner */}
            <div className={`p-3 rounded-xl border flex items-center justify-between gap-2 ${
              rtcState === 'connected'
                ? 'bg-emerald-950/60 border-emerald-500/60 text-emerald-200 shadow-[0_0_20px_-4px_rgba(16,185,129,0.4)]'
                : rtcState === 'connecting' || rtcState === 'gathering'
                ? 'bg-cyan-950/60 border-cyan-500/50 text-cyan-200 animate-pulse'
                : rtcState === 'failed'
                ? 'bg-red-950/60 border-red-500/50 text-red-200'
                : 'bg-slate-950 border-slate-800 text-slate-400'
            }`}>
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${
                  rtcState === 'connected' ? 'bg-emerald-400 animate-pulse' :
                  rtcState === 'connecting' || rtcState === 'gathering' ? 'bg-cyan-400' :
                  rtcState === 'failed' ? 'bg-red-400' : 'bg-slate-500'
                }`} />
                <span className="font-bold">
                  {rtcState === 'connected' ? 'P2P Канал Активен (SCTP Direct)!' :
                   rtcState === 'gathering' ? 'Сбор ICE-кандидатов STUN...' :
                   rtcState === 'connecting' ? 'Установка прямого P2P соединения...' :
                   rtcState === 'offer_ready' ? 'Оффер готов к передаче' :
                   rtcState === 'answer_ready' ? 'Ответ готов к передаче' :
                   'Ожидание P2P сопряжения'}
                </span>
              </div>
              {rtcStats.rttMs > 0 && (
                <span className="text-[11px] text-emerald-400 font-bold">
                  RTT: {rtcStats.rttMs} ms
                </span>
              )}
            </div>

            {rtcError && (
              <div className="p-2.5 rounded-xl bg-red-950/70 border border-red-500/50 text-red-200 text-[11px]">
                {rtcError}
              </div>
            )}

            {/* Role Switcher: Initiator vs Receiver */}
            <div className="flex rounded-xl bg-slate-950 p-1 border border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => {
                  setRtcRole('initiator');
                  setGeneratedTicket('');
                  setRemoteTicketInput('');
                }}
                className={`flex-1 py-1.5 rounded-lg font-bold transition text-center cursor-pointer ${
                  rtcRole === 'initiator'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                1. Создать Оффер (Инициатор)
              </button>
              <button
                type="button"
                onClick={() => {
                  setRtcRole('receiver');
                  setGeneratedTicket('');
                  setRemoteTicketInput('');
                }}
                className={`flex-1 py-1.5 rounded-lg font-bold transition text-center cursor-pointer ${
                  rtcRole === 'receiver'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                2. Принять Оффер (Ответчик)
              </button>
            </div>

            {/* Step 1: Initiator Flow */}
            {rtcRole === 'initiator' && (
              <div className="space-y-3">
                {!generatedTicket ? (
                  <button
                    type="button"
                    disabled={isGenerating}
                    onClick={handleGenerateOffer}
                    className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isGenerating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Radio className="w-4 h-4" />}
                    <span>Сгенерировать P2P Билет (SDP Offer)</span>
                  </button>
                ) : (
                  <div className="space-y-3">
                    <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between text-slate-300">
                        <span className="font-semibold text-emerald-400">Ваш SDP Offer билет:</span>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(generatedTicket);
                            setCopiedTicket(true);
                            setTimeout(() => setCopiedTicket(false), 2000);
                          }}
                          className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 text-[11px] cursor-pointer"
                        >
                          {copiedTicket ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedTicket ? 'Скопировано!' : 'Копировать'}</span>
                        </button>
                      </div>

                      {ticketQrUrl && (
                        <div className="flex items-center justify-center p-2 bg-white rounded-lg">
                          <img src={ticketQrUrl} alt="Offer QR" className="w-28 h-28" />
                        </div>
                      )}

                      <p className="text-[10px] text-slate-400">
                        Отправьте этот билет второму устройству или отсканируйте камерой.
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-slate-300 font-semibold">
                        Вставьте полученный Answer билет от партнёра:
                      </label>
                      <textarea
                        value={remoteTicketInput}
                        onChange={e => setRemoteTicketInput(e.target.value)}
                        placeholder="Вставьте nexxus-sdp:v2:... полученный в ответ"
                        className="w-full h-16 bg-slate-950 border border-slate-700 rounded-xl p-2 text-[11px] text-white focus:outline-none focus:border-emerald-400"
                      />
                      <button
                        type="button"
                        onClick={handleApplyAnswer}
                        className="w-full py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold transition cursor-pointer"
                      >
                        Применить Ответ и Установить P2P Канал
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 2: Receiver Flow */}
            {rtcRole === 'receiver' && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="block text-slate-300 font-semibold">
                    Вставьте SDP Offer билет от инициатора:
                  </label>
                  <textarea
                    value={remoteTicketInput}
                    onChange={e => setRemoteTicketInput(e.target.value)}
                    placeholder="Вставьте nexxus-sdp:v2:... от первого устройства"
                    className="w-full h-16 bg-slate-950 border border-slate-700 rounded-xl p-2 text-[11px] text-white focus:outline-none focus:border-emerald-400"
                  />
                  <button
                    type="button"
                    disabled={isGenerating || !remoteTicketInput.trim()}
                    onClick={handleAcceptOfferAndCreateAnswer}
                    className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isGenerating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                    <span>Сгенерировать Ответ (SDP Answer)</span>
                  </button>
                </div>

                {generatedTicket && (
                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between text-slate-300">
                      <span className="font-semibold text-emerald-400">Ваш SDP Answer билет:</span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(generatedTicket);
                          setCopiedTicket(true);
                          setTimeout(() => setCopiedTicket(false), 2000);
                        }}
                        className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 text-[11px] cursor-pointer"
                      >
                        {copiedTicket ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedTicket ? 'Скопировано!' : 'Копировать'}</span>
                      </button>
                    </div>

                    {ticketQrUrl && (
                      <div className="flex items-center justify-center p-2 bg-white rounded-lg">
                        <img src={ticketQrUrl} alt="Answer QR" className="w-28 h-28" />
                      </div>
                    )}

                    <p className="text-[10px] text-slate-400">
                      Передайте этот ответ инициатору, чтобы завершить установку прямого SCTP DataChannel.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
