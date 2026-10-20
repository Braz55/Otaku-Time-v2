import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { CheckCircle, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
  count: number;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

// Mensagens de sucesso são só confirmação: desaparecem mais depressa que os erros
const TOAST_DURATION_MS: Record<ToastType, number> = {
  success: 2200,
  info: 3000,
  warning: 4000,
  error: 4500,
};
const MAX_VISIBLE_TOASTS = 2;

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const removeToast = useCallback((id: string) => {
    clearTimeout(timersRef.current[id]);
    delete timersRef.current[id];
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    // A mesma mensagem repetida (ex: vários cliques seguidos) reaproveita o toast em vez de empilhar
    const id = `${type}:${message}`;
    setToasts((prev) => {
      const existing = prev.find((t) => t.id === id);
      if (existing) {
        return prev.map((t) => (t.id === id ? { ...t, count: t.count + 1 } : t));
      }
      const next = [...prev, { id, message, type, count: 1 }];
      return next.slice(-MAX_VISIBLE_TOASTS);
    });

    clearTimeout(timersRef.current[id]);
    timersRef.current[id] = setTimeout(() => removeToast(id), TOAST_DURATION_MS[type]);
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Toast Container: no telemóvel fica centrado por cima da barra de navegação */}
      <div className="fixed left-1/2 -translate-x-1/2 bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] md:left-auto md:translate-x-0 md:right-5 md:bottom-5 z-[9999] flex flex-col items-center md:items-end gap-2 w-[calc(100%-2rem)] md:w-auto md:max-w-sm pointer-events-none">
        {toasts.map((toast) => {
          const typeClasses = {
            success: 'border-emerald-500/20 bg-emerald-950/85 text-emerald-200',
            error: 'border-rose-500/25 bg-rose-950/90 text-rose-200',
            warning: 'border-amber-500/25 bg-amber-950/90 text-amber-200',
            info: 'border-white/10 bg-surface-container/90 text-on-surface',
          }[toast.type];

          const Icon = {
            success: CheckCircle,
            error: AlertCircle,
            warning: AlertTriangle,
            info: Info,
          }[toast.type];

          return (
            <div
              key={toast.id}
              role={toast.type === 'error' ? 'alert' : 'status'}
              onClick={() => removeToast(toast.id)}
              className={`pointer-events-auto cursor-pointer flex items-center gap-2 max-w-full pl-3 pr-2 py-1.5 md:py-2 rounded-full border backdrop-blur-xl shadow-lg animate-in slide-in-from-bottom-2 fade-in duration-200 ${typeClasses}`}
            >
              <Icon className="w-4 h-4 flex-shrink-0 text-current" />
              <span className="text-xs md:text-sm font-semibold leading-snug line-clamp-2">{toast.message}</span>
              {toast.count > 1 && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-white/10 flex-shrink-0">×{toast.count}</span>
              )}
              <X className="hidden md:block w-3.5 h-3.5 flex-shrink-0 opacity-50" />
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
