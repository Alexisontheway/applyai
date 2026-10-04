import { describe, expect, it, vi } from 'vitest';
import { assertSafeUrl, importJobFromUrl } from './importer';

const JSON_LD_PAGE = `<!doctype html>
<html><head>
<title>Senior Platform Engineer | Acme Cloud</title>
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "JobPosting",
  "title": "Senior Platform Engineer",
  "datePosted": "2026-09-20",
  "description": "<p>We run Kubernetes and Terraform. You will own our deploy pipeline, work with Go and PostgreSQL, and mentor engineers. Experience with observability tooling and incident response is a plus. You will partner with product teams, review designs, and keep our platform boring and predictable.</p>",
  "hiringOrganization": { "@type": "Organization", "name": "Acme Cloud" },
  "jobLocation": {
    "@type": "Place",
    "address": { "@type": "PostalAddress", "addressLocality": "Berlin", "addressCountry": "Germany" }
  },
  "baseSalary": {
    "@type": "MonetaryAmount",
    "currency": "EUR",
    "value": { "@type": "QuantitativeValue", "minValue": 80000, "maxValue": 110000, "unitText": "YEAR" }
  }
}
</script>
</head><body><h1>Senior Platform Engineer</h1></body></html>`;

function fakeFetch(html: string, init?: { status?: number }) {
  return vi.fn(async () => {
    if (init?.status && init.status >= 400) {
      return new Response('nope', { status: init.status, statusText: 'Not Found' });
    }
    return new Response(html, { status: 200, headers: { 'content-type': 'text/html' } });
  }) as unknown as typeof fetch;
}

describe('assertSafeUrl', () => {
  it('accepts public http(s) URLs', () => {
    expect(assertSafeUrl('https://jobs.example.com/role/1').hostname).toBe('jobs.example.com');
  });

  it('refuses non-http protocols and internal hosts', () => {
    expect(() => assertSafeUrl('file:///etc/passwd')).toThrow(/http/i);
    expect(() => assertSafeUrl('http://localhost:4000/api')).toThrow(/not reachable/i);
    expect(() => assertSafeUrl('http://169.254.169.254/latest/meta-data')).toThrow(
      /not reachable/i,
    );
    expect(() => assertSafeUrl('http://db.internal/job')).toThrow(/not reachable/i);
    expect(() => assertSafeUrl('nonsense')).toThrow(/valid URL/i);
  });
});

describe('importJobFromUrl', () => {
  it('reads a structured JobPosting and reports no warnings', async () => {
    const draft = await importJobFromUrl('https://boards.example.com/acme/jobs/1', {
      fetchImpl: fakeFetch(JSON_LD_PAGE),
    });

    expect(draft.title).toBe('Senior Platform Engineer');
    expect(draft.company).toBe('Acme Cloud');
    expect(draft.location).toContain('Berlin');
    expect(draft.source).toBe('import');
    expect(draft.url).toBe('https://boards.example.com/acme/jobs/1');
    expect(draft.salaryMin).toBe(80000);
    expect(draft.salaryMax).toBe(110000);
    expect(draft.techStack).toEqual(expect.arrayContaining(['Kubernetes', 'Go', 'PostgreSQL']));
    expect(draft.warnings).toEqual([]);
  });

  it('falls back to page metadata and warns about it', async () => {
    const html = `<html><head>
      <meta property="og:title" content="Backend Engineer" />
      <meta property="og:site_name" content="Northwind" />
    </head><body><h1>Backend Engineer</h1><p>${'We build APIs in Go and PostgreSQL. '.repeat(20)}</p></body></html>`;

    const draft = await importJobFromUrl('https://northwind.example/careers/1', {
      fetchImpl: fakeFetch(html),
    });
    expect(draft.title).toBe('Backend Engineer');
    expect(draft.company).toBe('Northwind');
    expect(draft.warnings.join(' ')).toMatch(/structured job data|inferred/i);
  });

  it('turns transport failures into an actionable message', async () => {
    const failing = vi.fn(async () => {
      throw new TypeError('fetch failed');
    }) as unknown as typeof fetch;

    await expect(
      importJobFromUrl('https://unreachable.example/jobs/1', { fetchImpl: failing }),
    ).rejects.toThrow(/add the job manually/i);
  });

  it('surfaces the HTTP status when the posting is gone', async () => {
    await expect(
      importJobFromUrl('https://boards.example.com/gone/1', {
        fetchImpl: fakeFetch('', { status: 404 }),
      }),
    ).rejects.toThrow(/404/);
  });

  it('refuses a page with no job title', async () => {
    const empty = '<html><head></head><body><p>Nothing here</p></body></html>';
    await expect(
      importJobFromUrl('https://example.com/random', { fetchImpl: fakeFetch(empty) }),
    ).rejects.toThrow(/manually|title/i);
  });
});
