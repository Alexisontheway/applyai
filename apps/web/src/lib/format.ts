import type { ApplicationStatus, JobSource } from '@applyai/shared/schemas';

export const STATUS_META: Record<
  ApplicationStatus,
  { label: string; text: string; bg: string; border: string; dot: string; bar: string }
> = {
  saved: {
    label: 'Saved',
    text: 'text-slate-300',
    bg: 'bg-slate-500/10',
    border: 'border-slate-500/30',
    dot: 'bg-slate-400',
    bar: 'bg-slate-400/70',
  },
  applied: {
    label: 'Applied',
    text: 'text-sky-300',
    bg: 'bg-sky-500/10',
    border: 'border-sky-500/30',
    dot: 'bg-sky-400',
    bar: 'bg-sky-400/70',
  },
  screening: {
    label: 'Screening',
    text: 'text-violet-300',
    bg: 'bg-violet-500/10',
    border: 'border-violet-500/30',
    dot: 'bg-violet-400',
    bar: 'bg-violet-400/70',
  },
  interview: {
    label: 'Interview',
    text: 'text-neon',
    bg: 'bg-neon/10',
    border: 'border-neon/30',
    dot: 'bg-neon',
    bar: 'bg-neon/80',
  },
  offer: {
    label: 'Offer',
    text: 'text-emerald-300',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    dot: 'bg-emerald-400',
    bar: 'bg-emerald-400/80',
  },
  rejected: {
    label: 'Rejected',
    text: 'text-red-300',
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    dot: 'bg-red-400',
    bar: 'bg-red-400/60',
  },
  ghosted: {
    label: 'Ghosted',
    text: 'text-zinc-400',
    bg: 'bg-zinc-500/10',
    border: 'border-zinc-500/30',
    dot: 'bg-zinc-500',
    bar: 'bg-zinc-500/60',
  },
};

export const SOURCE_LABELS: Record<JobSource, string> = {
  manual: 'Manual',
  import: 'Imported',
  greenhouse: 'Greenhouse',
  lever: 'Lever',
  ashby: 'Ashby',
  remotive: 'Remotive',
  remoteok: 'RemoteOK',
  arbeitnow: 'Arbeitnow',
  linkedin: 'LinkedIn',
  indeed: 'Indeed',
  naukri: 'Naukri',
  wellfound: 'Wellfound',
  other: 'Other',
};

export function scoreColor(score: number | null | undefined): string {
  if (score === null || score === undefined) return 'text-zinc-500';
  if (score >= 80) return 'text-neon';
  if (score >= 65) return 'text-emerald-400';
  if (score >= 45) return 'text-amber-400';
  return 'text-red-400';
}

export function scoreBg(score: number | null | undefined): string {
  if (score === null || score === undefined) return 'bg-zinc-700';
  if (score >= 80) return 'bg-neon';
  if (score >= 65) return 'bg-emerald-400';
  if (score >= 45) return 'bg-amber-400';
  return 'bg-red-400';
}

export function formatRelative(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.round(months / 12)}y ago`;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  return new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatSalary(
  min: number | null,
  max: number | null,
  currency = 'USD',
): string | null {
  if (min === null && max === null) return null;
  const symbols: Record<string, string> = { USD: '$', EUR: '€', GBP: '£', INR: '₹', JPY: '¥' };
  const symbol = symbols[currency] ?? '';
  const compact = (value: number) =>
    value >= 1_000_000
      ? `${(value / 1_000_000).toFixed(1)}M`
      : value >= 1_000
        ? `${Math.round(value / 1_000)}k`
        : String(value);
  if (min !== null && max !== null) return `${symbol}${compact(min)} – ${symbol}${compact(max)}`;
  return `${symbol}${compact((min ?? max) as number)}`;
}

export function percent(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined) return '—';
  return `${value.toFixed(digits)}%`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

/** Stable colour per company/role string, used for avatars. */
export function avatarTone(value: string): string {
  const palette = [
    'bg-neon/15 text-neon border-neon/30',
    'bg-sky-500/15 text-sky-300 border-sky-500/30',
    'bg-violet-500/15 text-violet-300 border-violet-500/30',
    'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    'bg-amber-500/15 text-amber-300 border-amber-500/30',
    'bg-rose-500/15 text-rose-300 border-rose-500/30',
  ];
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) % 997;
  }
  return palette[hash % palette.length];
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}
