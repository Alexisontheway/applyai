import { NewApplicationDialog } from '@/components/NewApplicationDialog';
import { Button } from '@/components/ui/primitives';
import { authClient } from '@/lib/auth';
import { initials } from '@/lib/format';
import { useHealth } from '@/lib/queries';
import { cn } from '@/lib/utils';
import { Link, Outlet, useLocation, useNavigate } from '@tanstack/react-router';
import {
  BarChart3,
  Building2,
  FileText,
  Kanban,
  LayoutDashboard,
  LogOut,
  Plus,
  Search,
  Table2,
} from 'lucide-react';
import { type ReactNode, createContext, useContext, useState } from 'react';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/pipeline', label: 'Pipeline', icon: Kanban },
  { to: '/applications', label: 'Applications', icon: Table2 },
  { to: '/job-scout', label: 'Job Scout', icon: Search },
  { to: '/resumes', label: 'Resumes', icon: FileText },
  { to: '/companies', label: 'Companies', icon: Building2 },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
] as const;

interface ShellContextValue {
  openNewApplication: () => void;
}

const ShellContext = createContext<ShellContextValue | null>(null);

export function useShell(): ShellContextValue {
  const context = useContext(ShellContext);
  if (!context) throw new Error('useShell must be used inside the app shell');
  return context;
}

export default function AppShell({
  children,
  user,
}: { children?: ReactNode; user: { name: string; email: string } | null }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const isLoginPage = location.pathname === '/login';

  const handleSignOut = async () => {
    await authClient.signOut();
    await navigate({ to: '/login' });
  };

  if (isLoginPage) {
    return <>{children ?? <Outlet />}</>;
  }

  return (
    <ShellContext.Provider value={{ openNewApplication: () => setNewDialogOpen(true) }}>
      <div className="flex h-screen overflow-hidden bg-dark-900">
        <aside className="flex w-60 shrink-0 flex-col border-r border-white/8 bg-dark-800/30">
          <div className="flex items-center gap-2.5 border-b border-white/8 px-5 py-4">
            <Link to="/" className="flex items-center gap-2.5 group">
              <span className="flex h-7 w-7 items-center justify-center bg-neon text-sm font-black text-black">
                A
              </span>
              <span className="text-sm font-semibold tracking-tight text-white group-hover:text-neon transition-colors">
                ApplyAI
              </span>
            </Link>
          </div>

          <div className="px-3 py-3">
            <Button
              variant="primary"
              size="md"
              className="w-full"
              icon={<Plus size={15} />}
              onClick={() => setNewDialogOpen(true)}
            >
              New application
            </Button>
          </div>

          <nav className="flex-1 overflow-y-auto px-3 py-1 space-y-0.5">
            {NAV_ITEMS.map(({ to, label, icon: Icon }) => {
              const isActive =
                to === '/' ? location.pathname === '/' : location.pathname.startsWith(to);
              return (
                <Link
                  key={to}
                  to={to}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 text-sm transition-colors border-l-2',
                    isActive
                      ? 'border-neon bg-neon/8 text-white'
                      : 'border-transparent text-zinc-400 hover:border-white/20 hover:bg-white/5 hover:text-white',
                  )}
                >
                  <Icon size={15} className={isActive ? 'text-neon' : undefined} />
                  {label}
                </Link>
              );
            })}
          </nav>

          <ServiceStatus />

          <div className="border-t border-white/8 p-3">
            {user ? (
              <div className="mb-2 flex items-center gap-2.5 px-1.5 py-1.5">
                <span className="flex h-7 w-7 items-center justify-center border border-neon/30 bg-neon/10 text-[11px] font-semibold text-neon">
                  {initials(user.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs text-white">{user.name}</p>
                  <p className="truncate text-[11px] text-zinc-500">{user.email}</p>
                </div>
              </div>
            ) : null}
            <button
              type="button"
              onClick={handleSignOut}
              className="flex w-full items-center gap-2 px-3 py-2 text-xs text-zinc-500 transition-colors hover:bg-red-500/5 hover:text-red-300"
            >
              <LogOut size={13} />
              Sign out
            </button>
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1400px] px-8 py-8">{children ?? <Outlet />}</div>
        </main>
      </div>
      <NewApplicationDialog open={newDialogOpen} onClose={() => setNewDialogOpen(false)} />
    </ShellContext.Provider>
  );
}

/** Shows which optional services are up — no fake green dots. */
function ServiceStatus() {
  const { data, isError } = useHealth();

  const items = [
    {
      label: 'Database',
      ok: Boolean(data?.checks.database.ok) && !isError,
      title: data?.checks.database.error ?? 'Connected',
    },
    {
      label: data?.checks.llm.configured ? `LLM (${data.checks.llm.model})` : 'LLM (template mode)',
      ok: Boolean(data?.checks.llm.ok),
      title: data?.checks.llm.configured
        ? 'Ollama is configured — cover letters are generated by your local model'
        : 'No Ollama configured — cover letters use the built-in template engine',
    },
    {
      label: !data?.checks.ml.configured
        ? 'ML (optional)'
        : data.checks.ml.ok && data.checks.ml.embeddings
          ? 'ML (semantic + parsing)'
          : data?.checks.ml.ok
            ? 'ML (parsing only)'
            : 'ML (unreachable)',
      ok: Boolean(data?.checks.ml.ok),
      title: data?.checks.ml.ok
        ? data.checks.ml.embeddings
          ? `Semantic matching active (${data?.checks.ml.model ?? 'model loaded'}); PDF/DOCX parsing available`
          : 'Service is up but sentence-transformers is not installed — PDF/DOCX parsing works, semantic matching falls back to keyword scoring.'
        : 'Optional: enables embeddings + PDF parsing. Run `npm run dev:ml`.',
    },
  ];

  return (
    <div className="border-t border-white/8 px-5 py-3">
      <p className="label-micro mb-2">Services</p>
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li
            key={item.label}
            className="flex items-center gap-2 text-[11px] text-zinc-500"
            title={item.title}
          >
            <span
              className={cn('h-1.5 w-1.5 shrink-0', item.ok ? 'bg-emerald-400' : 'bg-zinc-600')}
            />
            <span className="truncate">{item.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
