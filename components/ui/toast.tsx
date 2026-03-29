"use client";
import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

type ToastVariant = 'default' | 'success' | 'destructive' | 'warning' | 'info';
type ToastInput = { title?: string; description?: string; variant?: ToastVariant; duration?: number };
type ToastItem = ToastInput & { id: number };

type ToastContextValue = {
  toast: (t: ToastInput) => void;
};

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(1);
  const remove = useCallback((id: number) => setToasts((prev) => prev.filter((t) => t.id !== id)), []);
  const add = useCallback((t: ToastInput) => {
    const id = idRef.current++;
    const item: ToastItem = { id, ...t };
    setToasts((prev) => [...prev, item]);
    const dur = t.duration ?? 3000;
    window.setTimeout(() => remove(id), dur);
  }, [remove]);
  const value = useMemo(() => ({ toast: add }), [add]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <Toaster toasts={toasts} onDismiss={remove} />
    </ToastContext.Provider>
  );
};

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

export const Toaster: React.FC<{ toasts: ToastItem[]; onDismiss: (id: number) => void }> = ({ toasts, onDismiss }) => {
  return (
    <div className="fixed bottom-3 right-3 z-50 space-y-2 w-[320px] max-w-[calc(100vw-24px)]">
      {toasts.map((t) => {
        const color = t.variant === 'destructive' ? 'bg-red-600 text-white'
          : t.variant === 'success' ? 'bg-green-600 text-white'
            : t.variant === 'warning' ? 'bg-amber-500 text-black'
              : t.variant === 'info' ? 'bg-primary text-white'
                : 'bg-foreground text-background';
        return (
          <div key={t.id} className={`rounded-xl shadow px-3 py-2 ${color}`}>
            {t.title && <div className="text-sm font-semibold">{t.title}</div>}
            {t.description && <div className="text-xs opacity-90">{t.description}</div>}
            <button className="absolute right-2 top-2 text-xs opacity-80 hover:opacity-100" onClick={() => onDismiss(t.id)}>×</button>
          </div>
        );
      })}
    </div>
  );
};
