import React, { useState, useEffect, useRef } from 'react';
import { 
  Key, Shield, Lock, AlertTriangle, Check, Copy, RefreshCw, 
  ArrowRight, ArrowLeft, ShieldAlert, Sparkles, Eye, EyeOff,
  QrCode, Camera, Upload, FileText, CheckCircle2, HardDrive, Smartphone, X
} from 'lucide-react';
import { 
  generateBip39Mnemonic, 
  isValidBip39Mnemonic, 
  deriveIdentityFromMnemonic, 
  BIP39_WORDS 
} from '../utils/bip39';
import { setupPins } from '../utils/securityPin';
import { decodeQrFromMedia, decodeQrFromFile } from '../utils/qrDecoder';
import { Bip39Identity } from '../types/nexxus';

interface OnboardingModalProps {
  isOpen: boolean;
  onComplete: (identity: Bip39Identity, isDonorNode?: boolean) => void;
  onClose?: () => void;
}

export type OnboardingStep = 
  | 'welcome' 
  | 'create_seed' 
  | 'verify_quiz' 
  | 'import_choice' 
  | 'import_seed' 
  | 'import_qr_camera' 
  | 'import_file' 
  | 'pin_setup' 
  | 'panic_pin_setup' 
  | 'node_mode';

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  isOpen,
  onComplete,
  onClose,
}) => {
  const [step, setStep] = useState<OnboardingStep>('welcome');
  
  // Seed state
  const [generatedMnemonic, setGeneratedMnemonic] = useState<string[]>(() => generateBip39Mnemonic());
  const [passphrase, setPassphrase] = useState<string>('');
  const [showPassphraseInput, setShowPassphraseInput] = useState(false);
  const [showWords, setShowWords] = useState(true);
  const [isCopied, setIsCopied] = useState(false);

  // Safety Verification Quiz state
  const [quizIndices, setQuizIndices] = useState<number[]>([2, 6, 10]); // indices 0-based for words #3, #7, #11
  const [quizSelectedWords, setQuizSelectedWords] = useState<Record<number, string>>({});
  const [quizOptions, setQuizOptions] = useState<Record<number, string[]>>({});
  const [quizError, setQuizError] = useState<string | null>(null);

  // Import state
  const [importInput, setImportInput] = useState('');
  const [importWordSuggestions, setImportWordSuggestions] = useState<string[]>([]);
  const [activeTypingWord, setActiveTypingWord] = useState<string>('');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const cameraScanIntervalRef = useRef<any>(null);

  // PIN state
  const [primaryPin, setPrimaryPin] = useState('');
  const [confirmPrimaryPin, setConfirmPrimaryPin] = useState('');
  const [panicPin, setPanicPin] = useState('');
  const [confirmPanicPin, setConfirmPanicPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);

  // Node Mode Choice
  const [isDonorNodeMode, setIsDonorNodeMode] = useState<boolean>(true);

  // Generated preview identity
  const currentDerivation = React.useMemo(() => {
    try {
      if (generatedMnemonic.length === 12 || generatedMnemonic.length === 24) {
        return deriveIdentityFromMnemonic(generatedMnemonic, passphrase);
      }
    } catch {
      // fallback
    }
    return null;
  }, [generatedMnemonic, passphrase]);

  // Regenerate mnemonic with fresh CSPRNG entropy
  const handleRegenerateMnemonic = () => {
    const fresh = generateBip39Mnemonic();
    setGeneratedMnemonic(fresh);
    setIsCopied(false);
    initQuiz(fresh);
  };

  const handleCopyMnemonic = () => {
    navigator.clipboard.writeText(generatedMnemonic.join(' '));
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2500);
  };

  // Setup safety quiz options when entering verification quiz
  const initQuiz = (mnemonic: string[]) => {
    // Pick 3 random distinct word indices from 0..11
    const indices = [2, 6, 10]; // Words #3, #7, #11
    setQuizIndices(indices);
    setQuizSelectedWords({});
    setQuizError(null);

    const opts: Record<number, string[]> = {};
    for (const idx of indices) {
      const correctWord = mnemonic[idx];
      // Pick 3 random distractor words from BIP39_WORDS
      const distractors: string[] = [];
      while (distractors.length < 3) {
        const rand = BIP39_WORDS[Math.floor(Math.random() * BIP39_WORDS.length)];
        if (rand !== correctWord && !distractors.includes(rand)) {
          distractors.push(rand);
        }
      }
      const shuffled = [correctWord, ...distractors].sort(() => Math.random() - 0.5);
      opts[idx] = shuffled;
    }
    setQuizOptions(opts);
  };

  const handleStartQuiz = () => {
    initQuiz(generatedMnemonic);
    setStep('verify_quiz');
  };

  const handleSelectQuizWord = (index: number, word: string) => {
    setQuizSelectedWords(prev => ({ ...prev, [index]: word }));
    setQuizError(null);
  };

  const handleVerifyQuiz = () => {
    for (const idx of quizIndices) {
      if (!quizSelectedWords[idx]) {
        setQuizError(`Пожалуйста, выберите слово #${idx + 1}`);
        return;
      }
      if (quizSelectedWords[idx] !== generatedMnemonic[idx]) {
        setQuizError(`Слово #${idx + 1} выбрано неверно! Проверьте ваши записи.`);
        return;
      }
    }
    setQuizError(null);
    setStep('pin_setup');
  };

  // Word suggestions while typing in import field
  const handleImportInputChange = (val: string) => {
    setImportInput(val);
    setPinError(null);

    const words = val.trim().split(/\s+/);
    const lastWord = words[words.length - 1]?.toLowerCase() || '';
    setActiveTypingWord(lastWord);

    if (lastWord.length >= 2) {
      const filtered = BIP39_WORDS.filter(w => w.startsWith(lastWord)).slice(0, 5);
      setImportWordSuggestions(filtered);
    } else {
      setImportWordSuggestions([]);
    }
  };

  const handleSelectSuggestion = (word: string) => {
    const words = importInput.trim().split(/\s+/);
    if (words.length > 0) {
      words[words.length - 1] = word;
      setImportInput(words.join(' ') + ' ');
    }
    setImportWordSuggestions([]);
  };

  const handleVerifyImportedSeed = () => {
    const words = importInput.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (words.length !== 12 && words.length !== 24) {
      setPinError(`Seed-фраза должна содержать ровно 12 или 24 слова (сейчас введено: ${words.length}).`);
      return;
    }

    // Check individual words against BIP-39 dictionary
    const unknownWords = words.filter(w => !BIP39_WORDS.includes(w));
    if (unknownWords.length > 0) {
      setPinError(`Обнаружены неизвестные слова в словаре BIP-39: "${unknownWords.join(', ')}". Проверьте написание.`);
      return;
    }

    if (!isValidBip39Mnemonic(words)) {
      setPinError('Ошибка контрольной суммы BIP-39! Одно или несколько слов перепутаны или указаны не в том порядке.');
      return;
    }

    setPinError(null);
    setGeneratedMnemonic(words);
    setStep('pin_setup');
  };

  // Real Camera Scanner implementation
  const startCameraScanner = async () => {
    setCameraError(null);
    setIsCameraActive(true);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError('Камера не поддерживается вашим браузером');
        setIsCameraActive(false);
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } }
      });
      cameraStreamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();

        cameraScanIntervalRef.current = setInterval(async () => {
          if (!videoRef.current || videoRef.current.readyState < 2) return;
          try {
            const res = await decodeQrFromMedia(videoRef.current);
            if (res && res.data) {
              handleParsedQrData(res.data);
            }
          } catch {
            // scan frame error
          }
        }, 300);
      }
    } catch (err: any) {
      setCameraError(`Доступ к камере отклонен: ${err?.message || 'ошибка'}`);
      setIsCameraActive(false);
    }
  };

  const stopCameraScanner = () => {
    if (cameraScanIntervalRef.current) {
      clearInterval(cameraScanIntervalRef.current);
      cameraScanIntervalRef.current = null;
    }
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach(t => t.stop());
      cameraStreamRef.current = null;
    }
    setIsCameraActive(false);
  };

  useEffect(() => {
    if (step === 'import_qr_camera') {
      startCameraScanner();
    } else {
      stopCameraScanner();
    }
    return () => {
      stopCameraScanner();
    };
  }, [step]);

  // Handle parsed QR payload from camera or file
  const handleParsedQrData = (rawData: string) => {
    stopCameraScanner();
    const clean = rawData.trim();

    // Check if JSON Paper Wallet
    try {
      const parsed = JSON.parse(clean);
      if (parsed && Array.isArray(parsed.mnemonic) && parsed.mnemonic.length >= 12) {
        setGeneratedMnemonic(parsed.mnemonic);
        setStep('pin_setup');
        return;
      }
    } catch {
      // not JSON
    }

    // Check if raw space-separated mnemonic
    const words = clean.toLowerCase().split(/\s+/).filter(Boolean);
    if ((words.length === 12 || words.length === 24) && isValidBip39Mnemonic(words)) {
      setGeneratedMnemonic(words);
      setStep('pin_setup');
      return;
    }

    setCameraError('QR-код распознан, но не содержит валидной мнемонической фразы NeXXus.');
  };

  // Upload QR code image or JSON file
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // If JSON or text file
    if (file.name.endsWith('.json') || file.type === 'application/json' || file.name.endsWith('.txt')) {
      try {
        const text = await file.text();
        handleParsedQrData(text);
        return;
      } catch (err: any) {
        setPinError(`Не удалось прочитать файл: ${err?.message}`);
        return;
      }
    }

    // If image file (PNG / JPEG)
    try {
      const qrRes = await decodeQrFromFile(file);
      if (qrRes && qrRes.data) {
        handleParsedQrData(qrRes.data);
      } else {
        setPinError('В загруженном изображении QR-код не обнаружен. Убедитесь в четкости изображения.');
      }
    } catch (err: any) {
      setPinError(`Ошибка распознавания: ${err?.message}`);
    }
  };

  // Primary PIN validation
  const handleValidatePrimaryPin = () => {
    if (primaryPin.length < 4 || primaryPin.length > 6) {
      setPinError('Основной PIN-код должен содержать от 4 до 6 цифр.');
      return;
    }
    if (primaryPin !== confirmPrimaryPin) {
      setPinError('Введенные PIN-коды не совпадают!');
      return;
    }
    setPinError(null);
    setStep('panic_pin_setup');
  };

  // Panic PIN validation
  const handleValidatePanicPin = () => {
    if (panicPin.length < 4 || panicPin.length > 6) {
      setPinError('Panic PIN-код должен содержать от 4 до 6 цифр.');
      return;
    }
    if (panicPin !== confirmPanicPin) {
      setPinError('Введенные Panic PIN-коды не совпадают!');
      return;
    }
    if (panicPin === primaryPin) {
      setPinError('Panic PIN обязан отличаться от Основного PIN-кода!');
      return;
    }
    setPinError(null);
    setStep('node_mode');
  };

  // Finalize Onboarding and launch app
  const handleFinalizeOnboarding = () => {
    setupPins(primaryPin, panicPin);

    const baseDerivation = deriveIdentityFromMnemonic(generatedMnemonic, passphrase);
    const newIdentity: Bip39Identity = {
      mnemonic: generatedMnemonic,
      ...baseDerivation,
      createdAt: Date.now(),
      balances: {
        nexx: isDonorNodeMode ? 250.0 : 100.0,
        ton: 10.0,
        usdc: 50.0,
        eth: 0.05,
        btc: 0.002,
      },
      unlockedNexx: isDonorNodeMode ? 250.0 : 100.0,
      lockedNexx8Weeks: 0,
      vestingBatches: [],
      subscribedStorageGb: 16,
      dailyStorageExpenseNexx: 0,
      treasury: {
        poolBalanceNexx: 184500.0,
        dailyCollectedNexx: 41.6,
        dailyDistributedNexx: 210.5,
        totalSubscribedStorageGb: 1420,
        totalPaidForeignGb: 8940,
        ratePerGbPerDay: 1.25,
        lastEpochTimestamp: Date.now() - 3600 * 1000,
        epochNumber: 155,
      },
    };

    onComplete(newIdentity, isDonorNodeMode);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-2.5 sm:p-4 overflow-hidden h-full h-[100dvh]">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl max-w-lg w-full max-h-[96dvh] p-4 sm:p-6 shadow-2xl relative text-slate-100 overflow-y-auto flex flex-col justify-between animate-in fade-in zoom-in-95 duration-200">
        
        {/* STEP 1: WELCOME & CHOICE */}
        {step === 'welcome' && (
          <div className="space-y-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-500 to-cyan-500 mx-auto flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Shield className="w-8 h-8 text-white" />
            </div>

            <div>
              <span className="text-xs font-mono uppercase tracking-wider text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-3 py-1 rounded-full">
                Суверенная P2P Сеть NeXXus v2.0
              </span>
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white mt-3 font-mono">
                Инициализация Аккаунта
              </h2>
              <p className="text-sm text-slate-400 mt-2 max-w-md mx-auto leading-relaxed">
                Никаких номеров телефонов, email или центральных серверов. 
                Ваш доступ защищен стандартом BIP-39, Ed25519 и PIN-кодом с защитой от принуждения.
              </p>
            </div>

            <div className="space-y-3 pt-2">
              <button
                onClick={() => setStep('create_seed')}
                className="w-full p-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm transition flex items-center justify-between shadow-lg shadow-emerald-600/25 group cursor-pointer"
              >
                <div className="flex items-center gap-3 text-left">
                  <div className="p-2 rounded-xl bg-white/20">
                    <Sparkles className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <div className="font-bold">Создать новый аккаунт</div>
                    <div className="text-xs text-emerald-100/80 font-normal">
                      Генерация новой 12-словной мнемоники BIP-39
                    </div>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition" />
              </button>

              <button
                onClick={() => setStep('import_choice')}
                className="w-full p-4 rounded-2xl bg-slate-950 hover:bg-slate-800/80 border border-slate-800 hover:border-slate-700 text-slate-200 font-bold text-sm transition flex items-center justify-between group cursor-pointer"
              >
                <div className="flex items-center gap-3 text-left">
                  <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                    <Key className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-bold text-white">Войти в существующий аккаунт</div>
                    <div className="text-xs text-slate-400 font-normal">
                      По сид-фразе, QR-коду или файлу бэкапа
                    </div>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-slate-500 group-hover:text-white group-hover:translate-x-1 transition" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-left pt-2 text-xs font-mono text-slate-400">
              <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>ChaCha20-Poly1305</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>Tor v3 Onion Маршрут</span>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2A: CREATE NEW SEED */}
        {step === 'create_seed' && (
          <div className="space-y-4">
            <button
              onClick={() => setStep('welcome')}
              className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 transition cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Назад к выбору
            </button>

            <div>
              <h2 className="text-xl font-bold text-white font-mono flex items-center gap-2">
                <Key className="w-5 h-5 text-emerald-400" />
                Ваша BIP-39 Мнемоническая Фраза
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Запишите эти 12 слов в точном порядке на бумаге. Это единственный способ восстановить ваш сейф и ноды.
              </p>
            </div>

            {/* Word Grid */}
            <div className="grid grid-cols-3 gap-2 bg-slate-950 p-3.5 rounded-2xl border border-slate-800">
              {generatedMnemonic.map((word, idx) => (
                <div
                  key={idx}
                  className="bg-slate-900 border border-slate-800 rounded-lg p-2 flex items-center gap-2 text-xs"
                >
                  <span className="text-[10px] font-mono text-slate-500 w-4 select-none">
                    {idx + 1}.
                  </span>
                  <span className="font-mono font-bold text-emerald-300">
                    {showWords ? word : '••••••'}
                  </span>
                </div>
              ))}
            </div>

            {/* Actions for Seed */}
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={handleCopyMnemonic}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 flex items-center gap-1.5 transition cursor-pointer"
              >
                {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                <span>{isCopied ? 'Скопировано!' : 'Скопировать'}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowWords(!showWords)}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 flex items-center gap-1.5 transition cursor-pointer"
              >
                {showWords ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                <span>{showWords ? 'Скрыть' : 'Показать'}</span>
              </button>

              <button
                type="button"
                onClick={handleRegenerateMnemonic}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 flex items-center gap-1.5 transition cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
                <span>Другие слова</span>
              </button>
            </div>

            {/* Optional Passphrase toggle */}
            <div className="pt-1">
              {!showPassphraseInput ? (
                <button
                  type="button"
                  onClick={() => setShowPassphraseInput(true)}
                  className="text-[11px] text-cyan-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  + Добавить кодовую фразу (Passphrase / 13-е слово)
                </button>
              ) : (
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300 font-bold">Опциональная Passphrase (BIP-39):</span>
                    <button
                      type="button"
                      onClick={() => {
                        setShowPassphraseInput(false);
                        setPassphrase('');
                      }}
                      className="text-slate-500 hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <input
                    type="password"
                    value={passphrase}
                    onChange={e => setPassphrase(e.target.value)}
                    placeholder="Секретная фраза для изоляции сида..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-cyan-400"
                  />
                  <span className="text-[10px] text-slate-500 block">
                    Внимание: если вы укажете Passphrase, восстановить аккаунт можно будет только с ней.
                  </span>
                </div>
              )}
            </div>

            {/* Identity Derivation Preview */}
            {currentDerivation && (
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono space-y-1">
                <div className="flex items-center justify-between text-slate-400">
                  <span>Tor v3 Onion:</span>
                  <span className="text-emerald-400 truncate max-w-[200px]">{currentDerivation.onionAddress}</span>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <span>Account ID:</span>
                  <span className="text-cyan-300 truncate max-w-[200px]">{currentDerivation.accountAddress}</span>
                </div>
              </div>
            )}

            <button
              onClick={handleStartQuiz}
              className="w-full py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs sm:text-sm transition flex items-center justify-center gap-2 cursor-pointer shadow-md"
            >
              <span>Я сохранил(а) фразу, продолжить</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* STEP 2B: SAFETY VERIFICATION QUIZ */}
        {step === 'verify_quiz' && (
          <div className="space-y-4">
            <button
              onClick={() => setStep('create_seed')}
              className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 transition cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Назад к фразе
            </button>

            <div>
              <h2 className="text-xl font-bold text-white font-mono flex items-center gap-2">
                <Shield className="w-5 h-5 text-amber-400" />
                Проверка Сохранения
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Подтвердите, что вы надежно записали вашу сид-фразу. Выберите соответствующие слова:
              </p>
            </div>

            <div className="space-y-3">
              {quizIndices.map(idx => (
                <div key={idx} className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="text-xs font-mono font-bold text-slate-300">
                    Слово <span className="text-amber-400">#{idx + 1}</span>:
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {(quizOptions[idx] || []).map(word => {
                      const isSelected = quizSelectedWords[idx] === word;
                      return (
                        <button
                          key={word}
                          type="button"
                          onClick={() => handleSelectQuizWord(idx, word)}
                          className={`py-1.5 px-2 rounded-lg text-xs font-mono font-bold border transition cursor-pointer ${
                            isSelected
                              ? 'bg-amber-500 text-slate-950 border-amber-400'
                              : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                          }`}
                        >
                          {word}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {quizError && (
              <div className="p-3 rounded-xl bg-red-950/50 border border-red-500/40 text-red-200 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{quizError}</span>
              </div>
            )}

            <button
              onClick={handleVerifyQuiz}
              className="w-full py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs sm:text-sm transition flex items-center justify-center gap-2 cursor-pointer shadow-md"
            >
              <span>Подтвердить и настроить PIN-код</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* STEP 3: IMPORT CHOICE */}
        {step === 'import_choice' && (
          <div className="space-y-5">
            <button
              onClick={() => setStep('welcome')}
              className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 transition cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Назад
            </button>

            <div>
              <h2 className="text-xl font-bold text-white font-mono flex items-center gap-2">
                <Key className="w-5 h-5 text-cyan-400" />
                Способ Подключения
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Выберите наиболее удобный способ восстановления доступа:
              </p>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => setStep('import_seed')}
                className="w-full p-4 rounded-2xl bg-slate-950 border border-slate-800 hover:border-cyan-500 hover:bg-slate-900/80 transition text-left group cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <div className="font-bold text-sm text-cyan-300 group-hover:text-cyan-200 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-cyan-400" />
                    Ввести 12 или 24 слова вручную
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 transition" />
                </div>
                <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                  Быстрая вставка из буфера обмена или набор с автодополнением и проверкой контрольной суммы.
                </p>
              </button>

              <button
                onClick={() => setStep('import_qr_camera')}
                className="w-full p-4 rounded-2xl bg-slate-950 border border-slate-800 hover:border-purple-500 hover:bg-slate-900/80 transition text-left group cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <div className="font-bold text-sm text-purple-300 group-hover:text-purple-200 flex items-center gap-2">
                    <Camera className="w-4 h-4 text-purple-400" />
                    Сканировать QR-код камерой
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-purple-400 transition" />
                </div>
                <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                  Наведите камеру смартфона на QR-код Paper Wallet для мгновенного входа.
                </p>
              </button>

              <button
                onClick={() => setStep('import_file')}
                className="w-full p-4 rounded-2xl bg-slate-950 border border-slate-800 hover:border-emerald-500 hover:bg-slate-900/80 transition text-left group cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <div className="font-bold text-sm text-emerald-300 group-hover:text-emerald-200 flex items-center gap-2">
                    <Upload className="w-4 h-4 text-emerald-400" />
                    Загрузить файл бэкапа или картинку QR
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 transition" />
                </div>
                <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                  Загрузите скриншот с QR-кодом или файл бэкапа JSON с вашего устройства.
                </p>
              </button>
            </div>
          </div>
        )}

        {/* STEP 3A: IMPORT SEED MANUALLY */}
        {step === 'import_seed' && (
          <div className="space-y-4">
            <button
              onClick={() => setStep('import_choice')}
              className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 transition cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Назад к способам
            </button>

            <div>
              <h2 className="text-xl font-bold text-white font-mono flex items-center gap-2">
                <Key className="w-5 h-5 text-cyan-400" />
                Ввод Мнемоники
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Вставьте или введите через пробел 12 или 24 слова:
              </p>
            </div>

            <div>
              <textarea
                rows={3}
                value={importInput}
                onChange={e => handleImportInputChange(e.target.value)}
                placeholder="abandon ability able about above absent absorb abstract absurd abuse access accident..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white font-mono focus:outline-none focus:border-cyan-400 leading-relaxed"
              />

              {/* Suggestions dropdown */}
              {importWordSuggestions.length > 0 && (
                <div className="flex items-center gap-1.5 pt-1.5 overflow-x-auto">
                  <span className="text-[10px] text-slate-500 font-mono">Подсказки:</span>
                  {importWordSuggestions.map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => handleSelectSuggestion(s)}
                      className="px-2 py-0.5 rounded bg-cyan-950 border border-cyan-500/40 text-cyan-300 font-mono text-[11px] hover:bg-cyan-900 cursor-pointer"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Optional passphrase input */}
            <div className="space-y-1">
              <label className="text-[11px] text-slate-400 font-mono block">
                Кодовая фраза (Passphrase / 13-е слово, если использовалась):
              </label>
              <input
                type="password"
                value={passphrase}
                onChange={e => setPassphrase(e.target.value)}
                placeholder="Оставьте пустым, если не использовали..."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-cyan-400"
              />
            </div>

            {pinError && (
              <div className="p-3 rounded-xl bg-red-950/50 border border-red-500/40 text-red-200 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{pinError}</span>
              </div>
            )}

            <button
              onClick={handleVerifyImportedSeed}
              className="w-full py-3 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs sm:text-sm transition flex items-center justify-center gap-2 cursor-pointer shadow-md"
            >
              <span>Проверить и продолжить</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* STEP 3B: IMPORT VIA CAMERA QR */}
        {step === 'import_qr_camera' && (
          <div className="space-y-4 text-center">
            <button
              onClick={() => {
                stopCameraScanner();
                setStep('import_choice');
              }}
              className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 transition cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Назад
            </button>

            <div>
              <h2 className="text-xl font-bold text-white font-mono flex items-center justify-center gap-2">
                <Camera className="w-5 h-5 text-purple-400" />
                Сканер QR-Кода
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Наведите объектив на QR-код сертификата или бумажного бэкапа:
              </p>
            </div>

            <div className="w-64 h-64 mx-auto rounded-2xl bg-black border-2 border-purple-500/50 overflow-hidden relative shadow-2xl flex items-center justify-center">
              <video
                ref={videoRef}
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-4 border border-dashed border-purple-400/70 rounded-xl pointer-events-none animate-pulse" />
            </div>

            {cameraError && (
              <div className="p-3 rounded-xl bg-red-950/50 border border-red-500/40 text-red-200 text-xs">
                {cameraError}
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                stopCameraScanner();
                setStep('import_seed');
              }}
              className="text-xs text-slate-400 hover:underline cursor-pointer"
            >
              Перейти к ручному вводу слов
            </button>
          </div>
        )}

        {/* STEP 3C: IMPORT VIA FILE */}
        {step === 'import_file' && (
          <div className="space-y-4">
            <button
              onClick={() => setStep('import_choice')}
              className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 transition cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Назад
            </button>

            <div>
              <h2 className="text-xl font-bold text-white font-mono flex items-center gap-2">
                <Upload className="w-5 h-5 text-emerald-400" />
                Загрузка Бэкапа
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Выберите файл бэкапа (.json / .txt) или изображение с QR-кодом (.png / .jpg):
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-950 border-2 border-dashed border-slate-800 hover:border-emerald-500/50 text-center space-y-3 transition">
              <Upload className="w-8 h-8 text-emerald-400 mx-auto" />
              <div className="text-xs text-slate-300">
                Перетащите файл сюда или нажмите кнопку ниже
              </div>
              <input
                type="file"
                accept=".json,.txt,image/*"
                onChange={handleFileUpload}
                className="text-xs text-slate-400 file:mr-2 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-emerald-600 file:text-white hover:file:bg-emerald-500 cursor-pointer"
              />
            </div>

            {pinError && (
              <div className="p-3 rounded-xl bg-red-950/50 border border-red-500/40 text-red-200 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{pinError}</span>
              </div>
            )}
          </div>
        )}

        {/* STEP 4: PRIMARY PIN SETUP */}
        {step === 'pin_setup' && (
          <div className="space-y-5">
            <div>
              <span className="text-xs font-mono uppercase tracking-wider text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
                Безопасность Устройства
              </span>
              <h2 className="text-xl font-bold text-white font-mono mt-2 flex items-center gap-2">
                <Lock className="w-5 h-5 text-emerald-400" />
                Установка Основного PIN-Кода
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Задает локальный PIN (4–6 цифр) для повседневного входа в приложение на этом терминале.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-mono text-slate-300 mb-1 block">Введите PIN-код:</label>
                <input
                  type="password"
                  maxLength={6}
                  value={primaryPin}
                  onChange={e => setPrimaryPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-center text-lg font-mono tracking-widest text-emerald-400 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs font-mono text-slate-300 mb-1 block">Повторите PIN-код:</label>
                <input
                  type="password"
                  maxLength={6}
                  value={confirmPrimaryPin}
                  onChange={e => setConfirmPrimaryPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-center text-lg font-mono tracking-widest text-emerald-400 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {pinError && (
              <div className="p-3 rounded-xl bg-red-950/50 border border-red-500/40 text-red-200 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{pinError}</span>
              </div>
            )}

            <button
              onClick={handleValidatePrimaryPin}
              className="w-full py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs sm:text-sm transition flex items-center justify-center gap-2 cursor-pointer shadow-md"
            >
              <span>Продолжить к Panic PIN</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* STEP 5: PANIC PIN SETUP */}
        {step === 'panic_pin_setup' && (
          <div className="space-y-5">
            <div>
              <span className="text-xs font-mono uppercase tracking-wider text-red-400 bg-red-950/60 border border-red-500/30 px-2.5 py-0.5 rounded-full">
                Защита от Принуждения
              </span>
              <h2 className="text-xl font-bold text-white font-mono mt-2 flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-red-400" />
                Настройка Panic PIN (Duress)
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Если вас принуждают разблокировать устройство, введите этот PIN. 
                Откроется пустой профиль-приманка, а реальный сейф останется зашифрован.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-mono text-slate-300 mb-1 block">Введите Panic PIN (отличающийся от основного):</label>
                <input
                  type="password"
                  maxLength={6}
                  value={panicPin}
                  onChange={e => setPanicPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-center text-lg font-mono tracking-widest text-red-400 focus:outline-none focus:border-red-500"
                />
              </div>

              <div>
                <label className="text-xs font-mono text-slate-300 mb-1 block">Повторите Panic PIN:</label>
                <input
                  type="password"
                  maxLength={6}
                  value={confirmPanicPin}
                  onChange={e => setConfirmPanicPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-center text-lg font-mono tracking-widest text-red-400 focus:outline-none focus:border-red-500"
                />
              </div>
            </div>

            {pinError && (
              <div className="p-3 rounded-xl bg-red-950/50 border border-red-500/40 text-red-200 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{pinError}</span>
              </div>
            )}

            <button
              onClick={handleValidatePanicPin}
              className="w-full py-3 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs sm:text-sm transition flex items-center justify-center gap-2 cursor-pointer shadow-md"
            >
              <span>Далее к конфигурации роли</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* STEP 6: NODE ROLE SELECTION */}
        {step === 'node_mode' && (
          <div className="space-y-5">
            <div>
              <span className="text-xs font-mono uppercase tracking-wider text-teal-400 bg-teal-950/60 border border-teal-500/30 px-2.5 py-0.5 rounded-full">
                Конфигурация Ноды
              </span>
              <h2 className="text-xl font-bold text-white font-mono mt-2 flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-teal-400" />
                Режим Работы Устройства
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Выберите, как это устройство будет участвовать в протоколе NeXXus:
              </p>
            </div>

            <div className="space-y-3">
              <button
                type="button"
                onClick={() => setIsDonorNodeMode(true)}
                className={`w-full p-4 rounded-2xl border text-left transition cursor-pointer ${
                  isDonorNodeMode
                    ? 'bg-emerald-950/30 border-emerald-500 text-white'
                    : 'bg-slate-950 border-slate-800 text-slate-400'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="font-bold text-sm text-emerald-300 flex items-center gap-2">
                    <HardDrive className="w-4 h-4 text-emerald-400" />
                    Узел-Донор и Майнер (Рекомендуется)
                  </div>
                  {isDonorNodeMode && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                </div>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                  Выделяет 16 ГБ локального накопителя под чужие зашифрованные чанки (RF=6×). 
                  Участвует в PoR и зарабатывает суточные вознаграждения в токенах $NEXX.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setIsDonorNodeMode(false)}
                className={`w-full p-4 rounded-2xl border text-left transition cursor-pointer ${
                  !isDonorNodeMode
                    ? 'bg-cyan-950/30 border-cyan-500 text-white'
                    : 'bg-slate-950 border-slate-800 text-slate-400'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="font-bold text-sm text-cyan-300 flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-cyan-400" />
                    Суверенный Клиент (Только личный сейф)
                  </div>
                  {!isDonorNodeMode && <CheckCircle2 className="w-4 h-4 text-cyan-400" />}
                </div>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                  Использует сеть только для хранения ваших личных файлов и P2P-мессенджера без выделения локального дискового пространства под сеть.
                </p>
              </button>
            </div>

            <button
              onClick={handleFinalizeOnboarding}
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs sm:text-sm transition flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/25"
            >
              <Check className="w-4 h-4" />
              <span>Войти в сеть NeXXus</span>
            </button>
          </div>
        )}

      </div>
    </div>
  );
};
