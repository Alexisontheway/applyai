import { FileText, Upload } from 'lucide-react';

export default function ResumesPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Resumes</h1>
          <p className="text-gray-500 text-sm mt-1">Manage your resume versions</p>
        </div>
        <button className="flex items-center gap-2 bg-neon text-dark-900 px-4 py-2 text-sm font-semibold hover:bg-neon/90 transition-colors">
          <Upload size={16} />
          Upload Resume
        </button>
      </div>

      <div className="border border-neon/10 bg-dark-800/30 p-16 text-center">
        <FileText size={40} className="mx-auto text-gray-600 mb-4" />
        <p className="text-gray-500">
          No resumes uploaded yet. Upload your first resume to start tracking versions.{' '}
          <span className="text-neon/60">Phase 3 will add PDF parsing and matching.</span>
        </p>
      </div>
    </div>
  );
}
