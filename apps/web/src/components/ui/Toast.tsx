import { cn } from '@/lib/utils';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
/**
 * Minimal toast system: `const toast = useToast(); toast.success('Saved')`.
 * Deliberately dependency-free — errors must be visible, that is the whole job.
 */
import { type ReactNode, createContext, useCallback, useContext, useMemo, useState } from 'react';

type ToastTone = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  tone: ToastTone;
  message: string;
  detail?: string;
}

interface ToastApi {
  success: (message: string, detail?: string) => void;
  error: (message: string, detail?: string) => void;
  info: (message: string, detail?: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const push = useCallback((tone: ToastTone, message: string, detail?: string) => {
    const id = nextId++;
    setItems((current) => [...current.slice(-3), { id, tone, message, detail }]);
    setTimeout(
      () => setItems((current) => current.filter((item) => item.id !== id)),
      tone === 'error' ? 8000 : 4500,
    );
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      success: (message, detail) => push('success', message, detail),
      error: (message, detail) => push('error', message, detail),
      info: (message, detail) => push('info', message, detail),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="fixed bottom-5 right-5 z-[100] flex w-80 flex-col gap-2">
        {items.map((item) => (
          <div
            key={item.id}
            className={cn(
              'border px-4 py-3 shadow-xl animate-slide-up flex items-start gap-3 bg-dark-800',
              item.tone === 'success' && 'border-emerald-500/30',
              item.tone === 'error' && 'border-red-500/40',
              item.tone === 'info' && 'border-sky-500/30',
            )}
          >
            <span
              className={cn(
                'mt-0.5 shrink-0',
                item.tone === 'success' && 'text-emerald-400',
                item.tone === 'error' && 'text-red-400',
                item.tone === 'info' && 'text-sky-400',
              )}
            >
              {item.tone === 'success' ? (
                <CheckCircle2 size={16} />
              ) : item.tone === 'error' ? (
                <AlertTriangle size={16} />
              ) : (
                <Info size={16} />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-white leading-snug">{item.message}</p>
              {item.detail ? (
                <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{item.detail}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => setItems((current) => current.filter((entry) => entry.id !== item.id))}
              className="text-zinc-500 hover:text-white transition-colors shrink-0"
              aria-label="Dismiss"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside <ToastProvider>');
  return context;
}
