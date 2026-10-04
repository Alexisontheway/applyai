import { useShell } from '@/components/AppShell';
import { ApplicationDrawer } from '@/components/ApplicationDrawer';
import { ScoreBadge } from '@/components/indicators';
import { useToast } from '@/components/ui/Toast';
import { Banner, Button, Input, Skeleton } from '@/components/ui/primitives';
import { SOURCE_LABELS, STATUS_META } from '@/lib/format';
import { useApplications, useUpdateApplication } from '@/lib/queries';
import { cn } from '@/lib/utils';
import { APPLICATION_STATUSES, type ApplicationStatusValue } from '@applyai/shared/schemas';
import type { Application } from '@applyai/shared/types';
import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { Plus, Search } from 'lucide-react';
import { useMemo, useState } from 'react';

export default function PipelinePage() {
  const { openNewApplication } = useShell();
  const toast = useToast();
  const { data: applications, isLoading, isError, error } = useApplications();
  const updateApplication = useUpdateApplication();

  const [query, setQuery] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const filtered = useMemo(() => {
    const list = applications ?? [];
    if (!query.trim()) return list;
    const needle = query.trim().toLowerCase();
    return list.filter(
      (application) =>
        application.job?.title.toLowerCase().includes(needle) ||
        application.job?.company.toLowerCase().includes(needle),
    );
  }, [applications, query]);

  const byStatus = useMemo(() => {
    const map = new Map<ApplicationStatusValue, Application[]>();
    for (const status of APPLICATION_STATUSES) map.set(status, []);
    for (const application of filtered) map.get(application.status)?.push(application);
    return map;
  }, [filtered]);

  const activeApplication = filtered.find((application) => application.id === activeId) ?? null;

  const handleDragStart = (event: DragStartEvent) => setActiveId(String(event.active.id));

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const applicationId = String(active.id);
    const nextStatus = String(over.id) as ApplicationStatusValue;
    const application = filtered.find((entry) => entry.id === applicationId);
    if (!application || application.status === nextStatus) return;
    if (!APPLICATION_STATUSES.includes(nextStatus)) return;

    updateApplication.mutate(
      { id: applicationId, patch: { status: nextStatus } },
      {
        onSuccess: () =>
          toast.success(
            `${application.job?.company ?? 'Application'} → ${STATUS_META[nextStatus].label}`,
          ),
        onError: (mutationError) => toast.error('Could not move that card', mutationError.message),
      },
    );
  };

  const total = filtered.length;

  return (
    <div className="flex h-full flex-col">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Pipeline</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Drag cards between stages. Every move is recorded and feeds your analytics.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filter by role or company"
              className="w-64 pl-9"
            />
          </div>
          <Button variant="primary" icon={<Plus size={15} />} onClick={openNewApplication}>
            New
          </Button>
        </div>
      </header>

      {isError ? (
        <Banner tone="error" title="Could not load your pipeline">
          {error.message}
        </Banner>
      ) : null}

      {isLoading ? (
        <div className="flex gap-4">
          {APPLICATION_STATUSES.slice(0, 5).map((status) => (
            <Skeleton key={status} className="h-72 w-64 shrink-0" />
          ))}
        </div>
      ) : total === 0 ? (
        <div className="border border-dashed border-white/10 px-6 py-16 text-center">
          <p className="text-white">
            {query ? 'Nothing matches that filter' : 'No applications yet'}
          </p>
          <p className="mx-auto mt-2 max-w-md text-sm text-zinc-500">
            {query
              ? 'Clear the filter to see your whole pipeline.'
              : 'Track your first job — paste a posting link and ApplyAI will fill in the details and score it against your resume.'}
          </p>
          {!query ? (
            <Button
              variant="primary"
              className="mt-5"
              icon={<Plus size={15} />}
              onClick={openNewApplication}
            >
              Add your first application
            </Button>
          ) : null}
        </div>
      ) : (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex flex-1 gap-3 overflow-x-auto pb-6">
            {APPLICATION_STATUSES.map((status) => (
              <BoardColumn
                key={status}
                status={status}
                applications={byStatus.get(status) ?? []}
                onCardClick={setSelectedId}
              />
            ))}
          </div>
          <DragOverlay dropAnimation={null}>
            {activeApplication ? <CardPreview application={activeApplication} /> : null}
          </DragOverlay>
        </DndContext>
      )}

      <ApplicationDrawer applicationId={selectedId} onClose={() => setSelectedId(null)} />
    </div>
  );
}

function BoardColumn({
  status,
  applications,
  onCardClick,
}: {
  status: ApplicationStatusValue;
  applications: Application[];
  onCardClick: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const meta = STATUS_META[status];

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex w-64 shrink-0 flex-col border-t-2 bg-dark-800/30 transition-colors',
        isOver ? 'bg-dark-800/70' : '',
      )}
      style={{ borderTopColor: undefined }}
    >
      <div className={cn('h-0.5 w-full', meta.bar)} />
      <div className="flex items-center justify-between px-3 py-3">
        <div className="flex items-center gap-2">
          <span className={cn('h-1.5 w-1.5', meta.dot)} />
          <h2 className="text-xs font-mono uppercase tracking-wide text-zinc-300">{meta.label}</h2>
        </div>
        <span className="text-[11px] text-zinc-500">{applications.length}</span>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto px-3 pb-3">
        {applications.map((application) => (
          <ApplicationCard
            key={application.id}
            application={application}
            onClick={() => onCardClick(application.id)}
          />
        ))}
        {applications.length === 0 ? (
          <div className="border border-dashed border-white/8 px-3 py-6 text-center text-[11px] text-zinc-600">
            Drop here
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ApplicationCard({
  application,
  onClick,
}: { application: Application; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: application.id,
  });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={onClick}
      className={cn(
        'group cursor-grab border border-white/8 bg-dark-900 p-3 transition-colors hover:border-neon/40 active:cursor-grabbing',
        isDragging && 'opacity-30',
      )}
    >
      <CardBody application={application} />
    </div>
  );
}

function CardPreview({ application }: { application: Application }) {
  return (
    <div className="w-60 border border-neon/40 bg-dark-900 p-3 shadow-2xl">
      <CardBody application={application} />
    </div>
  );
}

function CardBody({ application }: { application: Application }) {
  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="line-clamp-2 text-sm font-medium leading-snug text-white">
          {application.job?.title ?? 'Untitled role'}
        </p>
        <ScoreBadge score={application.matchScore} className="shrink-0 pt-0.5" />
      </div>
      <p className="mt-1 truncate text-xs text-zinc-500">
        {application.job?.company ?? 'Unknown company'}
      </p>
      <div className="mt-2 flex items-center justify-between text-[10px] font-mono uppercase tracking-wide text-zinc-600">
        <span>{SOURCE_LABELS[application.job?.source ?? 'manual']}</span>
        <span>{application.daysInStage === 0 ? 'today' : `${application.daysInStage}d`}</span>
      </div>
      {application.followUpDate ? (
        <p className="mt-1.5 border-t border-white/6 pt-1.5 text-[10px] text-amber-300/80">
          Follow up {new Date(application.followUpDate).toLocaleDateString()}
        </p>
      ) : null}
    </>
  );
}
