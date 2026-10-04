import {
  ACTIVE_STATUSES,
  APPLICATION_STATUSES,
  type ApplicationStatus,
} from '@applyai/shared/schemas';
import { type SkillCategory, getSkill } from '@applyai/shared/skills';
import type { AnalyticsOverview, DashboardSummary, FunnelStep } from '@applyai/shared/types';
/**
 * Analytics are computed in the database, not in the browser.
 *
 * The original scaffold shipped raw rows to the client and recalculated the
 * funnel there — which silently disagrees with the server as soon as a filter
 * or a page limit is involved. These queries are the single source of truth.
 */
import { sql } from 'drizzle-orm';
import { db } from '../db';

async function query<T>(statement: ReturnType<typeof sql>): Promise<T[]> {
  const result = (await db.execute(statement)) as unknown as { rows: T[] };
  return result.rows ?? [];
}

const STATUS_LABELS: Record<ApplicationStatus, string> = {
  saved: 'Saved',
  applied: 'Applied',
  screening: 'Screening',
  interview: 'Interview',
  offer: 'Offer',
  rejected: 'Rejected',
  ghosted: 'Ghosted',
};

function ratio(part: number, whole: number): number | null {
  if (whole <= 0) return null;
  return Math.round((part / whole) * 1000) / 10;
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

interface StatusCountRow {
  status: ApplicationStatus;
  count: number;
}

async function statusCounts(userId: string): Promise<Record<ApplicationStatus, number>> {
  const rows = await query<StatusCountRow>(sql`
    select status::text as status, count(*)::int as count
    from applications
    where user_id = ${userId}
    group by status
  `);
  const counts = Object.fromEntries(APPLICATION_STATUSES.map((status) => [status, 0])) as Record<
    ApplicationStatus,
    number
  >;
  for (const row of rows) counts[row.status] = Number(row.count);
  return counts;
}

async function topMissingSkills(
  userId: string,
  limit = 8,
  days = 90,
): Promise<Array<{ id: string; label: string; count: number; category: SkillCategory | null }>> {
  const rows = await query<{ id: string; label: string; count: number }>(sql`
    select elem->>'id' as id, elem->>'label' as label, count(*)::int as count
    from match_results m, jsonb_array_elements(m.missing_skills) elem
    where m.user_id = ${userId}
      and m.created_at > now() - (${days}::text || ' days')::interval
    group by 1, 2
    order by count desc, label asc
    limit ${limit}
  `);
  return rows.map((row) => ({
    id: row.id,
    label: row.label,
    count: Number(row.count),
    category: (getSkill(row.id)?.category ?? null) as SkillCategory | null,
  }));
}

export async function getAnalyticsOverview(userId: string): Promise<AnalyticsOverview> {
  const counts = await statusCounts(userId);
  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
  const applied = total - counts.saved;
  const interviews = counts.interview + counts.offer;
  const offers = counts.offer;
  const responded = counts.screening + counts.interview + counts.offer + counts.rejected;

  const funnel: FunnelStep[] = APPLICATION_STATUSES.map((status) => ({
    status,
    label: STATUS_LABELS[status],
    count: counts[status],
  }));

  const timingRows = await query<{
    avg_first_response_days: unknown;
    avg_days_to_interview: unknown;
  }>(sql`
    with first_response as (
      select e.application_id,
             min(e.created_at) as responded_at,
             a.created_at as applied_at
      from application_events e
      join applications a on a.id = e.application_id
      where e.user_id = ${userId}
        and e.type = 'status_changed'
        and e.to_status is not null
        and e.to_status <> 'saved'
      group by e.application_id, a.created_at
    ),
    first_interview as (
      select e.application_id, min(e.created_at) as interview_at, a.created_at as applied_at
      from application_events e
      join applications a on a.id = e.application_id
      where e.user_id = ${userId}
        and e.type = 'status_changed'
        and e.to_status in ('interview', 'offer')
      group by e.application_id, a.created_at
    )
    select
      (select avg(extract(epoch from (responded_at - applied_at)) / 86400) from first_response) as avg_first_response_days,
      (select avg(extract(epoch from (interview_at - applied_at)) / 86400) from first_interview) as avg_days_to_interview
  `);

  const stageRows = await query<{ avg_days: unknown }>(sql`
    select avg(extract(epoch from (now() - updated_at)) / 86400) as avg_days
    from applications
    where user_id = ${userId} and status in ('applied', 'screening', 'interview', 'offer')
  `);

  const sourceRows = await query<{
    source: string;
    applications: number;
    responded: number;
    interviews: number;
    offers: number;
    avg_match: unknown;
  }>(sql`
    select j.source::text as source,
           count(*)::int as applications,
           count(*) filter (where a.status in ('screening', 'interview', 'offer', 'rejected'))::int as responded,
           count(*) filter (where a.status in ('interview', 'offer'))::int as interviews,
           count(*) filter (where a.status = 'offer')::int as offers,
           avg(a.match_score) as avg_match
    from applications a
    join jobs j on j.id = a.job_id
    where a.user_id = ${userId}
    group by 1
    order by applications desc
  `);

  const resumeRows = await query<{
    resume_id: string;
    label: string;
    applications: number;
    interviews: number;
    offers: number;
    avg_match: unknown;
  }>(sql`
    select r.id as resume_id,
           r.label as label,
           count(a.id)::int as applications,
           count(a.id) filter (where a.status in ('interview', 'offer'))::int as interviews,
           count(a.id) filter (where a.status = 'offer')::int as offers,
           avg(a.match_score) as avg_match
    from resumes r
    left join applications a on a.resume_id = r.id
    where r.user_id = ${userId}
    group by 1, 2
    order by applications desc, r.created_at desc
  `);

  const bucketRows = await query<{ bucket: string; applications: number; interviews: number }>(sql`
    select
      case
        when a.match_score is null then 'unscored'
        when a.match_score < 50 then 'under 50'
        when a.match_score < 65 then '50-64'
        when a.match_score < 80 then '65-79'
        else '80+'
      end as bucket,
      count(*)::int as applications,
      count(*) filter (where a.status in ('interview', 'offer'))::int as interviews
    from applications a
    where a.user_id = ${userId}
    group by 1
  `);

  const bucketOrder = ['under 50', '50-64', '65-79', '80+', 'unscored'];
  const bucketMap = new Map(bucketRows.map((row) => [row.bucket, row]));

  const weeklyRows = await query<{ week: string; applications: number; interviews: number }>(sql`
    with weeks as (
      select generate_series(
        date_trunc('week', now()) - interval '7 weeks',
        date_trunc('week', now()),
        interval '1 week'
      ) as week
    )
    select
      to_char(w.week, 'YYYY-MM-DD') as week,
      (select count(*)::int from applications a
        where a.user_id = ${userId}
          and a.created_at >= w.week and a.created_at < w.week + interval '1 week') as applications,
      (select count(distinct e.application_id)::int from application_events e
        where e.user_id = ${userId}
          and e.to_status in ('interview', 'offer')
          and e.created_at >= w.week and e.created_at < w.week + interval '1 week') as interviews
    from weeks w
    order by w.week
  `);

  return {
    totals: {
      applications: total,
      active: counts.applied + counts.screening + counts.interview,
      applied,
      interviews,
      offers,
      rejected: counts.rejected,
    },
    rates: {
      responseRate: ratio(responded, applied),
      interviewRate: ratio(interviews, applied),
      offerRate: ratio(offers, Math.max(1, interviews)),
    },
    timing: {
      avgFirstResponseDays: round1(toNumber(timingRows[0]?.avg_first_response_days)),
      avgDaysToInterview: round1(toNumber(timingRows[0]?.avg_days_to_interview)),
      avgDaysInCurrentStage: round1(toNumber(stageRows[0]?.avg_days)),
    },
    funnel,
    sources: sourceRows.map((row) => ({
      source: row.source as AnalyticsOverview['sources'][number]['source'],
      applications: Number(row.applications),
      responded: Number(row.responded),
      interviews: Number(row.interviews),
      offers: Number(row.offers),
      responseRate: ratio(Number(row.responded), Number(row.applications)),
      avgMatchScore: round1(toNumber(row.avg_match)),
    })),
    resumes: resumeRows.map((row) => ({
      resumeId: row.resume_id,
      label: row.label,
      applications: Number(row.applications),
      interviews: Number(row.interviews),
      offers: Number(row.offers),
      avgMatchScore: round1(toNumber(row.avg_match)),
      interviewRate: ratio(Number(row.interviews), Number(row.applications)),
    })),
    matchBuckets: bucketOrder.map((bucket) => {
      const row = bucketMap.get(bucket);
      const applications = row ? Number(row.applications) : 0;
      const interviews = row ? Number(row.interviews) : 0;
      return {
        label: bucket,
        applications,
        interviews,
        interviewRate: ratio(interviews, applications),
      };
    }),
    weekly: weeklyRows.map((row) => ({
      week: row.week,
      applications: Number(row.applications),
      interviews: Number(row.interviews),
    })),
    topMissingSkills: await topMissingSkills(userId, 10),
  };
}

function round1(value: number | null): number | null {
  return value === null ? null : Math.round(value * 10) / 10;
}

export async function getDashboardSummary(userId: string): Promise<DashboardSummary> {
  const counts = await statusCounts(userId);
  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
  const applied = total - counts.saved;
  const responded = counts.screening + counts.interview + counts.offer + counts.rejected;

  const statsRows = await query<{
    avg_match: unknown;
    interviews_30d: number;
    new_this_week: number;
  }>(sql`
    select
      (select avg(match_score) from applications where user_id = ${userId}) as avg_match,
      (select count(distinct e.application_id)::int from application_events e
        where e.user_id = ${userId} and e.to_status in ('interview', 'offer')
          and e.created_at > now() - interval '30 days') as interviews_30d,
      (select count(*)::int from applications
        where user_id = ${userId} and created_at > now() - interval '7 days') as new_this_week
  `);

  const followUpRows = await query<{
    application_id: string;
    role: string;
    company: string;
    status: ApplicationStatus;
    follow_up_date: string;
  }>(sql`
    select a.id as application_id, j.title as role, j.company as company,
           a.status::text as status, to_char(a.follow_up_date, 'YYYY-MM-DD') as follow_up_date
    from applications a
    join jobs j on j.id = a.job_id
    where a.user_id = ${userId}
      and a.follow_up_date is not null
      and a.status in ('saved', 'applied', 'screening', 'interview')
      and a.follow_up_date < now() + interval '30 days'
    order by a.follow_up_date asc
    limit 12
  `);

  const staleRows = await query<{
    application_id: string;
    role: string;
    company: string;
    status: ApplicationStatus;
    days: unknown;
  }>(sql`
    select a.id as application_id, j.title as role, j.company as company, a.status::text as status,
           extract(epoch from (now() - a.updated_at)) / 86400 as days
    from applications a
    join jobs j on j.id = a.job_id
    where a.user_id = ${userId}
      and a.status in ('applied', 'screening', 'interview')
      and a.updated_at < now() - interval '14 days'
    order by a.updated_at asc
    limit 8
  `);

  const eventRows = await query<{
    id: string;
    type: DashboardSummary['recentEvents'][number]['type'];
    from_status: ApplicationStatus | null;
    to_status: ApplicationStatus | null;
    message: string | null;
    created_at: string;
    application_id: string;
    role: string;
    company: string;
  }>(sql`
    select e.id, e.type::text as type, e.from_status::text as from_status, e.to_status::text as to_status,
           e.message, e.created_at, e.application_id, j.title as role, j.company as company
    from application_events e
    join applications a on a.id = e.application_id
    join jobs j on j.id = a.job_id
    where e.user_id = ${userId}
    order by e.created_at desc
    limit 12
  `);

  const topMatchRows = await query<{
    application_id: string;
    role: string;
    company: string;
    status: ApplicationStatus;
    match_score: unknown;
  }>(sql`
    select a.id as application_id, j.title as role, j.company as company, a.status::text as status,
           a.match_score as match_score
    from applications a
    join jobs j on j.id = a.job_id
    where a.user_id = ${userId}
      and a.match_score is not null
      and a.status not in ('rejected', 'ghosted')
    order by a.match_score desc, a.created_at desc
    limit 5
  `);

  const resumeRows = await query<{ id: string; label: string; skills: string[] }>(sql`
    select id, label, coalesce(skills, '[]'::jsonb) as skills
    from resumes
    where user_id = ${userId} and is_active = true
    limit 1
  `);

  const now = Date.now();
  return {
    counts,
    stats: {
      totalApplications: total,
      activeApplications: counts.applied + counts.screening + counts.interview,
      interviews: counts.interview + counts.offer,
      offers: counts.offer,
      interviewsLast30Days: Number(statsRows[0]?.interviews_30d ?? 0),
      newThisWeek: Number(statsRows[0]?.new_this_week ?? 0),
      avgMatchScore: round1(toNumber(statsRows[0]?.avg_match)),
      responseRate: ratio(responded, applied),
    },
    followUps: followUpRows.map((row) => {
      const due = new Date(`${row.follow_up_date}T00:00:00Z`).getTime();
      const daysUntil = Math.round((due - now) / 86_400_000);
      return {
        applicationId: row.application_id,
        role: row.role,
        company: row.company,
        status: row.status,
        followUpDate: row.follow_up_date,
        overdue: daysUntil < 0,
        daysUntil,
      };
    }),
    stale: staleRows.map((row) => ({
      applicationId: row.application_id,
      role: row.role,
      company: row.company,
      status: row.status,
      daysSinceUpdate: Math.round(toNumber(row.days) ?? 0),
    })),
    recentEvents: eventRows.map((row) => ({
      id: row.id,
      type: row.type,
      fromStatus: row.from_status,
      toStatus: row.to_status,
      message: row.message,
      createdAt: new Date(row.created_at).toISOString(),
      applicationId: row.application_id,
      role: row.role,
      company: row.company,
    })),
    topMatches: topMatchRows.map((row) => ({
      applicationId: row.application_id,
      role: row.role,
      company: row.company,
      status: row.status,
      matchScore: round1(toNumber(row.match_score)) ?? 0,
    })),
    activeResume: resumeRows[0]
      ? { id: resumeRows[0].id, label: resumeRows[0].label, skills: resumeRows[0].skills ?? [] }
      : null,
    resumeGaps: (await topMissingSkills(userId, 5)).map(({ id, label, count }) => ({
      id,
      label,
      count,
    })),
  };
}

export const ACTIVE_APPLICATION_STATUSES = ACTIVE_STATUSES;
