/**
 * Demo content for `npm run db:seed`.
 *
 * The point is a database that behaves like a real job search: resumes with
 * real skill density, postings with requirement sections the matcher can read,
 * and applications with a status history spread over weeks so the analytics
 * are not all zeroes.
 */

export interface SeedResume {
  key: string;
  label: string;
  isActive: boolean;
  text: string;
}

export interface SeedJob {
  key: string;
  title: string;
  company: string;
  location: string;
  source:
    | 'greenhouse'
    | 'lever'
    | 'ashby'
    | 'remotive'
    | 'remoteok'
    | 'arbeitnow'
    | 'manual'
    | 'import';
  url: string;
  salaryMin?: number;
  salaryMax?: number;
  postedDaysAgo?: number;
  description: string;
}

export interface SeedApplication {
  job: string;
  resume: string | null;
  status: 'saved' | 'applied' | 'screening' | 'interview' | 'offer' | 'rejected' | 'ghosted';
  createdDaysAgo: number;
  /** Ordered status transitions with how long after creation they happened. */
  history: Array<{ to: SeedApplication['status']; daysAfter: number }>;
  followUpInDays?: number;
  notes?: string;
}

export const SEED_RESUMES: SeedResume[] = [
  {
    key: 'fullstack',
    label: 'Full-stack — React / Node (primary)',
    isActive: true,
    text: `Priyanshu Pramanik
Full-stack Engineer — Bengaluru, India (remote-friendly)
priyanshu@example.com · github.com/example

SUMMARY
Full-stack engineer with 4 years building product surfaces on TypeScript, React and Node.js.
Comfortable owning a feature from database schema to UI, including migrations, API design and
front-end performance work. Shipped to production for B2B SaaS with ~40k monthly active users.

SKILLS
Languages: TypeScript, JavaScript, Python, SQL, Bash
Frontend: React, Next.js, TanStack Query, Tailwind CSS, Redux, accessibility (a11y), web performance
Backend: Node.js, Hono, Express, REST APIs, GraphQL, WebSockets, Zod, auth & sessions (OAuth)
Databases: PostgreSQL, Redis, Drizzle ORM, data modelling, query optimisation
Infrastructure: Docker, AWS (EC2, S3, Lambda), GitHub Actions, CI/CD, observability (Grafana, Sentry)
Testing: Vitest, Playwright, unit testing, integration testing, TDD
Ways of working: code reviews, mentoring, technical writing, cross functional collaboration

EXPERIENCE
Senior Software Engineer — Ledgerly (2024 - present)
- Rebuilt the reporting UI in React + TypeScript, cutting time-to-interactive from 4.2s to 1.1s (Lighthouse 62 -> 94).
- Designed a Postgres schema and Drizzle migrations for a multi-tenant billing module; wrote the query-level tests that kept p95 latency under 120ms at 3M rows.
- Added WebSocket based live updates so finance teams see invoice state changes without a refresh.
- Introduced Vitest + Playwright coverage gates in GitHub Actions; regressions reaching staging dropped by roughly 60%.

Software Engineer — Cobalt Systems (2022 - 2024)
- Built customer-facing dashboards in Next.js and Node.js REST APIs serving 40k MAU.
- Migrated a legacy Express service to Hono with Zod validation, removing ~2k lines of hand-rolled parsing.
- Containerised the stack with Docker and moved releases to a CI/CD pipeline with zero-downtime deploys on AWS.
- Mentored two interns; ran the frontend guild and wrote the component accessibility checklist.

PROJECTS
ApplyAI — open-source job search co-pilot (React, Node.js, PostgreSQL, Docker)
- Personal project: kanban pipeline, resume matching engine and analytics on top of a Hono API.

EDUCATION
B.Tech, Computer Science — 2022`,
  },
  {
    key: 'ml',
    label: 'ML / Data — Python focus',
    isActive: false,
    text: `Priyanshu Pramanik
Machine Learning Engineer — Bengaluru, India

SUMMARY
ML engineer focused on applied NLP and recommendation systems. Two years turning research-grade
models into services that product teams actually ship, with a bias for evaluation you can defend.

SKILLS
Languages: Python, SQL, TypeScript
ML: PyTorch, scikit-learn, TensorFlow, NLP, transformers, LLMs, prompt engineering, RAG,
    fine-tuning, model evaluation, cross validation
Data: pandas, NumPy, Spark (PySpark), Airflow, dbt, data pipelines, Snowflake, data warehousing
Vector search: FAISS, pgvector, embeddings
MLOps: Docker, model deployment, MLflow, model monitoring, AWS SageMaker
Analytics: A/B testing, statistics, experimentation, BI dashboards (Metabase)

EXPERIENCE
Machine Learning Engineer — Vector Health (2023 - present)
- Built a clinical note classifier (PyTorch + transformers) that triaged 12k notes/day at 0.91 F1, replacing a rule engine with 0.74 recall.
- Shipped a retrieval augmented generation (RAG) assistant over 400k internal documents using pgvector; answer grounding improved by 34% in blinded review.
- Designed the offline evaluation harness (stratified splits, per-segment metrics) that the team now uses for every model release.
- Cut inference cost 45% by distilling the classifier and batching requests behind a FastAPI service.

Data Analyst — Brightpath (2021 - 2023)
- Wrote the SQL and dbt models behind the executive funnel dashboard; reduced reporting turnaround from 3 days to 4 hours.
- Ran the first A/B tests on the onboarding flow, lifting activation 8%.

PROJECTS
Resume-JD semantic matcher — sentence transformers + skill taxonomy, served over FastAPI.

EDUCATION
B.Tech, Computer Science — 2022`,
  },
  {
    key: 'platform',
    label: 'Platform / DevOps — AWS + Kubernetes',
    isActive: false,
    text: `Priyanshu Pramanik
Platform Engineer — Bengaluru, India

SUMMARY
Platform engineer who makes deployments boring. Four years across Linux, Kubernetes and AWS,
with a strong testing and observability habit.

SKILLS
Cloud: AWS (EC2, S3, Lambda, EKS, RDS, CloudWatch), infrastructure as code (Terraform), serverless
Containers: Docker, Kubernetes (EKS), Helm, container security
Delivery: CI/CD (GitHub Actions, Jenkins), trunk-based development, release automation
Operations: observability (Prometheus, Grafana, OpenTelemetry), incident response, SRE practices,
    on-call, SLOs, load testing (k6), performance engineering
Languages: Go, Python, Bash, SQL
Databases: PostgreSQL, Redis, query optimisation, backup and restore drills
Security: identity and access management (IAM), RBAC, zero trust, vulnerability assessment

EXPERIENCE
Platform Engineer — Runway Cloud (2023 - present)
- Migrated 40 services from hand-managed EC2 to Kubernetes (EKS) with Helm charts and Terraform modules; deploy lead time went from 2 days to 25 minutes.
- Built the golden CI/CD pipeline (GitHub Actions) used by every team; container image build + scan + deploy in under 6 minutes.
- Introduced SLIs/SLOs and OpenTelemetry tracing; mean time to detect for the top five incidents dropped from 22 to 4 minutes.
- Ran quarterly restore drills for PostgreSQL; the first drill found a 9-hour recovery gap that is now under 30 minutes.

DevOps Engineer — Northwind Labs (2022 - 2023)
- Automated provisioning with Terraform and cut environment setup from a day of manual steps to one command.
- Set up Grafana dashboards and alert routing that reduced noisy pages by 70%.

EDUCATION
B.Tech, Computer Science — 2022`,
  },
];

const REQ = (lines: string[]) => lines.join('\n');

export const SEED_JOBS: SeedJob[] = [
  {
    key: 'northwind-frontend',
    title: 'Senior Frontend Engineer',
    company: 'Northwind Labs',
    location: 'Remote (EU/IN)',
    source: 'greenhouse',
    url: 'https://boards.greenhouse.io/northwindlabs/jobs/4001',
    salaryMin: 2800000,
    salaryMax: 4200000,
    postedDaysAgo: 4,
    description: REQ([
      'Senior Frontend Engineer — Design Systems',
      '',
      'About the role',
      'You will own the component library and the product surfaces that thousands of operations teams use daily. You will work with designers from the first sketch to the shipped release.',
      '',
      'Requirements',
      '- 4+ years building production React applications in TypeScript.',
      '- Deep CSS knowledge and experience with Tailwind CSS or a similar utility-first system.',
      '- Track record of improving web performance: Core Web Vitals, bundle budgets, Lighthouse.',
      '- Accessibility (a11y) is not an afterthought for you: WCAG, keyboard navigation, screen readers.',
      '- Comfortable writing unit and integration tests (Vitest, Testing Library, Playwright).',
      '- Experience maintaining a design system or component library used by other engineers.',
      '',
      'Nice to have',
      '- Next.js and server components.',
      '- Storybook and visual regression testing.',
      '- Experience with GraphQL clients.',
      '',
      'Responsibilities',
      '- Ship accessible, fast interfaces in React and Next.js.',
      '- Review pull requests and mentor mid-level engineers.',
      '- Partner with product and design to shape scope before implementation.',
    ]),
  },
  {
    key: 'cobalt-fullstack',
    title: 'Full-Stack Engineer (TypeScript)',
    company: 'Cobalt Systems',
    location: 'Bengaluru, India (hybrid)',
    source: 'lever',
    url: 'https://jobs.lever.co/cobaltsystems/2002',
    salaryMin: 2400000,
    salaryMax: 3600000,
    postedDaysAgo: 9,
    description: REQ([
      'Full-Stack Engineer (TypeScript)',
      '',
      'What you will do',
      'Build end-to-end features across a Node.js API and a React client. You will own the schema, the endpoint, the UI and the tests.',
      '',
      'Requirements',
      '- 3+ years of TypeScript in production, both on the frontend and the backend.',
      '- Strong React experience; you know when a component should be memoised and why.',
      '- Node.js API design: REST APIs, validation, error handling, structured logging.',
      '- PostgreSQL: schema design, migrations, indexes, query optimisation.',
      '- Docker and CI/CD (GitHub Actions or similar).',
      '- AWS basics: S3, Lambda, RDS, CloudWatch.',
      '',
      'Nice to have',
      '- Hono, Fastify or another modern Node framework.',
      '- Redis caching and background jobs.',
      '- Observability tooling (Grafana, Datadog, OpenTelemetry).',
      '',
      'You will be a strong fit if you like small teams, written design docs and shipping weekly.',
    ]),
  },
  {
    key: 'vector-ml',
    title: 'Machine Learning Engineer — NLP',
    company: 'Vector Health',
    location: 'Remote (global)',
    source: 'ashby',
    url: 'https://jobs.ashbyhq.com/vectorhealth/3003',
    salaryMin: 3200000,
    salaryMax: 4800000,
    postedDaysAgo: 6,
    description: REQ([
      'Machine Learning Engineer — NLP',
      '',
      'The team',
      'We turn messy clinical text into structured signal. You will work on models that go into production weekly, not into a slide deck.',
      '',
      'Requirements',
      '- 3+ years of applied machine learning with Python.',
      '- PyTorch and modern NLP: transformers, embeddings, text classification, named entity recognition.',
      '- LLM engineering experience: prompt engineering, retrieval augmented generation (RAG), evaluation.',
      '- Solid evaluation discipline: cross validation, per-segment metrics, error analysis.',
      '- SQL and pandas for data work; you can find your own training data.',
      '',
      'Nice to have',
      '- Vector databases (pgvector, FAISS, Pinecone) and embedding pipelines.',
      '- MLOps: model deployment, model monitoring, MLflow.',
      '- Airflow or dbt pipelines.',
      '- Healthcare data experience.',
      '',
      'Responsibilities',
      '- Ship models behind a FastAPI service with tests and monitoring.',
      '- Own evaluation harnesses and be able to defend every number.',
    ]),
  },
  {
    key: 'runway-platform',
    title: 'Platform Engineer (Kubernetes)',
    company: 'Runway Cloud',
    location: 'Remote (IN/EU)',
    source: 'greenhouse',
    url: 'https://boards.greenhouse.io/runwaycloud/jobs/4004',
    salaryMin: 3000000,
    salaryMax: 4500000,
    postedDaysAgo: 12,
    description: REQ([
      'Platform Engineer (Kubernetes)',
      '',
      'Requirements',
      '- Strong Kubernetes experience in production: Helm, autoscaling, networking, upgrades.',
      '- Infrastructure as code with Terraform; you version and review everything.',
      '- AWS depth: EKS, IAM, VPC, RDS, Lambda, cost awareness.',
      '- CI/CD pipeline ownership (GitHub Actions, Jenkins) including container security scanning.',
      '- Observability: Prometheus, Grafana, OpenTelemetry, alerting that people trust.',
      '- Linux fundamentals, Bash, and one of Go or Python for tooling.',
      '',
      'Nice to have',
      '- SRE practices: SLOs, error budgets, incident response, postmortems.',
      '- Load testing (k6, Locust) and performance engineering.',
      '- PostgreSQL operations: backups, restore drills, query optimisation.',
      '',
      'Responsibilities',
      '- Make deployments boring: golden pipelines, paved roads, guardrails.',
      '- Reduce toil with automation and share the numbers.',
    ]),
  },
  {
    key: 'ledgerly-data',
    title: 'Data Engineer',
    company: 'Ledgerly',
    location: 'Remote (IN)',
    source: 'remotive',
    url: 'https://remotive.com/jobs/9005',
    salaryMin: 2200000,
    salaryMax: 3200000,
    postedDaysAgo: 3,
    description: REQ([
      'Data Engineer (Remote)',
      '',
      'Requirements',
      '- 3+ years of data engineering with Python and advanced SQL (window functions, CTEs).',
      '- ETL/ELT pipeline ownership: Airflow or Dagster, dbt, data quality checks.',
      '- Warehouse modelling experience: Snowflake, BigQuery or Redshift; star schemas and incremental models.',
      '- Spark for large batch jobs (PySpark).',
      '- Comfortable owning the data contract with product teams.',
      '',
      'Nice to have',
      '- Streaming (Kafka) and change data capture.',
      '- BI tooling: Metabase, Looker, Power BI.',
      '- Statistics and experimentation support.',
    ]),
  },
  {
    key: 'parcelworks-backend',
    title: 'Backend Engineer (Go)',
    company: 'Parcelworks',
    location: 'Remote (global)',
    source: 'remoteok',
    url: 'https://remoteok.com/remote-jobs/parcelworks-backend',
    salaryMin: 2600000,
    salaryMax: 4000000,
    postedDaysAgo: 7,
    description: REQ([
      'Backend Engineer (Go) — Logistics Platform',
      '',
      'Requirements',
      '- Go (Golang) in production, plus solid SQL.',
      '- PostgreSQL data modelling and query optimisation for high write volume.',
      '- REST APIs and gRPC service design; you have opinions about versioning.',
      '- Message queues and event-driven architecture (Kafka, RabbitMQ or SQS).',
      '- Redis caching and rate limiting.',
      '- Docker and CI/CD; you ship small and often.',
      '',
      'Nice to have',
      '- Kubernetes and Terraform.',
      '- Observability with OpenTelemetry.',
      '- Rust or TypeScript for tooling.',
    ]),
  },
  {
    key: 'brightpath-junior',
    title: 'Frontend Developer (mid-level)',
    company: 'Brightpath',
    location: 'Berlin, Germany (hybrid)',
    source: 'arbeitnow',
    url: 'https://www.arbeitnow.com/view/brightpath-frontend',
    salaryMin: 55000,
    salaryMax: 72000,
    postedDaysAgo: 15,
    description: REQ([
      'Frontend Developer (mid-level)',
      '',
      'Requirements',
      '- 2+ years with JavaScript and React.',
      '- Solid HTML and CSS; you can build a responsive layout without a framework.',
      '- REST API integration and state management.',
      '- Git workflow and code review experience.',
      '',
      'Nice to have',
      '- TypeScript.',
      '- Testing with Jest or Vitest.',
      '- Design tooling (Figma).',
    ]),
  },
  {
    key: 'tidepool-product',
    title: 'Product Engineer',
    company: 'Tidepool',
    location: 'Remote (US/EU)',
    source: 'lever',
    url: 'https://jobs.lever.co/tidepool/2008',
    salaryMin: 3000000,
    salaryMax: 4400000,
    postedDaysAgo: 2,
    description: REQ([
      'Product Engineer',
      '',
      'What we are looking for',
      '- Full-stack TypeScript: React on the client, Node.js on the server.',
      '- PostgreSQL modelling and the ability to write the migration yourself.',
      '- Product sense: you talk to users and cut scope without being told.',
      '- Experience with CI/CD and shipping to production weekly.',
      '- Written communication: design docs, PR descriptions, decision notes.',
      '',
      'Nice to have',
      '- Next.js, Tailwind CSS.',
      '- Experimentation and product analytics instrumentation.',
      '- Experience in a seed or Series A startup (0 to 1).',
    ]),
  },
  {
    key: 'cobalt-ai',
    title: 'AI Product Engineer',
    company: 'Cobalt Systems',
    location: 'Remote (IN)',
    source: 'ashby',
    url: 'https://jobs.ashbyhq.com/cobaltsystems/3010',
    salaryMin: 3200000,
    salaryMax: 5000000,
    postedDaysAgo: 1,
    description: REQ([
      'AI Product Engineer',
      '',
      'Requirements',
      '- Strong TypeScript and Python; you will live between the product app and the model layer.',
      '- LLM engineering: prompt engineering, RAG pipelines, evaluation, cost control.',
      '- Vector databases and embedding pipelines (pgvector, Pinecone, FAISS).',
      '- Node.js API design and PostgreSQL.',
      '- Ability to instrument quality: offline evals, regression suites for prompts.',
      '',
      'Nice to have',
      '- PyTorch and fine-tuning.',
      '- Airflow or scheduled pipelines.',
      '- Observability for model behaviour in production.',
    ]),
  },
  {
    key: 'northwind-infra',
    title: 'Infrastructure Engineer',
    company: 'Northwind Labs',
    location: 'Remote (EU)',
    source: 'greenhouse',
    url: 'https://boards.greenhouse.io/northwindlabs/jobs/4011',
    salaryMin: 2900000,
    salaryMax: 4300000,
    postedDaysAgo: 20,
    description: REQ([
      'Infrastructure Engineer',
      '',
      'Requirements',
      '- AWS (EKS, IAM, VPC, RDS) and Terraform at scale.',
      '- Kubernetes operations: Helm, upgrades, autoscaling, cost tuning.',
      '- Docker image build pipelines and container security.',
      '- CI/CD ownership end to end.',
      '',
      'Nice to have',
      '- SRE practices: SLOs, incident response.',
      '- Go for tooling.',
      '- PostgreSQL operations.',
    ]),
  },
];

export const SEED_APPLICATIONS: SeedApplication[] = [
  {
    job: 'northwind-frontend',
    resume: 'fullstack',
    status: 'interview',
    createdDaysAgo: 26,
    history: [
      { to: 'applied', daysAfter: 1 },
      { to: 'screening', daysAfter: 4 },
      { to: 'interview', daysAfter: 9 },
    ],
    followUpInDays: 2,
    notes:
      'Recruiter: Maya (maya@northwindlabs.com). Take-home was a React perf task — shipped with a Lighthouse before/after. Onsite #1 focused on design systems and a11y. Next round: system design with the platform team.',
  },
  {
    job: 'cobalt-fullstack',
    resume: 'fullstack',
    status: 'offer',
    createdDaysAgo: 41,
    history: [
      { to: 'applied', daysAfter: 0 },
      { to: 'screening', daysAfter: 3 },
      { to: 'interview', daysAfter: 8 },
      { to: 'offer', daysAfter: 21 },
    ],
    notes: 'Offer: 34 LPA fixed + 4 LPA bonus. Negotiating remote days. Decision needed by Friday.',
  },
  {
    job: 'tidepool-product',
    resume: 'fullstack',
    status: 'screening',
    createdDaysAgo: 6,
    history: [
      { to: 'applied', daysAfter: 1 },
      { to: 'screening', daysAfter: 3 },
    ],
    followUpInDays: 5,
    notes:
      'Founder-led process. Asked for a short written design doc — sent the ApplyAI architecture write-up.',
  },
  {
    job: 'vector-ml',
    resume: 'ml',
    status: 'applied',
    createdDaysAgo: 8,
    history: [{ to: 'applied', daysAfter: 1 }],
    followUpInDays: 6,
    notes: 'Applied with the ML resume. Cover letter focused on the RAG work at Vector Health.',
  },
  {
    job: 'cobalt-ai',
    resume: 'ml',
    status: 'applied',
    createdDaysAgo: 3,
    history: [{ to: 'applied', daysAfter: 0 }],
    notes: 'Referral from Ankit (works on the eval platform).',
  },
  {
    job: 'runway-platform',
    resume: 'platform',
    status: 'interview',
    createdDaysAgo: 33,
    history: [
      { to: 'applied', daysAfter: 2 },
      { to: 'screening', daysAfter: 5 },
      { to: 'interview', daysAfter: 12 },
    ],
    followUpInDays: 1,
    notes:
      'Second round was a live Kubernetes debugging session — went well. They asked about cost tuning on EKS.',
  },
  {
    job: 'ledgerly-data',
    resume: 'ml',
    status: 'saved',
    createdDaysAgo: 2,
    history: [],
    notes:
      'Not sure yet — the role is more pipeline than modelling. Decide after reading the JD again.',
  },
  {
    job: 'parcelworks-backend',
    resume: 'platform',
    status: 'rejected',
    createdDaysAgo: 30,
    history: [
      { to: 'applied', daysAfter: 1 },
      { to: 'rejected', daysAfter: 6 },
    ],
    notes: 'Rejected at the take-home: they wanted deeper Go internals. Fair.',
  },
  {
    job: 'northwind-infra',
    resume: 'platform',
    status: 'ghosted',
    createdDaysAgo: 44,
    history: [{ to: 'applied', daysAfter: 2 }],
    notes: 'No response after 6 weeks. Follow-up email sent — nothing.',
  },
  {
    job: 'brightpath-junior',
    resume: 'fullstack',
    status: 'rejected',
    createdDaysAgo: 38,
    history: [
      { to: 'applied', daysAfter: 1 },
      { to: 'rejected', daysAfter: 3 },
    ],
    notes: 'Role was below my level — they said so kindly. Skipping similar postings.',
  },
];

export const DEMO_USER = {
  email: 'demo@applyai.dev',
  password: 'demo1234',
  name: 'Priyanshu Pramanik',
};
