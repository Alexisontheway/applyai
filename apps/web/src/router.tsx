import AppShell from '@/components/AppShell';
import { Button, Panel } from '@/components/ui/primitives';
import { getSessionUser } from '@/lib/auth';
import AnalyticsPage from '@/pages/Analytics';
import ApplicationsPage from '@/pages/Applications';
import CompaniesPage from '@/pages/Companies';
import DashboardPage from '@/pages/Dashboard';
import JobScoutPage from '@/pages/JobScout';
import LoginPage from '@/pages/Login';
import NotFoundPage from '@/pages/NotFound';
import PipelinePage from '@/pages/Pipeline';
import ResumesPage from '@/pages/Resumes';
import type { User } from '@applyai/shared/types';
import {
  Outlet,
  type RouterHistory,
  createRootRouteWithContext,
  createRoute,
  createRouter,
  redirect,
} from '@tanstack/react-router';

export interface RouterContext {
  auth: { user: User | null };
}

function RootLayout() {
  const { auth } = rootRoute.useRouteContext();
  return <AppShell user={auth.user ? { name: auth.user.name, email: auth.user.email } : null} />;
}

function RouteError({ error }: { error: Error }) {
  return (
    <Panel className="mx-auto mt-16 max-w-lg">
      <p className="label-micro mb-2">Unexpected error</p>
      <h1 className="text-lg font-semibold text-white">This screen failed to render</h1>
      <p className="mt-2 break-words text-sm text-zinc-400">{error.message}</p>
      <Button variant="primary" className="mt-5" onClick={() => window.location.reload()}>
        Reload the app
      </Button>
    </Panel>
  );
}

const rootRoute = createRootRouteWithContext<RouterContext>()({
  // Resolve the session once per navigation; children read it from context.
  beforeLoad: async () => ({ auth: { user: await getSessionUser() } }),
  component: RootLayout,
  errorComponent: RouteError,
  notFoundComponent: NotFoundPage,
});

const authenticated = createRoute({
  getParentRoute: () => rootRoute,
  id: 'authenticated',
  beforeLoad: ({ context }) => {
    if (!context.auth.user) throw redirect({ to: '/login' });
  },
  component: () => <Outlet />,
});

const dashboardRoute = createRoute({
  getParentRoute: () => authenticated,
  path: '/',
  component: DashboardPage,
});
const pipelineRoute = createRoute({
  getParentRoute: () => authenticated,
  path: '/pipeline',
  component: PipelinePage,
});
const applicationsRoute = createRoute({
  getParentRoute: () => authenticated,
  path: '/applications',
  component: ApplicationsPage,
});
const scoutRoute = createRoute({
  getParentRoute: () => authenticated,
  path: '/job-scout',
  component: JobScoutPage,
});
const resumesRoute = createRoute({
  getParentRoute: () => authenticated,
  path: '/resumes',
  component: ResumesPage,
});
const companiesRoute = createRoute({
  getParentRoute: () => authenticated,
  path: '/companies',
  component: CompaniesPage,
});
const analyticsRoute = createRoute({
  getParentRoute: () => authenticated,
  path: '/analytics',
  component: AnalyticsPage,
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  beforeLoad: ({ context }) => {
    if (context.auth.user) throw redirect({ to: '/' });
  },
  component: LoginPage,
});

const routeTree = rootRoute.addChildren([
  authenticated.addChildren([
    dashboardRoute,
    pipelineRoute,
    applicationsRoute,
    scoutRoute,
    resumesRoute,
    companiesRoute,
    analyticsRoute,
  ]),
  loginRoute,
]);

/**
 * The router is created through a factory so tests can drive it with a memory
 * history instead of the browser's. The app itself uses the browser history.
 */
export function createAppRouter(history?: RouterHistory) {
  return createRouter({
    routeTree,
    context: { auth: { user: null } },
    history,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
  });
}

export const router = createAppRouter();

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
