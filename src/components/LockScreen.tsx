import React, { useState, useEffect } from 'react';
import { Shield, Lock, AlertOctagon, Delete, KeyRound, ShieldAlert } from 'lucide-react';
import { verifyPin, getRemainingCooldownSeconds } from '../utils/securityPin';

interface LockScreenProps {
  onUnlock: (isDecoy: boolean) => void;
}

export const LockScreen: React.FC<LockScreenProps> = ({ onUnlock }) => {
  const [pin, setPin] = useState('');
  const [errorText, setErrorText] = useState<string | null>(null);
  const [cooldownRemaining, setCooldownRemaining] = useState<number>(() => getRemainingCooldownSeconds());
  const [isShake, setIsShake] = useState(false);

  // Check and update cooldown timer
  useEffect(() => {
    if (cooldownRemaining <= 0) return;

    const interval = setInterval(() => {
      const remaining = getRemainingCooldownSeconds();
      setCooldownRemaining(remaining);
      if (remaining <= 0) {
        setErrorText(null);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [cooldownRemaining]);

  // Handle keyboard inputs
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (cooldownRemaining > 0) return;

      if (/^[0-9]$/.test(e.key)) {
        handleDigit(e.key);
      } else if (e.key === 'Backspace') {
        handleBackspace();
      } else if (e.key === 'Enter') {
        handleSubmitPin();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pin, cooldownRemaining]);

  const handleDigit = (digit: string) => {
    if (cooldownRemaining > 0) return;
    if (pin.length < 6) {
      const nextPin = pin + digit;
      setPin(nextPin);
      setErrorText(null);
      if (nextPin.length >= 4) {
        // Auto-check on 4 or 6 digits if desired, or let user press OK
      }
    }
  };

  const handleBackspace = () => {
    setPin(prev => prev.slice(0, -1));
    setErrorText(null);
  };

  const handleClear = () => {
    setPin('');
    setErrorText(null);
  };

  const handleSubmitPin = () => {
    if (cooldownRemaining > 0) return;
    if (pin.length < 4) {
      setErrorText('Введите как минимум 4 цифры');
      return;
    }

    const result = verifyPin(pin);
    if (result.valid) {
      setPin('');
      setErrorText(null);
      onUnlock(result.isPanic);
    } else {
      // Trigger shake animation and set doubling cooldown
      setIsShake(true);
      setTimeout(() => setIsShake(false), 500);
      setPin('');
      const cooldown = result.cooldownSeconds || 5;
      setCooldownRemaining(cooldown);
      setErrorText(`Неверный PIN-код! Кулдаун: ${cooldown} сек (удваивается при каждой ошибке).`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#090d16] flex flex-col items-center justify-center p-3 sm:p-4 select-none h-full h-[100dvh] overflow-hidden">
      {/* Background glowing rings */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 left-1/2 -translate-x-1/2 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-xs flex flex-col items-center">
        {/* Enclave icon & header */}
        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl flex items-center justify-center mb-2 text-emerald-400 shrink-0">
          <Shield className="w-6 h-6 sm:w-7 sm:h-7" />
        </div>

        <h1 className="text-base sm:text-lg font-bold font-mono text-white tracking-wide">
          NeXXus Enclave Lock
        </h1>
        <p className="text-[11px] text-slate-400 mt-0.5 font-mono text-center">
          Защищено PIN-кодом и анклавом
        </p>

        {/* PIN input display dots */}
        <div className={`flex items-center gap-2.5 my-3 sm:my-4 ${isShake ? 'animate-bounce' : ''}`}>
          {[0, 1, 2, 3, 4, 5].map(idx => (
            <div
              key={idx}
              className={`w-3 h-3 rounded-full transition-all duration-200 ${
                idx < pin.length
                  ? 'bg-emerald-400 scale-110 shadow-lg shadow-emerald-400/50'
                  : 'bg-slate-800 border border-slate-700'
              }`}
            />
          ))}
        </div>

        {/* Error / Cooldown Alert */}
        {cooldownRemaining > 0 ? (
          <div className="mb-2 w-full p-2 rounded-xl bg-red-950/40 border border-red-500/40 text-red-200 text-xs text-center flex flex-col items-center gap-0.5">
            <div className="flex items-center gap-1 font-bold text-[11px]">
              <AlertOctagon className="w-3.5 h-3.5 text-red-400 animate-pulse" />
              Ввод заблокирован!
            </div>
            <div className="text-[10px] font-mono">
              Повтор через: <strong className="text-white text-xs">{cooldownRemaining}</strong> сек
            </div>
          </div>
        ) : errorText ? (
          <div className="mb-2 text-[11px] text-red-400 text-center font-medium">
            {errorText}
          </div>
        ) : (
          <div className="h-5 mb-2 text-[10px] text-slate-500 font-mono text-center">
            Клавиатура или сенсорная панель
          </div>
        )}

        {/* Numeric Keypad */}
        <div className="grid grid-cols-3 gap-2 w-full max-w-[260px]">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
            <button
              key={num}
              disabled={cooldownRemaining > 0}
              onClick={() => handleDigit(num)}
              className="h-11 sm:h-12 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 hover:bg-slate-800 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed transition flex items-center justify-center text-lg font-bold font-mono text-white shadow-sm"
            >
              {num}
            </button>
          ))}

          <button
            disabled={cooldownRemaining > 0 || pin.length === 0}
            onClick={handleClear}
            className="h-11 sm:h-12 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:bg-slate-900 active:scale-95 disabled:opacity-20 disabled:cursor-not-allowed transition flex items-center justify-center text-[11px] font-mono text-slate-400"
          >
            Сброс
          </button>

          <button
            disabled={cooldownRemaining > 0}
            onClick={() => handleDigit('0')}
            className="h-11 sm:h-12 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 hover:bg-slate-800 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed transition flex items-center justify-center text-lg font-bold font-mono text-white shadow-sm"
          >
            0
          </button>

          <button
            disabled={cooldownRemaining > 0 || pin.length === 0}
            onClick={handleBackspace}
            className="h-11 sm:h-12 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:bg-slate-900 active:scale-95 disabled:opacity-20 disabled:cursor-not-allowed transition flex items-center justify-center text-slate-300"
          >
            <Delete className="w-4 h-4" />
          </button>
        </div>

        {/* Unlock Button */}
        <button
          disabled={cooldownRemaining > 0 || pin.length < 4}
          onClick={handleSubmitPin}
          className="mt-3.5 w-full max-w-[260px] py-2.5 sm:py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed text-slate-950 font-bold font-mono text-xs sm:text-sm shadow-md active:scale-95 transition flex items-center justify-center gap-1.5"
        >
          <Lock className="w-4 h-4" /> Разблокировать
        </button>

        {/* Security helper hint */}
        <div className="mt-3 text-[9px] text-slate-500 font-mono text-center flex items-center gap-1">
          <KeyRound className="w-3 h-3 text-slate-500" />
          Кулдаун удваивается: 5с ➔ 10с ➔ 20с...
        </div>
      </div>
    </div>
  );
};
