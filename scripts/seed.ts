/**
 * `npm run db:seed` — wipes and recreates the demo account with realistic data.
 *
 * Scores are computed by the real matching engine (not hard-coded), events are
 * back-dated so the funnel/response-time analytics mean something, and the
 * cover letters come out of the real generator.
 */
import { eq } from 'drizzle-orm';
import { auth } from '../apps/api/src/auth';
import { checkDatabase, closeDatabase, db } from '../apps/api/src/db';
import {
  applications,
  applicationsEvents,
  companies,
  coverLetters,
  jobs,
  matchResults,
  resumes,
  user,
} from '../apps/api/src/db/schema';
import { computeMatch } from '../apps/api/src/match/score';
import { extractSkillIds } from '../apps/api/src/match/skills';
import { countWords, shortId } from '../apps/api/src/match/text';
import { buildTemplateLetter, coverLetterTitle } from '../apps/api/src/services/cover-letter';
import { DEMO_USER, SEED_APPLICATIONS, SEED_JOBS, SEED_RESUMES } from './seed-data';

function daysAgo(days: number, extraHours = 0): Date {
  return new Date(Date.now() - days * 86_400_000 - extraHours * 3_600_000);
}

function isoDate(days: number): string {
  return daysAgo(days).toISOString().slice(0, 10);
}

function pick<T>(list: T[], index: number): T {
  return list[index % list.length];
}

async function main(): Promise<void> {
  const health = await checkDatabase();
  if (!health.ok) {
    console.error(`✗ Cannot reach the database: ${health.error}`);
    console.error(
      '  Start a local one with `npm run db:local`, or set DATABASE_URL in apps/api/.env.',
    );
    process.exit(1);
  }

  console.log(`▸ Seeding demo data for ${DEMO_USER.email}`);

  // Start from a clean slate for this account (cascades to all domain tables).
  await db.delete(user).where(eq(user.email, DEMO_USER.email));

  const signUp = await auth.api.signUpEmail({
    body: { email: DEMO_USER.email, password: DEMO_USER.password, name: DEMO_USER.name },
  });
  const userId = signUp.user.id;

  // ---------------------------------------------------------------- resumes
  const resumeIds = new Map<string, string>();
  for (const [index, resume] of SEED_RESUMES.entries()) {
    const id = shortId('res');
    resumeIds.set(resume.key, id);
    await db.insert(resumes).values({
      id,
      userId,
      label: resume.label,
      source: 'seed',
      parsedText: resume.text,
      skills: extractSkillIds(resume.text),
      wordCount: countWords(resume.text),
      isActive: resume.isActive,
      createdAt: daysAgo(60, -index),
      updatedAt: daysAgo(20),
    });
  }

  // ---------------------------------------------------------------- companies + jobs
  const companyIds = new Map<string, string>();
  for (const job of SEED_JOBS) {
    if (!companyIds.has(job.company)) {
      const companyId = shortId('cmp');
      companyIds.set(job.company, companyId);
      await db.insert(companies).values({
        id: companyId,
        userId,
        name: job.company,
        domain: `${job.company.toLowerCase().replace(/[^a-z]/g, '')}.com`,
        website: `https://${job.company.toLowerCase().replace(/[^a-z]/g, '')}.com`,
        industry: 'Software',
        size: pick(['11-50', '51-200', '201-500', '501-1000'], SEED_JOBS.indexOf(job)),
        techStack: [],
        createdAt: daysAgo(60),
        updatedAt: daysAgo(2),
      });
    }
  }

  const jobIds = new Map<string, string>();
  for (const job of SEED_JOBS) {
    const id = shortId('job');
    jobIds.set(job.key, id);
    await db.insert(jobs).values({
      id,
      userId,
      companyId: companyIds.get(job.company) ?? null,
      title: job.title,
      company: job.company,
      location: job.location,
      url: job.url,
      source: job.source,
      salaryMin: job.salaryMin ?? null,
      salaryMax: job.salaryMax ?? null,
      description: job.description,
      techStack: extractSkillIds(job.description)
        .slice(0, 25)
        .map((skillId) => skillId),
      postedAt: daysAgo(job.postedDaysAgo ?? 10),
      createdAt: daysAgo(job.postedDaysAgo ?? 10),
      updatedAt: daysAgo(job.postedDaysAgo ?? 10),
    });
  }

  // ---------------------------------------------------------------- applications
  let matchCount = 0;
  let letterCount = 0;

  for (const plan of SEED_APPLICATIONS) {
    const job = SEED_JOBS.find((entry) => entry.key === plan.job);
    const jobId = jobIds.get(plan.job);
    if (!job || !jobId) continue;

    const resumeKey = plan.resume;
    const resumeId = resumeKey ? (resumeIds.get(resumeKey) ?? null) : null;
    const resumeText = resumeKey
      ? (SEED_RESUMES.find((entry) => entry.key === resumeKey)?.text ?? null)
      : null;

    const applicationId = shortId('app');
    const createdAt = daysAgo(plan.createdDaysAgo, 6);
    const lastTransition = plan.history.at(-1);
    const updatedAt = lastTransition
      ? daysAgo(Math.max(0, plan.createdDaysAgo - lastTransition.daysAfter), 2)
      : createdAt;

    let score: number | null = null;
    let matchResult: ReturnType<typeof computeMatch> | null = null;
    if (resumeText) {
      matchResult = computeMatch({
        resumeText,
        jdText: job.description,
        semanticSimilarity: null,
        quick: false,
      });
      score = matchResult.score;
    }

    await db.insert(applications).values({
      id: applicationId,
      userId,
      jobId,
      status: plan.status,
      resumeId,
      matchScore: score === null ? null : score.toFixed(1),
      notes: plan.notes ?? null,
      followUpDate: plan.followUpInDays === undefined ? null : isoDate(-plan.followUpInDays),
      createdAt,
      updatedAt,
    });

    await db.insert(applicationsEvents).values({
      id: shortId('evt'),
      userId,
      applicationId,
      type: 'created',
      toStatus: 'saved',
      message: `Saved ${job.title} at ${job.company}`,
      createdAt,
    });

    let previous = 'saved' as (typeof plan.history)[number]['to'] | 'saved';
    for (const transition of plan.history) {
      await db.insert(applicationsEvents).values({
        id: shortId('evt'),
        userId,
        applicationId,
        type: 'status_changed',
        fromStatus: previous,
        toStatus: transition.to,
        message: `Moved from ${previous} to ${transition.to}`,
        createdAt: daysAgo(Math.max(0, plan.createdDaysAgo - transition.daysAfter), 1),
      });
      previous = transition.to;
    }

    if (matchResult && score !== null) {
      matchCount += 1;
      await db.insert(matchResults).values({
        id: shortId('mat'),
        userId,
        applicationId,
        resumeId,
        score: score.toFixed(1),
        matchedSkills: matchResult.matchedSkills,
        missingSkills: matchResult.missingSkills,
        breakdown: matchResult.breakdown as unknown as Record<string, unknown>,
        suggestions: matchResult.suggestions,
        summary: matchResult.summary,
        engine: matchResult.engine,
        createdAt: updatedAt,
      });

      await db.insert(applicationsEvents).values({
        id: shortId('evt'),
        userId,
        applicationId,
        type: 'scored',
        message: matchResult.summary,
        metadata: { score, engine: matchResult.engine },
        createdAt: updatedAt,
      });
    }

    // Cover letters for the applications that actually got sent.
    if (
      matchResult &&
      resumeText &&
      ['applied', 'screening', 'interview', 'offer'].includes(plan.status)
    ) {
      const letter = buildTemplateLetter({
        candidateName: DEMO_USER.name,
        candidateEmail: DEMO_USER.email,
        company: job.company,
        role: job.title,
        jobDescription: job.description,
        resumeText,
        resumeLabel: SEED_RESUMES.find((entry) => entry.key === resumeKey)?.label ?? null,
        matchedSkills: matchResult.matchedSkills,
        missingSkills: matchResult.missingSkills,
        tone: 'professional',
        instructions: null,
      });
      letterCount += 1;
      await db.insert(coverLetters).values({
        id: shortId('cl'),
        userId,
        applicationId,
        resumeId,
        title: coverLetterTitle({ role: job.title, company: job.company }),
        body: letter,
        tone: 'professional',
        engine: 'template:v1',
        createdAt: daysAgo(Math.max(0, plan.createdDaysAgo - 1)),
        updatedAt: daysAgo(Math.max(0, plan.createdDaysAgo - 1)),
      });
    }
  }

  console.log(
    `✓ ${SEED_RESUMES.length} resumes, ${SEED_JOBS.length} jobs, ${SEED_APPLICATIONS.length} applications`,
  );
  console.log(
    `✓ ${matchCount} real match scores, ${letterCount} cover letters, status history back-dated`,
  );
  console.log(`\n  Login with  ${DEMO_USER.email}  /  ${DEMO_USER.password}\n`);
}

main()
  .catch((error) => {
    console.error('seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDatabase().catch(() => undefined);
  });
