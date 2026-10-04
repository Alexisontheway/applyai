import { StatusPill } from '@/components/indicators';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import {
  Badge,
  Banner,
  Button,
  Field,
  Input,
  Segmented,
  Select,
  Textarea,
} from '@/components/ui/primitives';
import { STATUS_META } from '@/lib/format';
import { useImportJobUrl, useResumes, useTrackJob } from '@/lib/queries';
import { cn } from '@/lib/utils';
import { APPLICATION_STATUSES, type ApplicationStatusValue } from '@applyai/shared/schemas';
import type { ImportedJobDraft } from '@applyai/shared/types';
import { useNavigate } from '@tanstack/react-router';
import { Link2, Pencil, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';

type Mode = 'link' | 'manual';

const EMPTY_MANUAL = {
  title: '',
  company: '',
  location: '',
  url: '',
  description: '',
  salaryMin: '',
  salaryMax: '',
};

export function NewApplicationDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const navigate = useNavigate();
  const { data: resumes } = useResumes();
  const importUrl = useImportJobUrl();
  const trackJob = useTrackJob();

  const [mode, setMode] = useState<Mode>('link');
  const [url, setUrl] = useState('');
  const [draft, setDraft] = useState<ImportedJobDraft | null>(null);
  const [draftNotice, setDraftNotice] = useState<string | null>(null);
  const [manual, setManual] = useState(EMPTY_MANUAL);
  const [status, setStatus] = useState<ApplicationStatusValue>('saved');
  const [resumeId, setResumeId] = useState<string | 'auto' | 'none'>('auto');
  const [score, setScore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setUrl('');
      setDraft(null);
      setDraftNotice(null);
      setManual(EMPTY_MANUAL);
      setStatus('saved');
      setError(null);
      setScore(true);
      setMode('link');
    }
  }, [open]);

  const activeResume = resumes?.find((resume) => resume.isActive);
  const scoredResume =
    resumeId === 'auto'
      ? activeResume
      : resumeId === 'none'
        ? null
        : resumes?.find((r) => r.id === resumeId);

  const handleImport = async () => {
    setError(null);
    setDraftNotice(null);
    try {
      const result = await importUrl.mutateAsync(url.trim());
      setDraft(result.draft);
      if (result.alreadyTracked)
        setDraftNotice('You are already tracking this job — saving again will just reopen it.');
      else if (result.alreadySaved) setDraftNotice('This job is already saved in your list.');
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : 'Could not read that page');
    }
  };

  const handleTrack = async () => {
    setError(null);
    const payload =
      mode === 'link' && draft
        ? {
            title: draft.title,
            company: draft.company,
            location: draft.location,
            url: draft.url,
            source: draft.source,
            description: draft.description,
            techStack: draft.techStack.length > 0 ? draft.techStack : null,
            salaryMin: draft.salaryMin,
            salaryMax: draft.salaryMax,
          }
        : {
            title: manual.title.trim(),
            company: manual.company.trim(),
            location: manual.location.trim() || null,
            url: manual.url.trim() || null,
            source: 'manual' as const,
            description: manual.description.trim() || null,
            salaryMin: manual.salaryMin ? Number(manual.salaryMin) : null,
            salaryMax: manual.salaryMax ? Number(manual.salaryMax) : null,
          };

    if (!payload.title || !payload.company) {
      setError('A job needs at least a title and a company.');
      return;
    }

    try {
      const result = await trackJob.mutateAsync({
        ...payload,
        status,
        resumeId: resumeId === 'auto' ? null : resumeId === 'none' ? null : resumeId,
        score: score && Boolean(scoredResume),
      });

      const match = result.match;
      toast.success(
        result.created ? `Tracking ${payload.title}` : `Already tracking ${payload.title}`,
        match
          ? `Match score ${Math.round(match.score)}% against ${scoredResume?.label ?? 'your resume'}.`
          : undefined,
      );
      onClose();
      await navigate({ to: '/pipeline' });
    } catch (trackError) {
      setError(
        trackError instanceof Error ? trackError.message : 'Could not save this application',
      );
    }
  };

  const canSubmit =
    mode === 'link' ? Boolean(draft) : Boolean(manual.title.trim() && manual.company.trim());

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New application"
      description="Paste the posting link and let ApplyAI read it, or type the details yourself."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleTrack}
            disabled={!canSubmit}
            loading={trackJob.isPending}
          >
            {status === 'saved' ? 'Save to pipeline' : `Add as ${STATUS_META[status].label}`}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <Segmented
          value={mode}
          onChange={(value) => {
            setMode(value);
            setError(null);
          }}
          options={[
            {
              value: 'link',
              label: (
                <span className="inline-flex items-center gap-1.5">
                  <Link2 size={12} /> From a link
                </span>
              ),
            },
            {
              value: 'manual',
              label: (
                <span className="inline-flex items-center gap-1.5">
                  <Pencil size={12} /> Manually
                </span>
              ),
            },
          ]}
        />

        {mode === 'link' ? (
          <div className="space-y-4">
            <Field
              label="Job posting URL"
              hint="Works with Greenhouse, Lever, Ashby, Workday and most company career pages."
            >
              <div className="flex gap-2">
                <Input
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  placeholder="https://boards.greenhouse.io/acme/jobs/12345"
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && url.trim()) void handleImport();
                  }}
                />
                <Button onClick={handleImport} loading={importUrl.isPending} disabled={!url.trim()}>
                  Fetch
                </Button>
              </div>
            </Field>

            {draftNotice ? <Banner tone="info">{draftNotice}</Banner> : null}

            {draft ? (
              <div className="space-y-4 border border-white/10 bg-dark-900/60 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="label-micro">Extracted from the page</p>
                  <Badge tone="neon">Editable</Badge>
                </div>
                {draft.warnings.length > 0 ? (
                  <ul className="space-y-1 text-xs text-amber-200/90">
                    {draft.warnings.map((warning) => (
                      <li key={warning}>• {warning}</li>
                    ))}
                  </ul>
                ) : null}
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Job title">
                    <Input
                      value={draft.title}
                      onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                    />
                  </Field>
                  <Field label="Company">
                    <Input
                      value={draft.company}
                      onChange={(event) => setDraft({ ...draft, company: event.target.value })}
                    />
                  </Field>
                </div>
                <Field label="Location">
                  <Input
                    value={draft.location ?? ''}
                    onChange={(event) =>
                      setDraft({ ...draft, location: event.target.value || null })
                    }
                    placeholder="Remote / city"
                  />
                </Field>
                {draft.techStack.length > 0 ? (
                  <div>
                    <p className="label-micro mb-1.5">Detected skills</p>
                    <div className="flex flex-wrap gap-1">
                      {draft.techStack.slice(0, 14).map((skill) => (
                        <span
                          key={skill}
                          className="border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-zinc-300"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
                <Field label="Description" hint="Used for the match score and cover letters.">
                  <Textarea
                    rows={6}
                    value={draft.description ?? ''}
                    onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                  />
                </Field>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Job title">
                <Input
                  value={manual.title}
                  onChange={(event) => setManual({ ...manual, title: event.target.value })}
                  placeholder="Senior Frontend Engineer"
                />
              </Field>
              <Field label="Company">
                <Input
                  value={manual.company}
                  onChange={(event) => setManual({ ...manual, company: event.target.value })}
                  placeholder="Acme"
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Location">
                <Input
                  value={manual.location}
                  onChange={(event) => setManual({ ...manual, location: event.target.value })}
                  placeholder="Remote / Bengaluru"
                />
              </Field>
              <Field label="Posting URL" hint="Optional, but enables deduplication.">
                <Input
                  value={manual.url}
                  onChange={(event) => setManual({ ...manual, url: event.target.value })}
                  placeholder="https://…"
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Salary min">
                <Input
                  type="number"
                  value={manual.salaryMin}
                  onChange={(event) => setManual({ ...manual, salaryMin: event.target.value })}
                  placeholder="2000000"
                />
              </Field>
              <Field label="Salary max">
                <Input
                  type="number"
                  value={manual.salaryMax}
                  onChange={(event) => setManual({ ...manual, salaryMax: event.target.value })}
                  placeholder="3000000"
                />
              </Field>
            </div>
            <Field
              label="Job description"
              hint="Paste the posting text — matching and cover letters need it."
            >
              <Textarea
                rows={7}
                value={manual.description}
                onChange={(event) => setManual({ ...manual, description: event.target.value })}
                placeholder="Requirements&#10;- 3+ years with TypeScript…"
              />
            </Field>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 border-t border-white/8 pt-4">
          <Field label="Status">
            <Select
              value={status}
              onChange={(event) => setStatus(event.target.value as ApplicationStatusValue)}
            >
              {APPLICATION_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {STATUS_META[value].label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Score against">
            <Select
              value={resumeId}
              onChange={(event) => setResumeId(event.target.value as typeof resumeId)}
            >
              <option value="auto">
                {activeResume
                  ? `Active resume — ${activeResume.label}`
                  : 'Active resume (none set)'}
              </option>
              {(resumes ?? [])
                .filter((resume) => !resume.isActive)
                .map((resume) => (
                  <option key={resume.id} value={resume.id}>
                    {resume.label}
                  </option>
                ))}
              <option value="none">Do not score</option>
            </Select>
          </Field>
        </div>

        <div className="flex items-center justify-between gap-4">
          <label className="flex items-center gap-2 text-sm text-zinc-400 cursor-pointer">
            <input
              type="checkbox"
              checked={score}
              onChange={(event) => setScore(event.target.checked)}
              className="accent-neon"
            />
            <span className="inline-flex items-center gap-1.5">
              <Sparkles size={13} className="text-neon" />
              Run the match engine on save
            </span>
          </label>
          {scoredResume ? <StatusPill status="saved" className="opacity-0" /> : null}
        </div>

        {error ? <Banner tone="error">{error}</Banner> : null}

        {!activeResume && resumes && resumes.length === 0 ? (
          <Banner tone="warning" title="No resume yet">
            Add a resume in the Resumes tab and every new application gets an automatic match score.
          </Banner>
        ) : null}
        <div className={cn('hidden', 'sr-only')}>{scoredResume?.label}</div>
      </div>
    </Modal>
  );
}
