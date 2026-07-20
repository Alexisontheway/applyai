import { Outlet, Link, useLocation, useRouter } from '@tanstack/react-router';
import { authClient } from '../lib/auth';
import { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  Kanban,
  Search,
  BarChart3,
  FileText,
  LogOut,
} from 'lucide-react';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/pipeline', label: 'Pipeline', icon: Kanban },
  { href: '/job-scout', label: 'Job Scout', icon: Search },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/resumes', label: 'Resumes', icon: FileText },
];

export default function RootLayout() {
  const location = useLocation();
  const router = useRouter();
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);

  useEffect(() => {
    authClient.getSession().then((res) => {
      if ('data' in res && res.data?.user) {
        setUser({ name: res.data.user.name, email: res.data.user.email });
      }
    });
  }, []);

  const handleLogout = async () => {
    await authClient.signOut();
    router.invalidate();
  };

  const isLoginPage = location.pathname === '/login';

  if (isLoginPage) return <Outlet />;

  return (
    <div className="flex h-screen bg-dark-900">
      {/* Sidebar */}
      <aside className="w-64 border-r border-neon/10 bg-dark-800/50 flex flex-col">
        <div className="p-6 border-b border-neon/10">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-neon text-dark-900 flex items-center justify-center font-bold text-sm">
              A
            </div>
            <span className="text-white font-semibold tracking-tight">ApplyAI</span>
          </Link>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map(({ href, label, icon: Icon }) => {
            const isActive = location.pathname === href;
            return (
              <Link
                key={href}
                to={href}
                className={`flex items-center gap-3 px-4 py-2.5 text-sm rounded transition-all duration-200 ${
                  isActive
                    ? 'bg-neon/10 text-neon border border-neon/20'
                    : 'text-gray-400 hover:text-white hover:bg-dark-700/50'
                }`}
              >
                <Icon size={16} />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-neon/10">
          {user && (
            <div className="flex items-center gap-3 mb-3 px-2">
              <div className="w-8 h-8 rounded-full bg-neon/20 flex items-center justify-center text-neon text-xs font-bold">
                {user.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm truncate">{user.name}</p>
                <p className="text-gray-500 text-xs truncate">{user.email}</p>
              </div>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-400 hover:text-red-400 hover:bg-red-500/5 rounded transition-all"
          >
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto p-8">
        <Outlet />
      </main>
    </div>
  );
}
