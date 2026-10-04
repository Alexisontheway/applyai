import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';

// ------------------------------------------------------------------ buttons

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-neon text-black font-semibold hover:bg-neon/90 border border-neon',
  secondary: 'bg-dark-700 text-white border border-white/10 hover:border-neon/40 hover:bg-dark-600',
  outline: 'bg-transparent text-white border border-white/15 hover:border-neon/50 hover:text-neon',
  ghost: 'bg-transparent text-zinc-400 hover:text-white hover:bg-white/5 border border-transparent',
  danger:
    'bg-red-500/10 text-red-300 border border-red-500/30 hover:bg-red-500/20 hover:text-red-200',
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: 'h-7 px-2.5 text-xs gap-1.5',
  md: 'h-9 px-3.5 text-sm gap-2',
  lg: 'h-11 px-5 text-sm gap-2',
  icon: 'h-8 w-8 justify-center',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  icon,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap transition-colors duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon/60 focus-visible:ring-offset-0',
        'disabled:cursor-not-allowed disabled:opacity-50',
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        className,
      )}
    >
      {loading ? <Loader2 className="animate-spin" size={size === 'sm' ? 12 : 15} /> : icon}
      {children}
    </button>
  );
}

// ------------------------------------------------------------------ surfaces

export function Panel({
  className,
  children,
  padded = true,
}: {
  className?: string;
  children: ReactNode;
  padded?: boolean;
}) {
  return (
    <div className={cn('border border-white/8 bg-dark-800/40', padded && 'p-5', className)}>
      {children}
    </div>
  );
}

export function PanelHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-start justify-between gap-4 mb-4', className)}>
      <div className="min-w-0">
        <h2 className="text-white text-sm font-semibold tracking-tight">{title}</h2>
        {subtitle ? <p className="text-zinc-500 text-xs mt-1">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn('label-micro mb-2', className)}>{children}</p>;
}

export function Divider({ className }: { className?: string }) {
  return <div className={cn('h-px bg-white/6', className)} />;
}

// ------------------------------------------------------------------ inputs

const FIELD_BASE =
  'w-full bg-dark-900/80 border border-white/10 text-white placeholder:text-zinc-600 px-3 py-2 text-sm ' +
  'transition-colors focus:border-neon/60 focus:outline-none focus:ring-1 focus:ring-neon/30 disabled:opacity-50';

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...rest} className={cn(FIELD_BASE, className)} />;
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...rest} className={cn(FIELD_BASE, 'resize-y leading-relaxed', className)} />;
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...rest} className={cn(FIELD_BASE, 'appearance-none cursor-pointer pr-8', className)}>
      {children}
    </select>
  );
}

export function Field({
  label,
  hint,
  error,
  children,
  className,
  htmlFor,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
  className?: string;
  /** id of the control this caption belongs to — enables screen readers and test queries. */
  htmlFor?: string;
}) {
  const captionClass = 'label-micro block mb-1.5';
  return (
    // A <label> may only wrap a real form control, and these fields also
    // contain hints, errors and segmented controls — so the caption is either
    // an explicitly associated <label> or a plain span.
    <div className={cn('block', className)}>
      {htmlFor ? (
        <label className={captionClass} htmlFor={htmlFor}>
          {label}
        </label>
      ) : (
        <span className={captionClass}>{label}</span>
      )}
      {children}
      {error ? <span className="block text-red-400 text-xs mt-1">{error}</span> : null}
      {hint && !error ? <span className="block text-zinc-600 text-xs mt-1">{hint}</span> : null}
    </div>
  );
}

// ------------------------------------------------------------------ badges

type BadgeTone = 'neutral' | 'neon' | 'sky' | 'violet' | 'emerald' | 'amber' | 'red' | 'zinc';

const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: 'bg-white/5 text-zinc-300 border-white/10',
  neon: 'bg-neon/10 text-neon border-neon/30',
  sky: 'bg-sky-500/10 text-sky-300 border-sky-500/30',
  violet: 'bg-violet-500/10 text-violet-300 border-violet-500/30',
  emerald: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  amber: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
  red: 'bg-red-500/10 text-red-300 border-red-500/30',
  zinc: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/30',
};

export function Badge({
  children,
  tone = 'neutral',
  className,
  title,
}: {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex items-center gap-1 border px-2 py-0.5 text-[11px] font-mono uppercase tracking-wide',
        BADGE_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Chip({
  children,
  onRemove,
  className,
  title,
}: {
  children: ReactNode;
  onRemove?: () => void;
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex items-center gap-1 border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-zinc-300',
        className,
      )}
    >
      {children}
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          className="text-zinc-500 hover:text-red-400 transition-colors"
          aria-label="Remove"
        >
          ×
        </button>
      ) : null}
    </span>
  );
}

// ------------------------------------------------------------------ feedback

export function Spinner({ className, label }: { className?: string; label?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2 text-zinc-500 text-sm', className)}>
      <Loader2 className="animate-spin" size={15} />
      {label}
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse bg-white/5', className)} />;
}

/** A stack of placeholder rows. Positional keys are fine: they never reorder. */
export function SkeletonList({ count, className }: { count: number; className?: string }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static placeholders have no identity
        <Skeleton key={index} className={className} />
      ))}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('border border-dashed border-white/10 px-6 py-14 text-center', className)}>
      {icon ? <div className="flex justify-center text-zinc-600 mb-3">{icon}</div> : null}
      <p className="text-zinc-300 text-sm font-medium">{title}</p>
      {description ? (
        <p className="text-zinc-500 text-sm mt-2 max-w-md mx-auto">{description}</p>
      ) : null}
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function Banner({
  tone = 'neutral',
  title,
  children,
  action,
  className,
}: {
  tone?: 'neutral' | 'error' | 'warning' | 'success' | 'info';
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const tones = {
    neutral: 'border-white/10 bg-white/5 text-zinc-300',
    error: 'border-red-500/30 bg-red-500/5 text-red-300',
    warning: 'border-amber-500/30 bg-amber-500/5 text-amber-200',
    success: 'border-emerald-500/30 bg-emerald-500/5 text-emerald-200',
    info: 'border-sky-500/30 bg-sky-500/5 text-sky-200',
  } as const;

  return (
    <div
      className={cn(
        'border px-4 py-3 text-sm flex items-start justify-between gap-4',
        tones[tone],
        className,
      )}
    >
      <div className="min-w-0">
        {title ? <p className="font-medium">{title}</p> : null}
        {children ? (
          <div className={cn(title && 'mt-1', 'text-[13px] leading-relaxed opacity-90')}>
            {children}
          </div>
        ) : null}
      </div>
      {action}
    </div>
  );
}

// ------------------------------------------------------------------ layout helpers

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: Array<{ value: T; label: ReactNode }>;
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div className={cn('inline-flex border border-white/10 bg-dark-900 p-0.5', className)}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            'px-3 py-1.5 text-xs font-mono uppercase tracking-wide transition-colors',
            value === option.value ? 'bg-neon text-black' : 'text-zinc-400 hover:text-white',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function StatTile({
  label,
  value,
  hint,
  icon,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('border border-white/8 bg-dark-800/40 p-4', className)}>
      <div className="flex items-center justify-between mb-2">
        <span className="label-micro">{label}</span>
        {icon ? <span className="text-zinc-600">{icon}</span> : null}
      </div>
      <p className="text-2xl font-semibold text-white leading-none tracking-tight">{value}</p>
      {hint ? <p className="text-zinc-500 text-xs mt-2">{hint}</p> : null}
    </div>
  );
}
