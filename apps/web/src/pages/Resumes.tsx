import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FileText, Plus, Star, Trash2, X } from 'lucide-react';
import { api } from '../lib/api';

interface Resume {
  id: string;
  label: string;
  isActive: boolean;
  fileUrl: string | null;
  parsedText: string | null;
  createdAt: string;
}

export default function ResumesPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [label, setLabel] = useState('');
  const [isActive, setIsActive] = useState(false);
  const [formError, setFormError] = useState('');

  const { data: resumes, isLoading } = useQuery({
    queryKey: ['resumes'],
    queryFn: () => api.get<Resume[]>('/resumes'),
  });

  const createMutation = useMutation({
    mutationFn: () => api.post('/resumes', { label: label.trim(), isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resumes'] });
      setLabel('');
      setIsActive(false);
      setShowForm(false);
      setFormError('');
    },
    onError: (err: Error) => setFormError(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/resumes/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['resumes'] }),
  });

  const resumeList = resumes ?? [];

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Resumes</h1>
          <p className="text-gray-500 text-sm mt-1">Manage your resume versions and track which one gets you interviews</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-neon text-dark-900 px-4 py-2 text-sm font-semibold hover:bg-neon/90 transition-colors"
        >
          <Plus size={16} />
          Add Resume
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="border border-neon/20 bg-dark-800/50 p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-semibold text-sm">New Resume Version</h2>
            <button onClick={() => { setShowForm(false); setFormError(''); }} className="text-gray-500 hover:text-white">
              <X size={16} />
            </button>
          </div>
          <div className="flex gap-4 mb-4">
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. SWE General, ML Focus, Startup"
              className="flex-1 bg-dark-900 border border-neon/10 text-white px-4 py-2 text-sm focus:border-neon/50 focus:outline-none"
            />
            <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="accent-neon"
              />
              Set as active
            </label>
          </div>
          {formError && <p className="text-red-400 text-xs mb-3">{formError}</p>}
          <div className="flex gap-3">
            <button
              onClick={() => createMutation.mutate()}
              disabled={!label.trim() || createMutation.isPending}
              className="bg-neon text-dark-900 px-4 py-2 text-sm font-semibold disabled:opacity-50"
            >
              {createMutation.isPending ? 'Saving...' : 'Save'}
            </button>
            <button onClick={() => { setShowForm(false); setFormError(''); }} className="text-gray-400 px-4 py-2 text-sm hover:text-white">
              Cancel
            </button>
          </div>
          <p className="text-gray-600 text-xs mt-3">
            Note: File upload (PDF parsing) is coming in Phase 3. For now, label your versions to track which resume you used for each application.
          </p>
        </div>
      )}

      {/* Resume list */}
      {isLoading ? (
        <div className="border border-neon/10 bg-dark-800/30 p-8 text-center">
          <p className="text-gray-500 text-sm">Loading resumes...</p>
        </div>
      ) : resumeList.length === 0 ? (
        <div className="border border-neon/10 bg-dark-800/30 p-16 text-center">
          <FileText size={40} className="mx-auto text-gray-600 mb-4" />
          <p className="text-gray-500">
            No resumes added yet. Click <span className="text-neon">Add Resume</span> to create your first version.
          </p>
          <p className="text-gray-600 text-sm mt-2">Phase 3 will add PDF upload and ML-powered skill extraction.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {resumeList.map((resume) => (
            <div
              key={resume.id}
              className={`border p-5 flex items-center justify-between gap-4 transition-colors ${
                resume.isActive
                  ? 'border-neon/40 bg-neon/5'
                  : 'border-neon/10 bg-dark-800/30 hover:border-neon/20'
              }`}
            >
              <div className="flex items-center gap-4 min-w-0">
                <FileText size={20} className={resume.isActive ? 'text-neon shrink-0' : 'text-gray-500 shrink-0'} />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-white font-medium text-sm truncate">{resume.label}</p>
                    {resume.isActive && (
                      <span className="flex items-center gap-1 text-neon text-xs font-mono bg-neon/10 px-2 py-0.5 shrink-0">
                        <Star size={10} fill="currentColor" />
                        Active
                      </span>
                    )}
                  </div>
                  <p className="text-gray-500 text-xs mt-0.5">
                    Added {new Date(resume.createdAt).toLocaleDateString()}
                    {resume.parsedText ? ' · Text extracted' : ' · No file uploaded'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => deleteMutation.mutate(resume.id)}
                disabled={deleteMutation.isPending}
                className="shrink-0 text-gray-600 hover:text-red-400 transition-colors p-1 disabled:opacity-50"
                title="Delete resume"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
