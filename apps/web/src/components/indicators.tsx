import { SOURCE_LABELS, STATUS_META, scoreBg, scoreColor } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { ApplicationStatus, JobSource, MatchResult } from '@applyai/shared/types';
import type { ReactNode } from 'react';

export function StatusPill({
  status,
  className,
  withDot = true,
}: {
  status: ApplicationStatus;
  className?: string;
  withDot?: boolean;
}) {
  const meta = STATUS_META[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 border px-2 py-0.5 text-[11px] font-mono uppercase tracking-wide',
        meta.text,
        meta.bg,
        meta.border,
        className,
      )}
    >
      {withDot ? <span className={cn('h-1.5 w-1.5', meta.dot)} /> : null}
      {meta.label}
    </span>
  );
}

export function SourceBadge({ source, className }: { source: JobSource; className?: string }) {
  return (
    <span className={cn('text-[11px] font-mono uppercase tracking-wide text-zinc-500', className)}>
      {SOURCE_LABELS[source] ?? source}
    </span>
  );
}

export function ScoreBadge({
  score,
  className,
}: { score: number | null | undefined; className?: string }) {
  if (score === null || score === undefined) {
    return <span className={cn('text-[11px] font-mono text-zinc-600', className)}>—</span>;
  }
  return (
    <span className={cn('font-mono text-xs font-semibold', scoreColor(score), className)}>
      {Math.round(score)}%
    </span>
  );
}

export function ScoreBar({
  score,
  className,
  showLabel = true,
}: {
  score: number | null | undefined;
  className?: string;
  showLabel?: boolean;
}) {
  const value = score ?? 0;
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="h-1.5 flex-1 bg-white/8 overflow-hidden">
        <div
          className={cn('h-full transition-all duration-500', scoreBg(score))}
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
      {showLabel ? <ScoreBadge score={score} className="w-9 text-right" /> : null}
    </div>
  );
}

export function Avatar({ label, className }: { label: string; className?: string }) {
  const initials = label
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
  return (
    <span
      className={cn(
        'inline-flex h-8 w-8 shrink-0 items-center justify-center border border-white/10 bg-white/5 text-[11px] font-semibold text-zinc-300',
        className,
      )}
    >
      {initials || '?'}
    </span>
  );
}

export function SkillChip({
  label,
  tone = 'neutral',
  count,
  title,
}: {
  label: string;
  tone?: 'matched' | 'missing' | 'neutral';
  count?: number;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex items-center gap-1 border px-2 py-0.5 text-xs',
        tone === 'matched' && 'border-neon/25 bg-neon/8 text-neon-dim',
        tone === 'missing' && 'border-red-500/25 bg-red-500/5 text-red-300',
        tone === 'neutral' && 'border-white/10 bg-white/5 text-zinc-300',
      )}
    >
      {label}
      {count && count > 1 ? <span className="text-[10px] opacity-70">×{count}</span> : null}
    </span>
  );
}

export function Metric({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: string;
}) {
  return (
    <div>
      <p className="label-micro">{label}</p>
      <p className={cn('text-2xl font-semibold tracking-tight mt-1', tone ?? 'text-white')}>
        {value}
      </p>
      {hint ? <p className="text-xs text-zinc-500 mt-1">{hint}</p> : null}
    </div>
  );
}

/** Compact score breakdown used in the drawer and the scout list. */
export function MatchBreakdownBars({ match }: { match: MatchResult }) {
  const rows: Array<{ label: string; value: number | null }> = [
    { label: 'Skill coverage', value: match.breakdown.skillCoverage },
    { label: 'Keyword overlap', value: match.breakdown.keywordRelevance },
    { label: 'Semantic', value: match.breakdown.semanticSimilarity },
  ];

  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <div key={row.label} className="flex items-center gap-3">
          <span className="w-32 shrink-0 text-[11px] font-mono uppercase tracking-wide text-zinc-500">
            {row.label}
          </span>
          <div className="h-1.5 flex-1 bg-white/8 overflow-hidden">
            <div
              className={cn('h-full', scoreBg((row.value ?? 0) * 100))}
              style={{ width: `${Math.round((row.value ?? 0) * 100)}%` }}
            />
          </div>
          <span className="w-10 text-right text-xs font-mono text-zinc-400">
            {row.value === null ? 'off' : `${Math.round(row.value * 100)}%`}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Renders **bold** segments from engine-generated suggestion text. */
export function RichText({ text, className }: { text: string; className?: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <span className={className}>
      {parts.map((part, index) =>
        part.startsWith('**') && part.endsWith('**') ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: segments are positional slices of one string
          <strong key={index} className="text-white font-semibold">
            {part.slice(2, -2)}
          </strong>
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: segments are positional slices of one string
          <span key={index}>{part}</span>
        ),
      )}
    </span>
  );
}
