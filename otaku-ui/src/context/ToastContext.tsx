import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);

    // Auto-remove after 4 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Toast Container */}
      <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-3 max-w-sm w-full pointer-events-none px-4 sm:px-0">
        {toasts.map((toast) => {
          const typeClasses = {
            success: 'border-emerald-500/30 bg-emerald-950/90 text-emerald-200 shadow-[0_0_20px_rgba(16,185,129,0.2)]',
            error: 'border-rose-500/30 bg-rose-950/90 text-rose-200 shadow-[0_0_20px_rgba(244,63,94,0.2)]',
            warning: 'border-amber-500/30 bg-amber-950/90 text-amber-200 shadow-[0_0_20px_rgba(245,158,11,0.2)]',
            info: 'border-secondary/30 bg-secondary/90 text-secondary shadow-[0_0_20px_rgba(194,24,91,0.2)]',
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
              className={`pointer-events-auto flex items-start gap-3 p-4 rounded-2xl border backdrop-blur-xl transition-all duration-300 animate-in slide-in-from-bottom-5 fade-in ${typeClasses}`}
            >
              <Icon className="w-5 h-5 flex-shrink-0 mt-0.5 text-current" />
              <div className="flex-1 text-sm font-bold leading-snug">{toast.message}</div>
              <button
                onClick={() => removeToast(toast.id)}
                className="text-current opacity-60 hover:opacity-100 transition-opacity p-0.5 rounded-lg hover:bg-white/5 flex-shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
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
