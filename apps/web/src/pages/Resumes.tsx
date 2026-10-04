import { useToast } from '@/components/ui/Toast';
import {
  Badge,
  Banner,
  Button,
  Chip,
  EmptyState,
  Field,
  Input,
  SectionLabel,
  Segmented,
  Skeleton,
  SkeletonList,
  Textarea,
} from '@/components/ui/primitives';
import { formatRelative } from '@/lib/format';
import {
  useActivateResume,
  useCoverLetters,
  useCreateResume,
  useDeleteResume,
  useImportResume,
  useResumes,
  useUpdateResume,
} from '@/lib/queries';
import { cn } from '@/lib/utils';
import { skillLabel } from '@applyai/shared/skills';
import type { Resume } from '@applyai/shared/types';
import { Copy, FileText, Star, Trash2, Upload, Wand2 } from 'lucide-react';
import { useRef, useState } from 'react';

export default function ResumesPage() {
  const toast = useToast();
  const { data: resumes, isLoading } = useResumes();
  const createResume = useCreateResume();
  const importResume = useImportResume();
  const updateResume = useUpdateResume();
  const activateResume = useActivateResume();
  const deleteResume = useDeleteResume();

  const [showForm, setShowForm] = useState(false);
  const [mode, setMode] = useState<'paste' | 'upload'>('paste');
  const [label, setLabel] = useState('');
  const [text, setText] = useState('');
  const [makeActive, setMakeActive] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const resetForm = () => {
    setLabel('');
    setText('');
    setMakeActive(true);
    setFormError(null);
    setShowForm(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleCreate = async () => {
    setFormError(null);
    try {
      await createResume.mutateAsync({
        label: label.trim(),
        text: text.trim() || undefined,
        isActive: makeActive,
      });
      toast.success('Resume added', 'Applications you track from now on can be scored against it.');
      resetForm();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not save that resume');
    }
  };

  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setFormError('Choose a PDF, DOCX or TXT file first.');
      return;
    }
    setFormError(null);
    const formData = new FormData();
    formData.append('file', file);
    if (label.trim()) formData.append('label', label.trim());
    formData.append('isActive', String(makeActive));
    try {
      const resume = await importResume.mutateAsync(formData);
      toast.success('Resume imported', `${resume.wordCount} words parsed — matching is ready.`);
      resetForm();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not import that file');
    }
  };

  const activeResume = resumes?.find((resume) => resume.isActive);

  return (
    <div className="space-y-7">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Resumes</h1>
          <p className="mt-1 text-sm text-zinc-500">
            The match engine reads these. Paste the text or upload a PDF — the skills list is
            extracted automatically.
          </p>
        </div>
        <Button
          variant="primary"
          icon={<Upload size={15} />}
          onClick={() => setShowForm((value) => !value)}
        >
          Add resume
        </Button>
      </header>

      {!activeResume && resumes && resumes.length > 0 ? (
        <Banner tone="warning" title="No active resume">
          Mark one resume as active — new applications are scored against it by default.
        </Banner>
      ) : null}

      {showForm ? (
        <div className="border border-white/10 bg-dark-800/50 p-5 space-y-4">
          <Segmented
            value={mode}
            onChange={(value) => {
              setMode(value);
              setFormError(null);
            }}
            options={[
              { value: 'paste', label: 'Paste text' },
              { value: 'upload', label: 'Upload file' },
            ]}
          />

          <Field
            label="Label"
            hint="Name it by the jobs it targets — “SWE general”, “ML focus”, “Platform”."
          >
            <Input
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="e.g. Full-stack — React / Node"
            />
          </Field>

          {mode === 'paste' ? (
            <Field
              label="Resume text"
              hint="Plain text works best. Include your skills section — that is what gets matched."
            >
              <Textarea
                rows={12}
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder={
                  'Paste your full resume here…\n\nSUMMARY\n…\n\nSKILLS\nTypeScript, React, PostgreSQL…'
                }
              />
            </Field>
          ) : (
            <Field
              label="File"
              hint="PDF and DOCX need the optional ML service (npm run dev:ml). TXT always works."
            >
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.docx,.txt,.md,.rst"
                className="w-full border border-white/10 bg-dark-900/80 px-3 py-2 text-sm text-zinc-400 file:mr-3 file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-xs file:text-white"
              />
            </Field>
          )}

          <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-400">
            <input
              type="checkbox"
              checked={makeActive}
              onChange={(event) => setMakeActive(event.target.checked)}
              className="accent-neon"
            />
            Make this the active resume
          </label>

          {formError ? <Banner tone="error">{formError}</Banner> : null}

          <div className="flex gap-2">
            <Button
              variant="primary"
              icon={<Wand2 size={14} />}
              loading={createResume.isPending || importResume.isPending}
              onClick={mode === 'paste' ? handleCreate : handleUpload}
              disabled={mode === 'paste' ? text.trim().length < 40 || !label.trim() : false}
            >
              {mode === 'paste' ? 'Save resume' : 'Import file'}
            </Button>
            <Button variant="ghost" onClick={resetForm}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      {isLoading ? (
        <SkeletonList count={3} className="h-32" />
      ) : (resumes ?? []).length === 0 ? (
        <EmptyState
          icon={<FileText size={22} />}
          title="No resumes yet"
          description="Add one resume to unlock match scores, gap analysis and grounded cover letters. Everything else in ApplyAI builds on this."
          action={
            <Button variant="primary" onClick={() => setShowForm(true)}>
              Add your first resume
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {(resumes ?? []).map((resume) => (
            <ResumeCard
              key={resume.id}
              resume={resume}
              expanded={expandedId === resume.id}
              onToggleExpand={() => setExpandedId(expandedId === resume.id ? null : resume.id)}
              renaming={renamingId === resume.id}
              renameValue={renameValue}
              onRenameChange={setRenameValue}
              onRenameStart={() => {
                setRenamingId(resume.id);
                setRenameValue(resume.label);
              }}
              onRenameSave={() => {
                updateResume.mutate(
                  { id: resume.id, patch: { label: renameValue.trim() } },
                  { onSuccess: () => toast.success('Renamed') },
                );
                setRenamingId(null);
              }}
              onActivate={() =>
                activateResume.mutate(resume.id, {
                  onSuccess: () => toast.success(`“${resume.label}” is now the active resume`),
                })
              }
              confirmingDelete={confirmDeleteId === resume.id}
              onDeleteConfirm={() => setConfirmDeleteId(resume.id)}
              onDeleteCancel={() => setConfirmDeleteId(null)}
              onDelete={() =>
                deleteResume.mutate(resume.id, {
                  onSuccess: () => {
                    toast.success('Resume deleted');
                    setConfirmDeleteId(null);
                  },
                })
              }
            />
          ))}
        </div>
      )}

      <LettersSection />
    </div>
  );
}

function ResumeCard({
  resume,
  expanded,
  onToggleExpand,
  renaming,
  renameValue,
  onRenameChange,
  onRenameStart,
  onRenameSave,
  onActivate,
  confirmingDelete,
  onDeleteConfirm,
  onDeleteCancel,
  onDelete,
}: {
  resume: Resume;
  expanded: boolean;
  onToggleExpand: () => void;
  renaming: boolean;
  renameValue: string;
  onRenameChange: (value: string) => void;
  onRenameStart: () => void;
  onRenameSave: () => void;
  onActivate: () => void;
  confirmingDelete: boolean;
  onDeleteConfirm: () => void;
  onDeleteCancel: () => void;
  onDelete: () => void;
}) {
  const summary = resume.summary;
  const skills = resume.skills.slice(0, 16);

  return (
    <div
      className={cn(
        'border bg-dark-800/30 transition-colors',
        resume.isActive ? 'border-neon/40 bg-neon/[0.03]' : 'border-white/8 hover:border-white/20',
      )}
    >
      <div className="flex items-start justify-between gap-4 p-5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {renaming ? (
              <span className="flex items-center gap-2">
                <Input
                  value={renameValue}
                  onChange={(event) => onRenameChange(event.target.value)}
                  onKeyDown={(event) => event.key === 'Enter' && onRenameSave()}
                  className="h-8 w-72"
                  autoFocus
                />
                <Button size="sm" variant="primary" onClick={onRenameSave}>
                  Save
                </Button>
              </span>
            ) : (
              <>
                <h3 className="text-sm font-medium text-white">{resume.label}</h3>
                {resume.isActive ? (
                  <Badge tone="neon">
                    <Star size={10} /> Active
                  </Badge>
                ) : null}
                {resume.source === 'upload' ? <Badge tone="sky">Uploaded</Badge> : null}
              </>
            )}
          </div>

          <p className="mt-1 text-xs text-zinc-500">
            {resume.wordCount} words · {resume.skills.length} skills detected · added{' '}
            {formatRelative(resume.createdAt)}
            {summary
              ? ` · used in ${summary.usageCount} application${summary.usageCount === 1 ? '' : 's'}`
              : ''}
          </p>

          {skills.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-1">
              {skills.map((skillId) => (
                <Chip key={skillId}>{skillLabel(skillId)}</Chip>
              ))}
              {resume.skills.length > skills.length ? (
                <Chip className="text-zinc-500">+{resume.skills.length - skills.length} more</Chip>
              ) : null}
            </div>
          ) : (
            <p className="mt-3 text-xs text-amber-300/80">
              No skills were detected — add a skills section, or paste the resume text instead of a
              file.
            </p>
          )}

          {summary && summary.usageCount > 0 ? (
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 border-t border-white/6 pt-3 text-xs text-zinc-400">
              <span>
                Interviews <span className="text-white">{summary.interviews}</span>
              </span>
              <span>
                Offers <span className="text-white">{summary.offers}</span>
              </span>
              <span>
                Interview rate{' '}
                <span className="text-white">
                  {summary.interviewRate === null ? '—' : `${summary.interviewRate}%`}
                </span>
              </span>
              <span>
                Avg score{' '}
                <span className="text-white">
                  {summary.avgMatchScore === null ? '—' : `${Math.round(summary.avgMatchScore)}%`}
                </span>
              </span>
            </div>
          ) : null}

          {expanded && resume.parsedText ? (
            <pre className="mt-4 max-h-72 overflow-y-auto whitespace-pre-wrap border border-white/8 bg-dark-900/70 p-3 text-[11px] leading-relaxed text-zinc-500">
              {resume.parsedText}
            </pre>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          {!resume.isActive ? (
            <Button size="sm" onClick={onActivate}>
              Set active
            </Button>
          ) : null}
          <div className="flex items-center gap-1">
            <Button size="sm" variant="ghost" onClick={onRenameStart}>
              Rename
            </Button>
            {resume.parsedText ? (
              <Button size="sm" variant="ghost" onClick={onToggleExpand}>
                {expanded ? 'Hide text' : 'View text'}
              </Button>
            ) : null}
            {confirmingDelete ? null : (
              <Button
                size="sm"
                variant="ghost"
                onClick={onDeleteConfirm}
                className="hover:text-red-300"
              >
                <Trash2 size={13} />
              </Button>
            )}
          </div>
        </div>
      </div>

      {confirmingDelete ? (
        <div className="border-t border-red-500/20 bg-red-500/5 px-5 py-3">
          <div className="flex items-center justify-between gap-4">
            <p className="text-xs text-red-300">
              Delete “{resume.label}”? Applications keep their history but lose the resume link.
            </p>
            <div className="flex gap-2">
              <Button size="sm" variant="danger" onClick={onDelete}>
                Delete
              </Button>
              <Button size="sm" variant="ghost" onClick={onDeleteCancel}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function LettersSection() {
  const toast = useToast();
  const { data: letters } = useCoverLetters();
  const [openId, setOpenId] = useState<string | null>(null);

  if (!letters || letters.length === 0) return null;

  return (
    <section>
      <SectionLabel>Cover letters ({letters.length})</SectionLabel>
      <div className="space-y-2">
        {letters.map((letter) => {
          const isOpen = openId === letter.id;
          return (
            <div key={letter.id} className="border border-white/8 bg-dark-800/30">
              <button
                type="button"
                onClick={() => setOpenId(isOpen ? null : letter.id)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm text-white">{letter.title}</span>
                  <span className="block text-[11px] text-zinc-500">
                    {letter.tone} · {formatRelative(letter.createdAt)}
                  </span>
                </span>
                <Badge tone={letter.engine.startsWith('ollama') ? 'neon' : 'neutral'}>
                  {letter.engine.startsWith('ollama') ? 'LLM' : 'template'}
                </Badge>
              </button>
              {isOpen ? (
                <div className="border-t border-white/8 p-4">
                  <pre className="max-h-80 overflow-y-auto whitespace-pre-wrap text-[13px] leading-relaxed text-zinc-300">
                    {letter.body}
                  </pre>
                  <Button
                    size="sm"
                    className="mt-3"
                    icon={<Copy size={13} />}
                    onClick={async () => {
                      await navigator.clipboard.writeText(letter.body);
                      toast.success('Copied to clipboard');
                    }}
                  >
                    Copy
                  </Button>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
