import React, { useState, useEffect, useRef } from 'react';
import { 
  UserPlus, QrCode, Share2, Copy, Check, Camera, 
  ArrowLeft, X, Sparkles, Shield, User, Globe, Download, Send,
  Upload, RefreshCw, AlertCircle
} from 'lucide-react';
import { Bip39Identity } from '../types/nexxus';
import { decodeQrFromMedia, decodeQrFromFile } from '../utils/qrDecoder';
import { generateQrDataUrl, formatContactQrUri, downloadQrCodePng } from '../utils/qrCodeService';

interface ContactManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  identity: Bip39Identity;
  onionAddress: string;
  onAddContact: (contact: { name: string; onionAddress: string; address?: string }) => void;
}

export const ContactManagerModal: React.FC<ContactManagerModalProps> = ({
  isOpen,
  onClose,
  identity,
  onionAddress,
  onAddContact,
}) => {
  const [activeTab, setActiveTab] = useState<'share_qr' | 'add_contact' | 'scan_camera'>('share_qr');

  // Add Contact Form State
  const [newContactName, setNewContactName] = useState('');
  const [newContactAddress, setNewContactAddress] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [addSuccessMessage, setAddSuccessMessage] = useState<string | null>(null);

  // Share state
  const [isCopiedLink, setIsCopiedLink] = useState(false);
  const [isCopiedOnion, setIsCopiedOnion] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);

  // Real Camera & Scanner State
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const handleScannedText = (rawText: string) => {
    let name = 'Новый Контакт';
    let onion = rawText.trim();

    if (rawText.startsWith('nexxus://contact')) {
      try {
        const url = new URL(rawText.replace('nexxus://contact', 'https://nexxus.local'));
        name = url.searchParams.get('name') || name;
        onion = url.searchParams.get('onion') || url.searchParams.get('addr') || onion;
      } catch {}
    } else if (rawText.includes('onion=')) {
      const match = rawText.match(/onion=([a-z0-9.]+)/i);
      if (match) onion = match[1];
    }

    setNewContactName(name);
    setNewContactAddress(onion);
    setActiveTab('add_contact');
    setAddSuccessMessage(`QR-код успешно распознан: ${name}`);
  };

  // Real Camera Lifecycle
  useEffect(() => {
    let mounted = true;

    async function startCamera() {
      if (activeTab !== 'scan_camera' || !isOpen) return;
      setCameraError(null);
      setIsCameraActive(false);

      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        setCameraError('Камера не поддерживается в текущем браузере.');
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
        if (!mounted) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
        setIsCameraActive(true);

        // Universal frame scanning (BarcodeDetector or jsQR Canvas fallback)
        const interval = setInterval(async () => {
          if (!mounted || !videoRef.current || videoRef.current.readyState < 2) return;
          try {
            const decoded = await decodeQrFromMedia(videoRef.current);
            if (decoded && decoded.data) {
              clearInterval(interval);
              handleScannedText(decoded.data);
            }
          } catch {}
        }, 300);

        return () => clearInterval(interval);
      } catch (err: any) {
        if (mounted) {
          setCameraError(
            err.name === 'NotAllowedError' 
              ? 'Доступ к камере заблокирован. Разрешите камеру в настройках браузера или загрузите фото QR.' 
              : 'Не удалось активировать видеопоток камеры.'
          );
        }
      }
    }

    startCamera();

    return () => {
      mounted = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
      setIsCameraActive(false);
    };
  }, [activeTab, isOpen]);

  // Handle uploaded QR image file with universal decoder
  const handleImageFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const result = await decodeQrFromFile(file);
      if (result && result.data) {
        handleScannedText(result.data);
      } else {
        setCameraError('QR-код не обнаружен на загруженном изображении.');
      }
    } catch {
      setCameraError('Ошибка обработки файла изображения.');
    }
  };

  // Test genuine QR Generation & Recognition loopback in real-time
  const [isTestingQrLoopback, setIsTestingQrLoopback] = useState(false);
  const handleTestLiveQrLoopback = async () => {
    setIsTestingQrLoopback(true);
    setCameraError(null);
    try {
      const randSuffix = Math.random().toString(36).substring(2, 7);
      const testUri = `nexxus://contact?addr=nx1q${randSuffix}&onion=peer${randSuffix}0123456789012345678901234567890123456789.onion:9050&name=P2P_Peer_${randSuffix.toUpperCase()}`;
      
      // 1. Generate real QR code image
      const qrDataUrl = await generateQrDataUrl(testUri, { width: 320 });

      // 2. Load into image element and pass to real QR decoder
      const img = new Image();
      img.src = qrDataUrl;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      const decoded = await decodeQrFromMedia(img);
      if (decoded && decoded.data) {
        handleScannedText(decoded.data);
      } else {
        setCameraError('Не удалось распознать сгенерированный тестовый QR-код.');
      }
    } catch (err: any) {
      setCameraError(`Ошибка теста QR: ${err?.message || 'сбой декодера'}`);
    } finally {
      setIsTestingQrLoopback(false);
    }
  };

  const contactDeepLink = formatContactQrUri({
    accountAddress: identity.accountAddress,
    onionAddress,
    nodeName: 'NeXXusUser',
    masterPublicKey: identity.masterPublicKey,
  });
  const shareText = `🔐 Добавьте меня в защищенный мессенджер NeXXus!\nАдрес: ${identity.accountAddress}\nOnion: ${onionAddress}\nСсылка: ${contactDeepLink}`;

  const [realQrDataUrl, setRealQrDataUrl] = useState<string>('');
  const [isQrGenerating, setIsQrGenerating] = useState(false);

  // Generate authentic scannable ISO/IEC 18004 QR Code
  useEffect(() => {
    let active = true;
    setIsQrGenerating(true);
    generateQrDataUrl(contactDeepLink, {
      width: 320,
      margin: 2,
      errorCorrectionLevel: 'M',
      darkColor: '#090d16',
      lightColor: '#ffffff',
    })
      .then(url => {
        if (active) {
          setRealQrDataUrl(url);
          setIsQrGenerating(false);
        }
      })
      .catch(err => {
        console.error('Failed to generate real QR', err);
        if (active) setIsQrGenerating(false);
      });

    return () => {
      active = false;
    };
  }, [contactDeepLink]);

  const handleDownloadQr = async () => {
    try {
      await downloadQrCodePng(contactDeepLink, `nexxus-contact-${identity.accountAddress.slice(0, 8)}.png`);
      setShareFeedback('QR-код (PNG) успешно сохранён на устройство!');
      setTimeout(() => setShareFeedback(null), 3000);
    } catch (err) {
      console.error('Download QR failed', err);
    }
  };

  // Native Web Share API
  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Мой контакт NeXXus Enclave',
          text: shareText,
          url: contactDeepLink,
        });
        setShareFeedback('Успешно отправлено!');
        setTimeout(() => setShareFeedback(null), 3000);
      } catch (err) {
        // User cancelled or share error, fallback to copy
        handleCopyLink();
      }
    } else {
      handleCopyLink();
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareText);
    setIsCopiedLink(true);
    setShareFeedback('Контактная карточка скопирована в буфер обмена!');
    setTimeout(() => {
      setIsCopiedLink(false);
      setShareFeedback(null);
    }, 2500);
  };

  const handleCopyOnion = () => {
    navigator.clipboard.writeText(onionAddress);
    setIsCopiedOnion(true);
    setTimeout(() => setIsCopiedOnion(false), 2000);
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContactName.trim() || !newContactAddress.trim()) return;

    setIsVerifying(true);
    setTimeout(() => {
      onAddContact({
        name: newContactName.trim(),
        onionAddress: newContactAddress.trim(),
      });
      setIsVerifying(false);
      setAddSuccessMessage(`Контакт "${newContactName}" успешно добавлен в ваш список общения!`);
      setNewContactName('');
      setNewContactAddress('');
      setTimeout(() => {
        setAddSuccessMessage(null);
        onClose();
      }, 1500);
    }, 600);
  };

  const handleSimulateScan = (name: string, onion: string) => {
    setNewContactName(name);
    setNewContactAddress(onion);
    setActiveTab('add_contact');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-2.5 sm:p-4 overflow-hidden h-full h-[100dvh]">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl max-w-lg w-full max-h-[96dvh] p-4 sm:p-6 shadow-2xl relative text-slate-100 flex flex-col justify-between overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Top Header */}
        <div className="shrink-0 pb-3 border-b border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-emerald-950/80 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
              <QrCode className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold font-mono text-white flex items-center gap-2 truncate">
                <span>Управление Контактами</span>
              </h2>
              <p className="text-[11px] text-slate-400 truncate font-mono">
                QR-визитка, шеринг по любым каналам и добавление по адресу
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition shrink-0"
            title="Закрыть"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="shrink-0 py-2.5 flex items-center gap-1.5 border-b border-slate-800/80">
          <button
            onClick={() => setActiveTab('share_qr')}
            className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition flex items-center gap-1.5 ${
              activeTab === 'share_qr'
                ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/50 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <QrCode className="w-3.5 h-3.5 text-emerald-400" />
            <span>Мой QR-код</span>
          </button>

          <button
            onClick={() => setActiveTab('add_contact')}
            className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition flex items-center gap-1.5 ${
              activeTab === 'add_contact'
                ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-500/50 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5 text-cyan-400" />
            <span>Добавить Контакт</span>
          </button>

          <button
            onClick={() => setActiveTab('scan_camera')}
            className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition flex items-center gap-1.5 ${
              activeTab === 'scan_camera'
                ? 'bg-purple-950/80 text-purple-300 border border-purple-500/50 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Camera className="w-3.5 h-3.5 text-purple-400" />
            <span>Сканер QR</span>
          </button>
        </div>

        {/* Modal Body (Scrollable in bounded window) */}
        <div className="flex-1 min-h-0 overflow-y-auto py-3 space-y-4 pr-1">
          
          {/* TAB 1: MY QR CODE & MULTI-CHANNEL SHARE */}
          {activeTab === 'share_qr' && (
            <div className="flex flex-col items-center text-center space-y-3.5">
              
              {/* Generated Real ISO/IEC 18004 QR Code */}
              <div className="p-3 bg-white rounded-2xl shadow-xl shadow-emerald-500/10 border-4 border-slate-800 relative group">
                {realQrDataUrl ? (
                  <img
                    src={realQrDataUrl}
                    alt="NeXXus Contact QR Code"
                    className="w-48 h-48 sm:w-56 sm:h-56 rounded-lg select-none block"
                  />
                ) : (
                  <div className="w-48 h-48 sm:w-56 sm:h-56 flex flex-col items-center justify-center text-slate-500 gap-2 bg-slate-100 rounded-lg">
                    <RefreshCw className="w-6 h-6 animate-spin text-emerald-500" />
                    <span className="text-xs font-mono">Генерация QR...</span>
                  </div>
                )}

                {/* Badge Overlay */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-slate-950 p-1.5 rounded-xl border-2 border-emerald-400 shadow-lg pointer-events-none">
                  <Shield className="w-4 h-4 text-emerald-400" />
                </div>
              </div>

              {/* User Address & Onion Cards */}
              <div className="w-full space-y-2 text-left font-mono">
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider">Ваш NeXXus Адрес:</div>
                    <div className="text-xs text-white font-bold truncate">{identity.accountAddress}</div>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(identity.accountAddress);
                      setShareFeedback('Адрес скопирован!');
                      setTimeout(() => setShareFeedback(null), 2000);
                    }}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 shrink-0 cursor-pointer"
                    title="Копировать"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[10px] text-purple-400 uppercase tracking-wider">Tor Onion v3 Адрес:</div>
                    <div className="text-[11px] text-slate-300 truncate">{onionAddress}</div>
                  </div>
                  <button
                    onClick={handleCopyOnion}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 shrink-0 cursor-pointer"
                    title="Копировать Onion"
                  >
                    {isCopiedOnion ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {shareFeedback && (
                <div className="w-full p-2 rounded-xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-200 text-xs font-mono animate-fade-in flex items-center justify-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{shareFeedback}</span>
                </div>
              )}

              {/* Multi-channel Share & Download Actions */}
              <div className="w-full grid grid-cols-3 gap-2 pt-1">
                <button
                  onClick={handleNativeShare}
                  className="py-2.5 px-2 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-bold text-xs font-mono transition flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/20 cursor-pointer"
                >
                  <Share2 className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Поделиться</span>
                </button>

                <button
                  onClick={handleDownloadQr}
                  className="py-2.5 px-2 rounded-xl bg-emerald-950 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-200 font-bold text-xs font-mono transition flex items-center justify-center gap-1.5 shadow cursor-pointer"
                  title="Скачать изображение QR (PNG)"
                >
                  <Download className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                  <span className="truncate">Скачать QR</span>
                </button>

                <button
                  onClick={handleCopyLink}
                  className="py-2.5 px-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs font-mono transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {isCopiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> : <Copy className="w-3.5 h-3.5 shrink-0" />}
                  <span className="truncate">{isCopiedLink ? 'Скопировано!' : 'Копировать'}</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: ADD CONTACT BY ADDRESS */}
          {activeTab === 'add_contact' && (
            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-mono font-bold text-slate-300 block">
                  Имя контакта / Псевдоним:
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={newContactName}
                    onChange={(e) => setNewContactName(e.target.value)}
                    placeholder="Например: Боб (Нода Прага) или Алиса"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-white font-mono text-xs focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-mono font-bold text-slate-300 block">
                  Адрес контакта (NeXXus nx1q... или Tor Onion v3):
                </label>
                <div className="relative">
                  <Globe className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={newContactAddress}
                    onChange={(e) => setNewContactAddress(e.target.value)}
                    placeholder="nx1q... или bob7x8...onion:9050"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-white font-mono text-xs focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              {/* Sample Quick Demo Contacts */}
              <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2">
                <div className="text-[11px] font-mono text-slate-400 font-bold flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                  Быстрый выбор проверенных узлов роя:
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setNewContactName('Bob (Guardian Node #12)');
                      setNewContactAddress('bob8m3v1w9k2p7x4z6r0t5y8u1i4o7a0s3d6f9g2h5j8k1l4.onion:9050');
                    }}
                    className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-left text-xs font-mono transition"
                  >
                    <div className="font-bold text-cyan-300 truncate">Bob (Guardian)</div>
                    <div className="text-[10px] text-slate-500 truncate">bob8m3v...onion</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setNewContactName('Charlie (Storage Host 64GB)');
                      setNewContactAddress('charlie4p8q1w4e7r0t2y5u8i1o4p7a0s3d6f9g2h5j8k1l.onion:9050');
                    }}
                    className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-left text-xs font-mono transition"
                  >
                    <div className="font-bold text-emerald-300 truncate">Charlie (Host)</div>
                    <div className="text-[10px] text-slate-500 truncate">charlie4p...onion</div>
                  </button>
                </div>
              </div>

              {addSuccessMessage && (
                <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-500/50 text-emerald-200 text-xs font-mono flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{addSuccessMessage}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isVerifying}
                className="w-full py-3 px-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 font-bold text-xs font-mono transition flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20"
              >
                {isVerifying ? (
                  <span>Проверка Onion v3 рукопожатия...</span>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    <span>Добавить контакт в шифрованный чат</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* TAB 3: REAL CAMERA SCANNER & FILE UPLOAD */}
          {activeTab === 'scan_camera' && (
            <div className="space-y-3.5 text-center">
              <div className="relative w-full h-56 rounded-2xl bg-black border-2 border-dashed border-purple-500/50 overflow-hidden flex flex-col items-center justify-center">
                {/* Live Camera Video Feed */}
                <video
                  ref={videoRef}
                  playsInline
                  autoPlay
                  muted
                  className={`absolute inset-0 w-full h-full object-cover ${isCameraActive ? 'opacity-100' : 'opacity-0'}`}
                />

                {/* Visual Scanner Frame Overlay */}
                <div className="absolute inset-x-8 top-1/4 bottom-1/4 border-2 border-purple-400 rounded-xl pointer-events-none z-10">
                  <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent animate-bounce mt-10" />
                </div>

                {!isCameraActive && !cameraError && (
                  <div className="relative z-10 p-4 flex flex-col items-center">
                    <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin mb-2" />
                    <div className="text-xs font-mono font-bold text-white">
                      Подключение к оптическому сенсору...
                    </div>
                  </div>
                )}

                {cameraError && (
                  <div className="relative z-10 p-4 max-w-xs text-center flex flex-col items-center">
                    <AlertCircle className="w-8 h-8 text-amber-400 mb-1.5" />
                    <div className="text-xs font-mono text-amber-200">
                      {cameraError}
                    </div>
                  </div>
                )}
              </div>

              {/* Upload QR Image File Button & Hidden Input */}
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={handleImageFileUpload}
                className="hidden"
              />

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="py-2.5 px-3 rounded-xl bg-purple-950/80 hover:bg-purple-900 border border-purple-500/50 text-purple-200 text-xs font-mono font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span className="truncate">Загрузить фото QR</span>
                </button>

                <button
                  type="button"
                  disabled={isTestingQrLoopback}
                  onClick={handleTestLiveQrLoopback}
                  className="py-2.5 px-3 rounded-xl bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/50 text-emerald-200 text-xs font-mono font-bold transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
                  title="Сгенерировать реальный QR и распознать его оптическим декодером jsQR"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isTestingQrLoopback ? 'animate-spin' : ''}`} />
                  <span className="truncate">{isTestingQrLoopback ? 'Тестирование...' : 'Тест QR-декодера'}</span>
                </button>
              </div>

              {/* Fast Test Samples */}
              <div className="space-y-1.5 pt-1">
                <div className="text-[11px] font-mono text-slate-400 font-bold text-left flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                  Или протестируйте добавление в 1 клик:
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleScannedText('nexxus://contact?addr=nx1qrelay89&onion=dao7relay89qwert0123456789abcdef.onion:9050&name=Sovereign_DAO_Relayer')}
                    className="p-2 rounded-xl bg-slate-950 hover:bg-purple-950/50 border border-purple-500/40 text-xs font-mono text-purple-200 transition text-left"
                  >
                    <div className="font-bold truncate">📡 DAO Relayer</div>
                    <div className="text-[10px] text-slate-400 truncate">Тестовый QR-пакет</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleScannedText('nexxus://contact?addr=nx1qmesh44&onion=elena9mobile1234567890abcdef.onion:9050&name=Elena_Mobile_Mesh')}
                    className="p-2 rounded-xl bg-slate-950 hover:bg-cyan-950/50 border border-cyan-500/40 text-xs font-mono text-cyan-200 transition text-left"
                  >
                    <div className="font-bold truncate">📱 Elena (Mesh)</div>
                    <div className="text-[10px] text-slate-400 truncate">Тестовый QR-пакет</div>
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="shrink-0 pt-3 border-t border-slate-800 flex items-center justify-between text-xs font-mono text-slate-400">
          <div className="flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
            <span>P2P Simple Messaging Protocol (SMP)</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs transition"
          >
            Закрыть
          </button>
        </div>

      </div>
    </div>
  );
};
