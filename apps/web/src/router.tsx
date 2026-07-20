import {
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
} from '@tanstack/react-router';
import { authClient } from './lib/auth';
import RootLayout from './components/RootLayout';
import DashboardPage from './pages/Dashboard';
import PipelinePage from './pages/Pipeline';
import JobScoutPage from './pages/JobScout';
import AnalyticsPage from './pages/Analytics';
import ResumesPage from './pages/Resumes';
import LoginPage from './pages/Login';

async function requireAuth() {
  const res = await authClient.getSession();
  const session = 'data' in res ? res.data : null;
  if (!session?.user) throw redirect({ to: '/login' });
  return session;
}

const rootRoute = createRootRoute({
  component: RootLayout,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: requireAuth,
  component: DashboardPage,
});

const pipelineRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/pipeline',
  beforeLoad: requireAuth,
  component: PipelinePage,
});

const jobScoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/job-scout',
  beforeLoad: requireAuth,
  component: JobScoutPage,
});

const analyticsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/analytics',
  beforeLoad: requireAuth,
  component: AnalyticsPage,
});

const resumesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/resumes',
  beforeLoad: requireAuth,
  component: ResumesPage,
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: LoginPage,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  pipelineRoute,
  jobScoutRoute,
  analyticsRoute,
  resumesRoute,
  loginRoute,
]);

export const router = createRouter({ routeTree });
