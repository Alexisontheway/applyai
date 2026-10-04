import { ToastProvider } from '@/components/ui/Toast';
import { createAppRouter } from '@/router';
import * as fixtures from '@/test/fixtures';
import { type MockRoute, setScenario } from '@/test/mock-api';
/**
 * Application smoke tests.
 *
 * They render the real route tree against canned API responses, which is the
 * closest thing to clicking through the app without a browser: if a page
 * crashes, loses its data contract or stops rendering its content, this fails.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryHistory } from '@tanstack/react-router';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

function scenario(overrides: Record<string, MockRoute> = {}, signedIn = true): void {
  const routes: Record<string, MockRoute> = {
    'GET /api/auth/get-session': {
      body: signedIn ? fixtures.session : { session: null, user: null },
    },
    'GET /api/health/deep': { body: { success: true, data: fixtures.health } },
    'GET /api/analytics/dashboard': { body: { success: true, data: fixtures.dashboard } },
    'GET /api/analytics/overview': { body: { success: true, data: fixtures.overview } },
    'GET /api/applications': { body: { success: true, data: fixtures.applications } },
    'GET /api/applications/app_1': { body: { success: true, data: fixtures.applicationDetail } },
    'GET /api/resumes': { body: { success: true, data: fixtures.resumes } },
    'GET /api/companies': { body: { success: true, data: fixtures.companies } },
    'GET /api/companies/cmp_1': { body: { success: true, data: fixtures.companyDetail } },
    'GET /api/cover-letters': { body: { success: true, data: fixtures.coverLetters } },
    'GET /api/discovery/sources': { body: { success: true, data: fixtures.sources } },
    'GET /api/jobs': { body: { success: true, data: fixtures.jobsPage } },
    ...overrides,
  };

  setScenario(routes);
}

function renderApp(path: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  const router = createAppRouter(createMemoryHistory({ initialEntries: [path] }));
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  scenario();
});

describe('auth gating', () => {
  it('sends a signed-out visitor to the login screen', async () => {
    scenario({}, false);
    renderApp('/');
    expect(await screen.findByRole('button', { name: /sign in/i })).toBeInTheDocument();
    expect(screen.getByText(/demo@applyai.dev/i)).toBeInTheDocument();
  });

  it('signs in from the login screen and lands on the dashboard', async () => {
    let signedIn = false;
    scenario(
      {
        'GET /api/auth/get-session': {
          bodyFn: () => (signedIn ? fixtures.session : { session: null, user: null }),
        },
        'POST /api/auth/sign-in/email': {
          bodyFn: () => {
            signedIn = true;
            return { token: 'session-token', user: fixtures.session.user };
          },
        },
      },
      false,
    );

    const user = userEvent.setup();
    renderApp('/');

    // The demo shortcut fills the credentials, then one click signs in.
    await user.click(await screen.findByRole('button', { name: /seeded demo account/i }));
    expect(screen.getByLabelText(/email/i)).toHaveValue('demo@applyai.dev');
    expect(screen.getByLabelText(/password/i)).toHaveValue('demo1234');
    await user.click(screen.getByRole('button', { name: /^sign in$/i }));

    expect(await screen.findByText('65%')).toBeInTheDocument();
    expect(screen.getByRole('navigation')).toBeInTheDocument();
  });

  it('shows the app shell with every destination for a signed-in user', async () => {
    renderApp('/');
    const nav = await screen.findByRole('navigation');
    for (const label of [
      'Dashboard',
      'Pipeline',
      'Applications',
      'Job Scout',
      'Resumes',
      'Companies',
      'Analytics',
    ]) {
      expect(within(nav).getByRole('link', { name: label })).toBeInTheDocument();
    }
  });
});

describe('pages render real API data', () => {
  it('dashboard shows the numbers from the summary endpoint', async () => {
    renderApp('/');
    expect(await screen.findByText('65%')).toBeInTheDocument();
    expect(screen.getByText(/Platform Engineer \(Kubernetes\)/)).toBeInTheDocument();
    expect(screen.getAllByText(/Machine Learning Engineer — NLP/).length).toBeGreaterThan(0);
  });

  it('pipeline renders each stage as a column', async () => {
    renderApp('/pipeline');
    for (const stage of [
      'Saved',
      'Applied',
      'Screening',
      'Interview',
      'Offer',
      'Rejected',
      'Ghosted',
    ]) {
      expect(await screen.findByRole('heading', { name: stage })).toBeInTheDocument();
    }
    expect(screen.getByText('Data Engineer')).toBeInTheDocument();
  });

  it('applications table lists roles, statuses and scores', async () => {
    renderApp('/applications');
    expect(await screen.findByText('Data Engineer')).toBeInTheDocument();
    expect(screen.getByText('Ledgerly')).toBeInTheDocument();
    expect(screen.getByText(/84%/)).toBeInTheDocument();
    expect(screen.getByText(/21d ago/)).toBeInTheDocument();
  });

  it('resumes page shows skills and performance per resume', async () => {
    renderApp('/resumes');
    expect(await screen.findByText(/Full-stack — React \/ Node \(primary\)/)).toBeInTheDocument();
    expect(screen.getByText('TypeScript')).toBeInTheDocument();
    expect(screen.getAllByText(/Interview rate/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Platform Engineer — Runway Cloud/)).toBeInTheDocument();
  });

  it('analytics page renders funnel, sources and resume performance', async () => {
    renderApp('/analytics');
    expect(await screen.findByText('Pipeline funnel')).toBeInTheDocument();
    expect(screen.getByText('Source ROI')).toBeInTheDocument();
    expect(screen.getByText('Resume performance')).toBeInTheDocument();
    expect(screen.getByText('Greenhouse')).toBeInTheDocument();
    expect(screen.getAllByText(/66\.7%/).length).toBeGreaterThan(0);
  });

  it('job scout renders the search form and source chips', async () => {
    renderApp('/job-scout');
    expect(await screen.findByRole('button', { name: /discover/i })).toBeInTheDocument();
    expect(await screen.findByText(/Greenhouse boards/)).toBeInTheDocument();
    expect(screen.getAllByText(/Remotive/).length).toBeGreaterThan(0);
  });

  it('companies page lists a company and its tracked postings', async () => {
    renderApp('/companies');
    expect(await screen.findByText('Runway Cloud')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByText(/Their postings you have tracked/)).toBeInTheDocument(),
    );
    expect(screen.getByText('Platform Engineer (Kubernetes)')).toBeInTheDocument();
  });
});

describe('failure handling', () => {
  it('shows an error banner instead of a blank page when the API fails', async () => {
    scenario({
      'GET /api/analytics/dashboard': {
        status: 500,
        body: { success: false, error: 'Database is down' },
      },
    });
    renderApp('/');
    expect(await screen.findByText(/Could not load your dashboard/)).toBeInTheDocument();
    expect(screen.getByText(/Database is down/)).toBeInTheDocument();
  });
});
