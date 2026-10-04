import { updateCompanySchema } from '@applyai/shared/schemas';
import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { db } from '../db';
import { AppError, ok } from '../lib/errors';
import { toCompany } from '../lib/serializers';
import { validate } from '../lib/validate';

export const companyRoutes = new Hono();

interface CompanyRow {
  id: string;
  name: string;
  domain: string | null;
  website: string | null;
  industry: string | null;
  size: string | null;
  glassdoor_rating: string | null;
  tech_stack: string[] | null;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
  total_jobs: number;
  total_applications: number;
  interviews: number;
  offers: number;
  avg_match: string | null;
}

function hydrate(row: CompanyRow) {
  return {
    ...toCompany({
      id: row.id,
      userId: '',
      name: row.name,
      domain: row.domain,
      website: row.website,
      industry: row.industry,
      size: row.size,
      glassdoorRating: row.glassdoor_rating,
      techStack: row.tech_stack ?? [],
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }),
    stats: {
      totalJobs: Number(row.total_jobs),
      totalApplications: Number(row.total_applications),
      interviews: Number(row.interviews),
      offers: Number(row.offers),
      avgMatchScore: row.avg_match === null ? null : Math.round(Number(row.avg_match) * 10) / 10,
    },
  };
}

const baseQuery = (userId: string) => sql`
  select c.id, c.name, c.domain, c.website, c.industry, c.size, c.glassdoor_rating,
         c.tech_stack, c.notes, c.created_at, c.updated_at,
         count(distinct j.id)::int as total_jobs,
         count(a.id)::int as total_applications,
         count(a.id) filter (where a.status in ('interview', 'offer'))::int as interviews,
         count(a.id) filter (where a.status = 'offer')::int as offers,
         avg(a.match_score) as avg_match
  from companies c
  left join jobs j on j.company_id = c.id
  left join applications a on a.job_id = j.id
  where c.user_id = ${userId}
`;

companyRoutes.get('/', async (c) => {
  const user = c.get('user');
  const result = (await db.execute(
    sql`${baseQuery(user.id)} group by c.id order by total_applications desc, c.name asc limit 200`,
  )) as unknown as { rows: CompanyRow[] };
  return ok(c, (result.rows ?? []).map(hydrate));
});

companyRoutes.get('/:id', async (c) => {
  const user = c.get('user');
  const result = (await db.execute(
    sql`${baseQuery(user.id)} and c.id = ${c.req.param('id')} group by c.id limit 1`,
  )) as unknown as { rows: CompanyRow[] };
  const company = result.rows?.[0];
  if (!company) throw AppError.notFound('Company');

  const jobResult = (await db.execute(sql`
    select j.id, j.title, j.location, j.url, j.source::text as source, j.created_at,
           j.tech_stack, a.id as application_id, a.status::text as status, a.match_score
    from jobs j
    left join applications a on a.job_id = j.id
    where j.company_id = ${company.id}
    order by j.created_at desc
    limit 100
  `)) as unknown as { rows: Array<Record<string, unknown>> };

  return ok(c, { ...hydrate(company), jobs: jobResult.rows ?? [] });
});

companyRoutes.patch('/:id', validate('json', updateCompanySchema), async (c) => {
  const user = c.get('user');
  const body = c.req.valid('json');
  const id = c.req.param('id');

  const result = (await db.execute(
    sql`select id from companies where id = ${id} and user_id = ${user.id} limit 1`,
  )) as unknown as { rows: Array<{ id: string }> };
  if (!result.rows?.[0]) throw AppError.notFound('Company');

  await db.execute(sql`
    update companies set
      notes = ${body.notes ?? null},
      industry = coalesce(${body.industry ?? null}, industry),
      size = coalesce(${body.size ?? null}, size),
      website = coalesce(${body.website ?? null}, website),
      tech_stack = coalesce(${body.techStack ? JSON.stringify(body.techStack) : null}::jsonb, tech_stack),
      updated_at = now()
    where id = ${id} and user_id = ${user.id}
  `);

  const refreshed = (await db.execute(
    sql`${baseQuery(user.id)} and c.id = ${id} group by c.id limit 1`,
  )) as unknown as { rows: CompanyRow[] };
  return ok(c, hydrate(refreshed.rows[0]));
});

companyRoutes.delete('/:id', async (c) => {
  const user = c.get('user');
  const result = (await db.execute(
    sql`delete from companies where id = ${c.req.param('id')} and user_id = ${user.id} returning id`,
  )) as unknown as { rows: Array<{ id: string }> };
  if (!result.rows?.[0]) throw AppError.notFound('Company');
  return ok(c, { deleted: true });
});
