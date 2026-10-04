import { MatchPanel } from '@/components/MatchPanel';
import { StatusPill } from '@/components/indicators';
import { useToast } from '@/components/ui/Toast';
import {
  Badge,
  Banner,
  Button,
  Divider,
  Field,
  SectionLabel,
  Segmented,
  Select,
  Textarea,
} from '@/components/ui/primitives';
import { SOURCE_LABELS, STATUS_META, formatDateTime, formatRelative } from '@/lib/format';
import {
  useApplication,
  useCoverLetters,
  useDeleteApplication,
  useDeleteCoverLetter,
  useGenerateCoverLetter,
  useResumes,
  useScoreApplication,
  useUpdateApplication,
  useUpdateCoverLetter,
} from '@/lib/queries';
import { cn } from '@/lib/utils';
import {
  APPLICATION_STATUSES,
  type ApplicationStatusValue,
  COVER_LETTER_TONES,
} from '@applyai/shared/schemas';
import { CalendarClock, Copy, ExternalLink, FileText, Sparkles, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

export function ApplicationDrawer({
  applicationId,
  onClose,
}: {
  applicationId: string | null;
  onClose: () => void;
}) {
  const toast = useToast();
  const detail = useApplication(applicationId);
  const letters = useCoverLetters(applicationId ?? undefined);
  const { data: resumes } = useResumes();
  const updateApplication = useUpdateApplication();
  const deleteApplication = useDeleteApplication();
  const scoreApplication = useScoreApplication();
  const generateLetter = useGenerateCoverLetter();
  const updateLetter = useUpdateCoverLetter();
  const deleteLetter = useDeleteCoverLetter();

  const application = detail.data ?? null;
  const [notes, setNotes] = useState('');
  const [followUp, setFollowUp] = useState('');
  const [tone, setTone] = useState<(typeof COVER_LETTER_TONES)[number]>('professional');
  const [instructions, setInstructions] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [openLetterId, setOpenLetterId] = useState<string | null>(null);
  const [letterDraft, setLetterDraft] = useState('');

  const loadedId = application?.id;
  const loadedNotes = application?.notes ?? '';
  const loadedFollowUp = application?.followUpDate ?? '';
  useEffect(() => {
    if (!loadedId) return;
    setNotes(loadedNotes);
    setFollowUp(loadedFollowUp);
    setConfirmDelete(false);
  }, [loadedId, loadedNotes, loadedFollowUp]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    if (applicationId) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [applicationId, onClose]);

  const notesDirty = application ? notes !== (application.notes ?? '') : false;
  const followUpDirty = application ? followUp !== (application.followUpDate ?? '') : false;
  const activeResume = resumes?.find((resume) => resume.isActive);

  const sortedEvents = useMemo(
    () => [...(application?.events ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [application?.events],
  );

  if (!applicationId) return null;

  const handleStatus = (status: ApplicationStatusValue) => {
    if (!application || application.status === status) return;
    updateApplication.mutate(
      { id: application.id, patch: { status } },
      {
        onSuccess: () => toast.success(`Moved to ${STATUS_META[status].label}`),
        onError: (error) => toast.error('Could not update status', error.message),
      },
    );
  };

  const handleSaveNotes = () => {
    if (!application) return;
    updateApplication.mutate(
      { id: application.id, patch: { notes: notes || null } },
      {
        onSuccess: () => toast.success('Notes saved'),
        onError: (error) => toast.error('Could not save notes', error.message),
      },
    );
  };

  const handleSaveFollowUp = () => {
    if (!application) return;
    updateApplication.mutate(
      { id: application.id, patch: { followUpDate: followUp || null } },
      {
        onSuccess: () => toast.success(followUp ? 'Follow-up reminder set' : 'Follow-up cleared'),
        onError: (error) => toast.error('Could not save the reminder', error.message),
      },
    );
  };

  const handleResumeChange = (resumeId: string) => {
    if (!application) return;
    updateApplication.mutate(
      { id: application.id, patch: { resumeId: resumeId === 'none' ? null : resumeId } },
      { onSuccess: () => toast.info('Resume updated — re-run the match to refresh the score') },
    );
  };

  const handleScore = (resumeId: string | null) => {
    if (!application) return;
    scoreApplication.mutate(
      { id: application.id, resumeId },
      {
        onSuccess: (match) => toast.success(`Match score: ${Math.round(match.score)}%`),
        onError: (error) => toast.error('Could not score this application', error.message),
      },
    );
  };

  const handleGenerateLetter = () => {
    if (!application) return;
    generateLetter.mutate(
      { applicationId: application.id, tone, instructions: instructions || null },
      {
        onSuccess: (letter) => {
          setOpenLetterId(letter.id);
          setLetterDraft(letter.body);
          toast.success(
            letter.engine.startsWith('ollama')
              ? 'Cover letter drafted by your local model'
              : 'Cover letter drafted',
            letter.warnings?.[0],
          );
        },
        onError: (error) => toast.error('Could not generate a cover letter', error.message),
      },
    );
  };

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied to clipboard');
    } catch {
      toast.error('Clipboard unavailable in this browser');
    }
  };

  const handleDelete = () => {
    if (!application) return;
    deleteApplication.mutate(application.id, {
      onSuccess: () => {
        toast.success('Application deleted');
        onClose();
      },
      onError: (error) => toast.error('Could not delete', error.message),
    });
  };

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <button
        type="button"
        aria-label="Close panel"
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px] animate-fade-in cursor-default"
      />
      <aside className="relative flex h-full w-full max-w-2xl flex-col border-l border-white/10 bg-dark-900 animate-slide-up">
        {/* header */}
        <header className="flex items-start justify-between gap-4 border-b border-white/8 px-6 py-5">
          <div className="min-w-0">
            {detail.isLoading ? (
              <div className="h-5 w-48 animate-pulse bg-white/5" />
            ) : (
              <>
                <div className="flex items-center gap-2 flex-wrap">
                  <StatusPill status={application?.status ?? 'saved'} />
                  <span className="text-[11px] font-mono uppercase tracking-wide text-zinc-500">
                    {application ? SOURCE_LABELS[application.job?.source ?? 'manual'] : ''}
                  </span>
                  {application?.daysInStage !== undefined ? (
                    <span className="text-[11px] text-zinc-600">
                      {application.daysInStage}d in stage
                    </span>
                  ) : null}
                </div>
                <h2 className="mt-2 truncate text-lg font-semibold tracking-tight text-white">
                  {application?.job?.title ?? 'Application'}
                </h2>
                <p className="text-sm text-zinc-400">{application?.job?.company}</p>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            {application?.job?.url ? (
              <a
                href={application.job.url}
                target="_blank"
                rel="noreferrer noopener"
                className="text-zinc-500 transition-colors hover:text-neon"
                title="Open the original posting"
              >
                <ExternalLink size={16} />
              </a>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="text-zinc-500 transition-colors hover:text-white"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        {detail.isError ? (
          <div className="p-6">
            <Banner tone="error">Could not load this application. It may have been deleted.</Banner>
          </div>
        ) : (
          <div className="flex-1 space-y-7 overflow-y-auto px-6 py-6">
            {/* status */}
            <section>
              <SectionLabel>Stage</SectionLabel>
              <div className="flex flex-wrap gap-1.5">
                {APPLICATION_STATUSES.map((status) => {
                  const meta = STATUS_META[status];
                  const isActive = application?.status === status;
                  return (
                    <button
                      key={status}
                      type="button"
                      onClick={() => handleStatus(status)}
                      className={cn(
                        'border px-2.5 py-1 text-xs font-mono uppercase tracking-wide transition-colors',
                        isActive
                          ? cn(meta.text, meta.bg, meta.border)
                          : 'border-white/8 text-zinc-500 hover:border-white/20 hover:text-white',
                      )}
                    >
                      {meta.label}
                    </button>
                  );
                })}
              </div>
            </section>

            {/* meta */}
            <section className="grid grid-cols-2 gap-4">
              <Field label="Resume used">
                <Select
                  value={application?.resumeId ?? 'none'}
                  onChange={(event) => handleResumeChange(event.target.value)}
                >
                  <option value="none">Not specified</option>
                  {(resumes ?? []).map((resume) => (
                    <option key={resume.id} value={resume.id}>
                      {resume.label}
                      {resume.isActive ? ' (active)' : ''}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field
                label="Follow-up date"
                hint={followUp ? undefined : 'Set a reminder to chase this one.'}
              >
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={followUp}
                    onChange={(event) => setFollowUp(event.target.value)}
                    className="w-full border border-white/10 bg-dark-900/80 px-3 py-2 text-sm text-white focus:border-neon/60 focus:outline-none"
                  />
                  <Button
                    size="sm"
                    onClick={handleSaveFollowUp}
                    disabled={!followUpDirty}
                    icon={<CalendarClock size={13} />}
                  >
                    Set
                  </Button>
                </div>
              </Field>
            </section>

            <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-zinc-500">
              <span>Added {formatDateTime(application?.createdAt)}</span>
              <span>Updated {formatRelative(application?.updatedAt)}</span>
              {application?.job?.location ? <span>{application.job.location}</span> : null}
            </div>

            <Divider />

            {/* match */}
            <section>
              <SectionLabel className="mb-3">Match analysis</SectionLabel>
              <MatchPanel
                match={application?.match ?? null}
                resumes={resumes ?? []}
                applicationResumeId={application?.resumeId ?? null}
                isScoring={scoreApplication.isPending}
                onScore={handleScore}
              />
            </section>

            <Divider />

            {/* notes */}
            <section>
              <SectionLabel>Notes</SectionLabel>
              <Textarea
                rows={5}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Recruiter name, interview feedback, salary numbers, next steps…"
              />
              <div className="mt-2 flex items-center justify-between">
                <span className="text-[11px] text-zinc-600">
                  {notesDirty ? 'Unsaved changes' : notes ? 'Saved' : 'Nothing recorded yet'}
                </span>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={handleSaveNotes}
                  disabled={!notesDirty}
                  loading={updateApplication.isPending}
                >
                  Save notes
                </Button>
              </div>
            </section>

            <Divider />

            {/* cover letters */}
            <section>
              <div className="flex items-center justify-between">
                <SectionLabel className="mb-0">Cover letters</SectionLabel>
                <Badge tone="neutral">{letters.data?.length ?? 0}</Badge>
              </div>

              <div className="mt-3 flex flex-wrap items-end gap-2">
                <Select
                  className="h-9 w-40 py-0 text-xs"
                  value={tone}
                  onChange={(event) => setTone(event.target.value as typeof tone)}
                >
                  {COVER_LETTER_TONES.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </Select>
                <Button
                  variant="primary"
                  size="md"
                  icon={<Sparkles size={14} />}
                  loading={generateLetter.isPending}
                  onClick={handleGenerateLetter}
                  className="flex-1 min-w-40"
                >
                  Generate tailored letter
                </Button>
              </div>
              <Textarea
                className="mt-2"
                rows={2}
                value={instructions}
                onChange={(event) => setInstructions(event.target.value)}
                placeholder="Optional: anything specific to mention (referral, relocation, notice period…)"
              />

              <div className="mt-4 space-y-2">
                {(letters.data ?? []).map((letter) => {
                  const isOpen = openLetterId === letter.id;
                  return (
                    <div key={letter.id} className="border border-white/8 bg-dark-800/40">
                      <button
                        type="button"
                        className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left"
                        onClick={() => {
                          setOpenLetterId(isOpen ? null : letter.id);
                          setLetterDraft(letter.body);
                        }}
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <FileText size={14} className="shrink-0 text-zinc-500" />
                          <span className="truncate text-sm text-white">{letter.title}</span>
                        </span>
                        <span className="flex shrink-0 items-center gap-2">
                          <Badge tone={letter.engine.startsWith('ollama') ? 'neon' : 'neutral'}>
                            {letter.engine.startsWith('ollama') ? 'LLM' : 'template'}
                          </Badge>
                          <span className="text-[11px] text-zinc-600">
                            {formatRelative(letter.createdAt)}
                          </span>
                        </span>
                      </button>
                      {isOpen ? (
                        <div className="border-t border-white/8 p-3">
                          <Textarea
                            rows={12}
                            value={letterDraft}
                            onChange={(event) => setLetterDraft(event.target.value)}
                          />
                          <div className="mt-2 flex items-center justify-between gap-2">
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                icon={<Copy size={13} />}
                                onClick={() => handleCopy(letterDraft)}
                              >
                                Copy
                              </Button>
                              <Button
                                size="sm"
                                variant="primary"
                                disabled={letterDraft === letter.body}
                                onClick={() =>
                                  updateLetter.mutate(
                                    { id: letter.id, patch: { body: letterDraft } },
                                    { onSuccess: () => toast.success('Letter saved') },
                                  )
                                }
                              >
                                Save edits
                              </Button>
                            </div>
                            <Button
                              size="sm"
                              variant="danger"
                              icon={<Trash2 size={13} />}
                              onClick={() =>
                                deleteLetter.mutate(letter.id, {
                                  onSuccess: () => toast.success('Letter deleted'),
                                })
                              }
                            >
                              Delete
                            </Button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
                {letters.data?.length === 0 ? (
                  <p className="text-xs text-zinc-600">
                    No letters yet. Generation is grounded in your resume — it will not invent
                    experience you do not have.
                  </p>
                ) : null}
              </div>
            </section>

            <Divider />

            {/* timeline */}
            <section>
              <SectionLabel>Timeline</SectionLabel>
              <ol className="relative space-y-4 border-l border-white/8 pl-4">
                {sortedEvents.map((event) => (
                  <li key={event.id} className="relative">
                    <span className="absolute -left-[21px] top-1.5 h-2 w-2 bg-zinc-600" />
                    <p className="text-sm text-zinc-300">
                      {event.type === 'status_changed' && event.toStatus
                        ? `Moved to ${STATUS_META[event.toStatus].label}`
                        : event.type === 'created'
                          ? 'Application created'
                          : event.type === 'scored'
                            ? 'Match score computed'
                            : event.type === 'cover_letter'
                              ? 'Cover letter generated'
                              : event.type === 'follow_up'
                                ? 'Follow-up scheduled'
                                : 'Notes updated'}
                    </p>
                    {event.message && event.type !== 'created' ? (
                      <p className="mt-1 text-xs leading-relaxed text-zinc-500">{event.message}</p>
                    ) : null}
                    <p className="mt-1 text-[11px] text-zinc-600">
                      {formatDateTime(event.createdAt)} · {formatRelative(event.createdAt)}
                    </p>
                  </li>
                ))}
                {sortedEvents.length === 0 ? (
                  <li className="text-xs text-zinc-600">No activity recorded yet.</li>
                ) : null}
              </ol>
            </section>

            <Divider />

            {/* danger zone */}
            <section className="pb-4">
              {!confirmDelete ? (
                <Button
                  variant="danger"
                  size="sm"
                  icon={<Trash2 size={13} />}
                  onClick={() => setConfirmDelete(true)}
                >
                  Delete application
                </Button>
              ) : (
                <Banner
                  tone="error"
                  title="Delete this application?"
                  action={
                    <div className="flex shrink-0 gap-2">
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={handleDelete}
                        loading={deleteApplication.isPending}
                      >
                        Delete
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>
                        Cancel
                      </Button>
                    </div>
                  }
                >
                  The job, match history and cover letters for it are removed permanently.
                </Banner>
              )}
            </section>
          </div>
        )}
      </aside>
    </div>
  );
}
