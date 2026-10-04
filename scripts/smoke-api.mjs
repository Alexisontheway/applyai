/**
 * Live smoke test for a running API — `npm run smoke`.
 *
 * Walks the same HTTP surface the web client uses, with a real session cookie,
 * and exits non-zero if any step fails. Point it somewhere else with:
 *
 *   API_URL=https://your-deployment.example npm run smoke
 *
 * It signs up a throwaway `smoke+…@applyai.dev` account and deletes the
 * application it creates, but the account itself stays behind. That is fine on
 * a development database — do not point it at production data you care about.
 */
const BASE = process.env.API_URL ?? 'http://localhost:4000';
const WEB_ORIGIN = process.env.WEB_ORIGIN ?? 'http://localhost:5173';

let cookie = '';

function capture(response) {
  for (const entry of response.headers.getSetCookie?.() ?? []) {
    const pair = entry.split(';')[0];
    const [name] = pair.split('=');
    const existing = cookie.split('; ').filter((part) => part && !part.startsWith(`${name}=`));
    existing.push(pair);
    cookie = existing.join('; ');
  }
}

async function call(method, path, body) {
  const headers = { origin: WEB_ORIGIN };
  if (cookie) headers.cookie = cookie;
  let payload;
  if (body instanceof FormData) {
    payload = body;
  } else if (body !== undefined) {
    headers['content-type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const response = await fetch(BASE + path, { method, headers, body: payload, redirect: 'manual' });
  capture(response);
  const text = await response.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = text.slice(0, 200);
  }
  return { status: response.status, body: parsed };
}

const results = [];

function check(label, result, note) {
  const passed =
    typeof result === 'boolean' ? result : result?.status >= 200 && result?.status < 300;
  results.push({ label, passed });
  console.log(
    `${passed ? 'PASS' : 'FAIL'}  ${label}${result?.status ? ` [${result.status}]` : ''}${note ? ` — ${note}` : ''}`,
  );
}

const RESUME_TEXT = `SUMMARY
Frontend engineer with six years building React and TypeScript products.

SKILLS
TypeScript, React, Node.js, PostgreSQL, Docker, GraphQL, Playwright, accessibility, CI/CD

EXPERIENCE
Led a portal rebuild in React and TypeScript; cut bundle size 40%.
Built GraphQL services on Node.js backed by PostgreSQL.`;

const JOB_DESCRIPTION = `We need a senior frontend engineer.
Requirements: React, TypeScript, GraphQL, testing, accessibility.
Nice to have: Kubernetes, Rust.`;

async function main() {
  const email = `smoke+${Date.now()}@applyai.dev`;

  console.log(`ApplyAI smoke test against ${BASE}\n`);
  console.log('— auth —');
  const signUp = await call('POST', '/api/auth/sign-up/email', {
    email,
    password: 'smoke-password-123',
    name: 'Smoke Test',
  });
  check('sign-up', signUp, signUp.body?.user?.email);
  const session = await call('GET', '/api/auth/get-session');
  check('get-session', session, session.body?.user?.email);

  console.log('— resumes —');
  const resume = await call('POST', '/api/resumes', {
    label: 'Smoke resume',
    text: RESUME_TEXT,
    isActive: true,
  });
  const resumeId = resume.body?.data?.id;
  check('create resume', resume, `skills=${resume.body?.data?.skills?.length ?? 0}`);

  console.log('— job tracking + matching —');
  const tracked = await call('POST', '/api/jobs/track', {
    title: 'Senior Frontend Engineer',
    company: 'Smoke Labs',
    location: 'Remote',
    url: `https://example.com/jobs/${Date.now()}`,
    source: 'manual',
    description: JOB_DESCRIPTION,
    status: 'saved',
    score: true,
  });
  const applicationId = tracked.body?.data?.application?.id;
  check('track job + score', tracked, `score=${tracked.body?.data?.match?.score}`);

  const detail = await call('GET', `/api/applications/${applicationId}`);
  check('application detail', detail, `events=${detail.body?.data?.events?.length ?? 0}`);

  const rescored = await call('POST', `/api/applications/${applicationId}/score`, { resumeId });
  check('re-score', rescored, `score=${rescored.body?.data?.score}`);

  console.log('— pipeline —');
  for (const status of ['applied', 'screening', 'interview']) {
    check(
      `move → ${status}`,
      await call('PATCH', `/api/applications/${applicationId}`, { status }),
    );
  }

  console.log('— cover letter + analytics —');
  const letter = await call('POST', '/api/cover-letters', {
    applicationId,
    resumeId,
    tone: 'professional',
  });
  check('generate cover letter', letter, `engine=${letter.body?.data?.engine}`);

  const overview = await call('GET', '/api/analytics/overview');
  check(
    'analytics overview',
    overview,
    `applications=${overview.body?.data?.totals?.applications}`,
  );
  check('analytics dashboard', await call('GET', '/api/analytics/dashboard'));

  console.log('— discovery —');
  check('discovery sources', await call('GET', '/api/discovery/sources'));
  const search = await call('POST', '/api/discovery/search', {
    keywords: 'frontend engineer',
    remoteOnly: true,
    limit: 10,
    score: true,
  });
  check(
    'discovery search (needs outbound network)',
    search.status === 200,
    `jobs=${search.body?.data?.jobs?.length ?? 0} providerErrors=${search.body?.data?.errors?.length ?? 0}`,
  );

  console.log('— validation + cleanup —');
  const invalid = await call('POST', '/api/jobs/track', { title: '' });
  check('rejects invalid payload', invalid.status === 400, `status=${invalid.status}`);
  const anonymous = await fetch(`${BASE}/api/applications`).then((response) => response.status);
  check('unauthenticated request is rejected', anonymous === 401, `status=${anonymous}`);
  check('delete application', await call('DELETE', `/api/applications/${applicationId}`));

  const failed = results.filter((result) => !result.passed);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length > 0) {
    console.log(`failures: ${failed.map((result) => result.label).join('; ')}`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('\nSmoke test could not run:', error instanceof Error ? error.message : error);
  console.error(`Is the API running at ${BASE}?  (npm run dev:api)`);
  process.exitCode = 1;
});
