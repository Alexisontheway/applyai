import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Plus } from 'lucide-react';

const columns = [
  { key: 'saved', label: 'Saved', color: 'border-blue-500/50' },
  { key: 'applied', label: 'Applied', color: 'border-yellow-500/50' },
  { key: 'screening', label: 'Screening', color: 'border-purple-500/50' },
  { key: 'interview', label: 'Interview', color: 'border-green-500/50' },
  { key: 'offer', label: 'Offer', color: 'border-emerald-500/50' },
  { key: 'rejected', label: 'Rejected', color: 'border-red-500/50' },
  { key: 'ghosted', label: 'Ghosted', color: 'border-gray-500/50' },
];

export default function PipelinePage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [company, setCompany] = useState('');

  const { data: applications } = useQuery({
    queryKey: ['applications'],
    queryFn: () => api.get<Array<{ id: string; status: string; job?: { title: string; company: string } }>>('/applications'),
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

  const appList = applications ?? [];

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
              disabled={!title || !company}
              className="bg-neon text-dark-900 px-4 py-2 text-sm font-semibold disabled:opacity-50"
            >
              Save
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

      <div className="flex gap-4 overflow-x-auto pb-4" style={{ minHeight: '400px' }}>
        {columns.map(({ key, label, color }) => {
          const items = appList.filter((a) => a.status === key);
          return (
            <div key={key} className="flex-shrink-0 w-64">
              <div className={`border-t-2 ${color} bg-dark-800/30 p-4`}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-white text-sm font-semibold">{label}</h3>
                  <span className="text-xs text-gray-500 bg-dark-700 px-2 py-0.5">{items.length}</span>
                </div>
                <div className="space-y-2">
                  {items.map((app) => (
                    <div
                      key={app.id}
                      className="bg-dark-900 border border-neon/10 p-3 hover:border-neon/30 transition-colors cursor-pointer"
                    >
                      <p className="text-white text-sm font-medium truncate">
                        {app.job?.title ?? 'Untitled'}
                      </p>
                      <p className="text-gray-500 text-xs mt-1 truncate">
                        {app.job?.company ?? 'Unknown'}
                      </p>
                    </div>
                  ))}
                  {items.length === 0 && (
                    <p className="text-gray-600 text-xs text-center py-8">Drop jobs here</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
