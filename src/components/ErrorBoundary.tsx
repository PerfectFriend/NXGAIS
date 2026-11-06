import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Terminal, ShieldAlert } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('NeXXus Runtime Crash Caught:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReset = () => {
    try {
      localStorage.removeItem('nexxus_is_onboarded');
      localStorage.removeItem('nexxus_pin_cooldown_until');
      localStorage.removeItem('nexxus_pin_failed_attempts');
    } catch (e) {
      console.error(e);
    }
    window.location.reload();
  };

  private handleSoftReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-50 bg-[#090d16] text-slate-100 flex items-center justify-center p-4 select-none font-sans overflow-y-auto">
          <div className="max-w-md w-full bg-slate-900 border border-red-500/40 rounded-2xl p-6 shadow-2xl relative">
            <div className="w-14 h-14 rounded-2xl bg-red-950/80 border border-red-500/50 flex items-center justify-center text-red-400 mb-4 mx-auto">
              <ShieldAlert className="w-8 h-8" />
            </div>

            <h2 className="text-xl font-black text-center text-white font-mono">
              Сбой Runtime Анклава
            </h2>
            <p className="text-xs text-slate-400 text-center mt-1.5 leading-relaxed">
              Обнаружена системная ошибка рендеринга. Ваши локальные криптографические ключи защищены.
            </p>

            <div className="my-4 p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[11px] text-red-300 overflow-x-auto max-h-36">
              <div className="flex items-center gap-1.5 text-slate-500 mb-1">
                <Terminal className="w-3.5 h-3.5" /> Стек исключения:
              </div>
              <div className="text-red-400 break-words">{this.state.error?.message || 'Неизвестная ошибка'}</div>
            </div>

            <div className="space-y-2.5">
              <button
                onClick={this.handleSoftReload}
                className="w-full py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
              >
                <RefreshCw className="w-4 h-4" /> Перезагрузить сессию
              </button>

              <button
                onClick={this.handleReset}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-red-950/50 hover:text-red-300 text-slate-400 font-medium text-xs transition flex items-center justify-center gap-1.5"
              >
                <AlertTriangle className="w-3.5 h-3.5" /> Сбросить локальный кэш и войти заново
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
