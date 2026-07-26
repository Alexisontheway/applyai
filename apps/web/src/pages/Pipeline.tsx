import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  DndContext,
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
  useDroppable,
  useDraggable,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { api } from '../lib/api';
import { Plus, X, Trash2 } from 'lucide-react';

interface ApplicationRow {
  applications: {
    id: string;
    status: string;
    notes: string | null;
    matchScore: string | null;
    createdAt: string;
  };
  jobs: {
    id: string;
    title: string;
    company: string;
  } | null;
}

const columns = [
  { key: 'saved', label: 'Saved', color: 'border-blue-500/50' },
  { key: 'applied', label: 'Applied', color: 'border-yellow-500/50' },
  { key: 'screening', label: 'Screening', color: 'border-purple-500/50' },
  { key: 'interview', label: 'Interview', color: 'border-green-500/50' },
  { key: 'offer', label: 'Offer', color: 'border-emerald-500/50' },
  { key: 'rejected', label: 'Rejected', color: 'border-red-500/50' },
  { key: 'ghosted', label: 'Ghosted', color: 'border-gray-500/50' },
];

function Column({ id, label, color, count, children }: { id: string; label: string; color: string; count: number; children: React.ReactNode }) {
  const { isOver, setNodeRef } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className="flex-shrink-0 w-64">
      <div className={`border-t-2 ${color} bg-dark-800/30 p-4 transition-colors ${isOver ? 'bg-dark-800/60 ring-1 ring-inset ring-neon/20' : ''}`}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white text-sm font-semibold">{label}</h3>
          <span className="text-xs text-gray-500 bg-dark-700 px-2 py-0.5">{count}</span>
        </div>
        <div className="space-y-2 min-h-[60px]">
          {children}
        </div>
      </div>
    </div>
  );
}

function Card({ id, title, company, onClick }: { id: string; title: string; company: string; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: isDragging ? 50 : undefined }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter') onClick(); }}
      className={`bg-dark-900 border border-neon/10 p-3 hover:border-neon/30 transition-colors ${isDragging ? 'opacity-30' : 'cursor-grab active:cursor-grabbing'}`}
      {...listeners}
      {...attributes}
    >
      <p className="text-white text-sm font-medium truncate">{title}</p>
      <p className="text-gray-500 text-xs mt-1 truncate">{company}</p>
    </div>
  );
}

function CardContent({ title, company }: { title: string; company: string }) {
  return (
    <div className="bg-dark-900 border border-neon/10 p-3 shadow-xl">
      <p className="text-white text-sm font-medium truncate">{title}</p>
      <p className="text-gray-500 text-xs mt-1 truncate">{company}</p>
    </div>
  );
}

const statusLabels: Record<string, string> = {
  saved: 'Saved',
  applied: 'Applied',
  screening: 'Screening',
  interview: 'Interview',
  offer: 'Offer',
  rejected: 'Rejected',
  ghosted: 'Ghosted',
};

export default function PipelinePage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [company, setCompany] = useState('');
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [selectedApp, setSelectedApp] = useState<ApplicationRow | null>(null);
  const [editNotes, setEditNotes] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data: applications } = useQuery({
    queryKey: ['applications'],
    queryFn: () => api.get<ApplicationRow[]>('/applications'),
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const jobRes = await api.post<{ id: string }>('/jobs', { title, company });
      await api.post('/applications', { jobId: jobRes.id, status: 'saved' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      setTitle('');
      setCompany('');
      setShowForm(false);
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/applications/${id}`, { status }),
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: ['applications'] });
      const previous = queryClient.getQueryData<ApplicationRow[]>(['applications']);
      queryClient.setQueryData<ApplicationRow[]>(['applications'], (old) =>
        old?.map((app) =>
          app.applications.id === id
            ? { ...app, applications: { ...app.applications, status } }
            : app,
        ),
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(['applications'], context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] });
    },
  });

  const updateNotesMutation = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes: string }) =>
      api.patch(`/applications/${id}`, { notes: notes || null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/applications/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      setSelectedApp(null);
      setConfirmDelete(false);
    },
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  function handleDragStart(event: DragStartEvent) {
    setActiveDragId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDragId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const appId = active.id as string;
    const newStatus = over.id as string;
    const currentApp = applications?.find((a) => a.applications.id === appId);
    if (!currentApp || currentApp.applications.status === newStatus) return;
    updateStatusMutation.mutate({ id: appId, status: newStatus });
  }

  function openDetail(app: ApplicationRow) {
    setSelectedApp(app);
    setEditNotes(app.applications.notes ?? '');
    setConfirmDelete(false);
  }

  function closeDetail() {
    if (updateNotesMutation.isPending) return;
    setSelectedApp(null);
    setEditNotes('');
    setConfirmDelete(false);
  }

  function handleSaveNotes() {
    if (!selectedApp) return;
    updateNotesMutation.mutate({ id: selectedApp.applications.id, notes: editNotes });
  }

  function handleDelete() {
    if (!selectedApp) return;
    deleteMutation.mutate(selectedApp.applications.id);
  }

  const appList = applications ?? [];
  const activeCard = activeDragId
    ? appList.find((a) => a.applications.id === activeDragId)
    : null;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Pipeline</h1>
          <p className="text-gray-500 text-sm mt-1">Track every application from discovery to offer</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-neon text-dark-900 px-4 py-2 text-sm font-semibold hover:bg-neon/90 transition-colors"
        >
          <Plus size={16} />
          Add Job
        </button>
      </div>

      {showForm && (
        <div className="border border-neon/20 bg-dark-800/50 p-6 mb-8">
          <div className="flex gap-4 mb-4">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Job title"
              className="flex-1 bg-dark-900 border border-neon/10 text-white px-4 py-2 text-sm focus:border-neon/50 focus:outline-none"
            />
            <input
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="Company"
              className="flex-1 bg-dark-900 border border-neon/10 text-white px-4 py-2 text-sm focus:border-neon/50 focus:outline-none"
            />
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => addMutation.mutate()}
              disabled={!title || !company || addMutation.isPending}
              className="bg-neon text-dark-900 px-4 py-2 text-sm font-semibold disabled:opacity-50"
            >
              {addMutation.isPending ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="text-gray-400 px-4 py-2 text-sm hover:text-white"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4" style={{ minHeight: '400px' }}>
          {columns.map(({ key, label, color }) => {
            const items = appList.filter((a) => a.applications.status === key);
            return (
              <Column key={key} id={key} label={label} color={color} count={items.length}>
                {items.map((row) => (
                  <Card
                    key={row.applications.id}
                    id={row.applications.id}
                    title={row.jobs?.title ?? 'Untitled'}
                    company={row.jobs?.company ?? 'Unknown'}
                    onClick={() => openDetail(row)}
                  />
                ))}
                {items.length === 0 && (
                  <p className="text-gray-600 text-xs text-center py-8">Drop jobs here</p>
                )}
              </Column>
            );
          })}
        </div>
        <DragOverlay>
          {activeCard ? (
            <CardContent
              title={activeCard.jobs?.title ?? 'Untitled'}
              company={activeCard.jobs?.company ?? 'Unknown'}
            />
          ) : null}
        </DragOverlay>
      </DndContext>

      {selectedApp && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/60" onClick={closeDetail} />
          <div className="relative w-full max-w-md bg-dark-900 border-l border-neon/10 shadow-2xl overflow-y-auto">
            <div className="sticky top-0 bg-dark-900 border-b border-neon/10 p-4 flex items-center justify-between">
              <h2 className="text-white font-semibold text-lg truncate mr-4">
                {selectedApp.jobs?.title ?? 'Untitled'}
              </h2>
              <button onClick={closeDetail} className="text-gray-400 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-4 space-y-5">
              <div className="space-y-2">
                <p className="text-gray-400 text-xs font-mono uppercase tracking-wider">Company</p>
                <p className="text-white">{selectedApp.jobs?.company ?? 'Unknown'}</p>
              </div>

              <div className="space-y-2">
                <p className="text-gray-400 text-xs font-mono uppercase tracking-wider">Status</p>
                <span className="inline-block bg-neon/10 text-neon text-xs font-semibold px-2 py-1">
                  {statusLabels[selectedApp.applications.status] ?? selectedApp.applications.status}
                </span>
              </div>

              <div className="space-y-2">
                <p className="text-gray-400 text-xs font-mono uppercase tracking-wider">Notes</p>
                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  rows={4}
                  className="w-full bg-dark-800 border border-neon/10 text-white px-3 py-2 text-sm focus:border-neon/50 focus:outline-none resize-none"
                  placeholder="Add notes about this application..."
                />
                {editNotes !== (selectedApp.applications.notes ?? '') && (
                  <button
                    onClick={handleSaveNotes}
                    disabled={updateNotesMutation.isPending}
                    className="bg-neon text-dark-900 px-4 py-1.5 text-sm font-semibold disabled:opacity-50"
                  >
                    {updateNotesMutation.isPending ? 'Saving...' : 'Save Notes'}
                  </button>
                )}
              </div>

              {selectedApp.applications.matchScore && (
                <div className="space-y-2">
                  <p className="text-gray-400 text-xs font-mono uppercase tracking-wider">Match Score</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-dark-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-neon rounded-full transition-all"
                        style={{ width: `${Math.min(Number(selectedApp.applications.matchScore), 100)}%` }}
                      />
                    </div>
                    <span className="text-neon text-sm font-mono">{Number(selectedApp.applications.matchScore).toFixed(0)}%</span>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <p className="text-gray-400 text-xs font-mono uppercase tracking-wider">Created</p>
                <p className="text-gray-300 text-sm">{new Date(selectedApp.applications.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
              </div>

              <div className="border-t border-neon/10 pt-4">
                {!confirmDelete ? (
                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="flex items-center gap-2 text-red-400 hover:text-red-300 text-sm transition-colors"
                  >
                    <Trash2 size={16} />
                    Delete application
                  </button>
                ) : (
                  <div className="bg-red-500/10 border border-red-500/20 p-3">
                    <p className="text-red-400 text-xs mb-2">Are you sure? This cannot be undone.</p>
                    <div className="flex gap-2">
                      <button
                        onClick={handleDelete}
                        disabled={deleteMutation.isPending}
                        className="bg-red-500 text-white px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                      >
                        {deleteMutation.isPending ? 'Deleting...' : 'Yes, delete'}
                      </button>
                      <button
                        onClick={() => setConfirmDelete(false)}
                        className="text-gray-400 px-3 py-1.5 text-xs hover:text-white"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
