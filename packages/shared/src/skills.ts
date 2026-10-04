/**
 * Skill taxonomy.
 *
 * A curated, alias-aware list of skills used by the matching engine to turn
 * free text (a resume, a job description) into a set of canonical skills.
 *
 * Why a taxonomy instead of "just embeddings"? Semantic similarity is a good
 * *global* signal but it is bad at the thing job seekers actually care about:
 * "does this resume cover the things this job asks for?". A taxonomy gives
 * exact, explainable answers — and it keeps the product working with zero
 * external services. Embeddings are layered on top when the ML service is up.
 *
 * Rules for adding a skill:
 *  - `id` is stable and snake_case — never reuse or rename an id (analytics key off it).
 *  - `aliases` are lowercase. The matcher adds word-boundary guards itself, so
 *    aliases containing symbols (`c++`, `.net`, `ci/cd`) are fine.
 *  - Keep aliases specific. "go" is dangerous, so it is only matched as
 *    "golang", "go lang" or inside an explicit tech context (see matcher.ts).
 */

export type SkillCategory =
  | 'language'
  | 'frontend'
  | 'backend'
  | 'database'
  | 'cloud'
  | 'devops'
  | 'data'
  | 'ml'
  | 'mobile'
  | 'testing'
  | 'security'
  | 'design'
  | 'product'
  | 'soft';

export interface SkillDefinition {
  id: string;
  label: string;
  category: SkillCategory;
  aliases?: string[];
  /** Ambiguous aliases (like "go" or "r") only match when a tech context word is nearby. */
  risky?: string[];
}

export const SKILL_CATEGORY_LABELS: Record<SkillCategory, string> = {
  language: 'Languages',
  frontend: 'Frontend',
  backend: 'Backend',
  database: 'Databases',
  cloud: 'Cloud',
  devops: 'DevOps & Infra',
  data: 'Data',
  ml: 'AI / ML',
  mobile: 'Mobile',
  testing: 'Testing & QA',
  security: 'Security',
  design: 'Design',
  product: 'Product',
  soft: 'Working style',
};

export const SKILLS: SkillDefinition[] = [
  // ---------------------------------------------------------------- languages
  { id: 'typescript', label: 'TypeScript', category: 'language', aliases: ['ts'] },
  {
    id: 'javascript',
    label: 'JavaScript',
    category: 'language',
    aliases: ['js', 'es6', 'ecmascript'],
  },
  { id: 'python', label: 'Python', category: 'language', aliases: [] },
  { id: 'java', label: 'Java', category: 'language', aliases: [] },
  { id: 'csharp', label: 'C#', category: 'language', aliases: ['c#', '.net', 'dotnet', 'c sharp'] },
  { id: 'cpp', label: 'C++', category: 'language', aliases: ['c++'] },
  { id: 'c', label: 'C', category: 'language', risky: ['c'] },
  { id: 'go', label: 'Go', category: 'language', aliases: ['golang', 'go lang'], risky: ['go'] },
  { id: 'rust', label: 'Rust', category: 'language', aliases: [] },
  { id: 'ruby', label: 'Ruby', category: 'language', aliases: [] },
  { id: 'php', label: 'PHP', category: 'language', aliases: [] },
  { id: 'swift', label: 'Swift', category: 'language', aliases: [] },
  { id: 'kotlin', label: 'Kotlin', category: 'language', aliases: [] },
  { id: 'scala', label: 'Scala', category: 'language', aliases: [] },
  { id: 'elixir', label: 'Elixir', category: 'language', aliases: [] },
  { id: 'dart', label: 'Dart', category: 'language', aliases: [] },
  { id: 'sql', label: 'SQL', category: 'language', aliases: [] },
  {
    id: 'bash',
    label: 'Bash / Shell',
    category: 'language',
    aliases: ['shell scripting', 'shell script', 'bash scripting'],
  },
  { id: 'r', label: 'R', category: 'language', risky: ['r'] },
  { id: 'matlab', label: 'MATLAB', category: 'language', aliases: [] },
  { id: 'perl', label: 'Perl', category: 'language', aliases: [] },
  { id: 'vba', label: 'VBA', category: 'language', aliases: [] },

  // ---------------------------------------------------------------- frontend
  { id: 'react', label: 'React', category: 'frontend', aliases: ['react.js', 'reactjs'] },
  { id: 'nextjs', label: 'Next.js', category: 'frontend', aliases: ['next.js', 'nextjs'] },
  { id: 'vue', label: 'Vue', category: 'frontend', aliases: ['vue.js', 'vuejs'] },
  { id: 'nuxt', label: 'Nuxt', category: 'frontend', aliases: ['nuxt.js'] },
  { id: 'angular', label: 'Angular', category: 'frontend', aliases: ['angular.js', 'angularjs'] },
  { id: 'svelte', label: 'Svelte', category: 'frontend', aliases: ['sveltekit', 'svelte kit'] },
  { id: 'solidjs', label: 'SolidJS', category: 'frontend', aliases: ['solid.js'] },
  { id: 'astro', label: 'Astro', category: 'frontend', aliases: [] },
  { id: 'remix', label: 'Remix', category: 'frontend', aliases: [] },
  { id: 'html', label: 'HTML', category: 'frontend', aliases: ['html5'] },
  { id: 'css', label: 'CSS', category: 'frontend', aliases: ['css3'] },
  {
    id: 'tailwind',
    label: 'Tailwind CSS',
    category: 'frontend',
    aliases: ['tailwindcss', 'tailwind css'],
  },
  { id: 'sass', label: 'Sass / SCSS', category: 'frontend', aliases: ['sass', 'scss'] },
  { id: 'redux', label: 'Redux', category: 'frontend', aliases: ['redux toolkit', 'rtk'] },
  { id: 'zustand', label: 'Zustand', category: 'frontend', aliases: [] },
  {
    id: 'react_query',
    label: 'TanStack Query',
    category: 'frontend',
    aliases: ['react query', 'tanstack query'],
  },
  { id: 'react_native', label: 'React Native', category: 'mobile', aliases: [] },
  { id: 'vite', label: 'Vite', category: 'frontend', aliases: [] },
  { id: 'webpack', label: 'Webpack', category: 'frontend', aliases: [] },
  { id: 'storybook', label: 'Storybook', category: 'frontend', aliases: [] },
  {
    id: 'web_accessibility',
    label: 'Accessibility (a11y)',
    category: 'frontend',
    aliases: ['a11y', 'wcag', 'accessibility'],
  },
  {
    id: 'web_performance',
    label: 'Web performance',
    category: 'frontend',
    aliases: ['core web vitals', 'lighthouse', 'web vitals'],
  },
  { id: 'pwa', label: 'PWA', category: 'frontend', aliases: ['progressive web app'] },
  {
    id: 'websockets',
    label: 'WebSockets',
    category: 'frontend',
    aliases: ['websocket', 'socket.io'],
  },
  {
    id: 'three_js',
    label: 'Three.js / WebGL',
    category: 'frontend',
    aliases: ['three.js', 'threejs', 'webgl'],
  },
  {
    id: 'design_systems',
    label: 'Design systems',
    category: 'design',
    aliases: ['design system', 'component library'],
  },

  // ---------------------------------------------------------------- backend
  {
    id: 'nodejs',
    label: 'Node.js',
    category: 'backend',
    aliases: ['node.js', 'nodejs', 'node js', 'node'],
  },
  { id: 'express', label: 'Express', category: 'backend', aliases: ['express.js', 'expressjs'] },
  { id: 'nestjs', label: 'NestJS', category: 'backend', aliases: ['nest.js'] },
  { id: 'fastify', label: 'Fastify', category: 'backend', aliases: [] },
  { id: 'hono', label: 'Hono', category: 'backend', aliases: [] },
  { id: 'django', label: 'Django', category: 'backend', aliases: [] },
  { id: 'flask', label: 'Flask', category: 'backend', aliases: [] },
  { id: 'fastapi', label: 'FastAPI', category: 'backend', aliases: [] },
  {
    id: 'spring',
    label: 'Spring / Spring Boot',
    category: 'backend',
    aliases: ['spring boot', 'springboot', 'spring framework'],
  },
  {
    id: 'rails',
    label: 'Ruby on Rails',
    category: 'backend',
    aliases: ['rails', 'ruby on rails', 'ror'],
  },
  { id: 'laravel', label: 'Laravel', category: 'backend', aliases: [] },
  {
    id: 'dotnet_core',
    label: '.NET Core',
    category: 'backend',
    aliases: ['asp.net', 'aspnet', '.net core'],
  },
  { id: 'graphql', label: 'GraphQL', category: 'backend', aliases: ['apollo graphql'] },
  {
    id: 'rest_api',
    label: 'REST APIs',
    category: 'backend',
    aliases: ['rest api', 'restful', 'rest apis', 'api design'],
  },
  { id: 'grpc', label: 'gRPC', category: 'backend', aliases: [] },
  {
    id: 'microservices',
    label: 'Microservices',
    category: 'backend',
    aliases: ['micro services', 'microservice architecture'],
  },
  {
    id: 'event_driven',
    label: 'Event-driven architecture',
    category: 'backend',
    aliases: ['event driven', 'event-driven', 'pub/sub', 'pubsub'],
  },
  {
    id: 'message_queues',
    label: 'Message queues',
    category: 'backend',
    aliases: ['rabbitmq', 'sqs', 'celery', 'message queue', 'kafka'],
  },
  {
    id: 'caching',
    label: 'Caching',
    category: 'backend',
    aliases: ['cache invalidation', 'memcached', 'caching strategy', 'cache layer'],
  },
  {
    id: 'system_design',
    label: 'System design',
    category: 'backend',
    aliases: ['distributed systems', 'scalability', 'high availability'],
  },
  {
    id: 'auth_flows',
    label: 'Auth & sessions',
    category: 'backend',
    aliases: ['oauth', 'oauth2', 'jwt', 'sso', 'authentication', 'authorization', 'saml'],
  },
  {
    id: 'payments',
    label: 'Payments',
    category: 'backend',
    aliases: ['stripe', 'razorpay', 'billing systems', 'payment gateway'],
  },
  {
    id: 'search_engines',
    label: 'Search engines',
    category: 'backend',
    aliases: ['elasticsearch', 'opensearch', 'algolia', 'meilisearch'],
  },
  {
    id: 'websocket_realtime',
    label: 'Real-time systems',
    category: 'backend',
    aliases: ['real time systems', 'real-time systems', 'realtime'],
  },

  // ---------------------------------------------------------------- databases
  {
    id: 'postgres',
    label: 'PostgreSQL',
    category: 'database',
    aliases: ['postgres', 'psql', 'postgresql'],
  },
  { id: 'mysql', label: 'MySQL', category: 'database', aliases: ['mariadb'] },
  { id: 'mongodb', label: 'MongoDB', category: 'database', aliases: ['mongo'] },
  { id: 'sqlite', label: 'SQLite', category: 'database', aliases: [] },
  { id: 'dynamodb', label: 'DynamoDB', category: 'database', aliases: [] },
  { id: 'redis', label: 'Redis', category: 'database', aliases: [] },
  { id: 'clickhouse', label: 'ClickHouse', category: 'database', aliases: [] },
  { id: 'cassandra', label: 'Cassandra', category: 'database', aliases: [] },
  { id: 'snowflake', label: 'Snowflake', category: 'database', aliases: [] },
  { id: 'bigquery', label: 'BigQuery', category: 'database', aliases: [] },
  { id: 'supabase', label: 'Supabase', category: 'database', aliases: [] },
  {
    id: 'orm',
    label: 'ORM / query builders',
    category: 'database',
    aliases: [
      'prisma',
      'drizzle',
      'drizzle orm',
      'sqlalchemy',
      'typeorm',
      'sequelize',
      'hibernate',
    ],
  },
  {
    id: 'db_modeling',
    label: 'Data modelling',
    category: 'database',
    aliases: ['data modeling', 'data modelling', 'schema design', 'normalization'],
  },
  {
    id: 'db_performance',
    label: 'Query optimisation',
    category: 'database',
    aliases: ['query optimization', 'query optimisation', 'indexing', 'slow query'],
  },

  // ---------------------------------------------------------------- cloud
  {
    id: 'aws',
    label: 'AWS',
    category: 'cloud',
    aliases: ['amazon web services', 'ec2', 's3', 'lambda', 'eks'],
  },
  {
    id: 'gcp',
    label: 'Google Cloud',
    category: 'cloud',
    aliases: ['gcp', 'google cloud platform'],
  },
  { id: 'azure', label: 'Azure', category: 'cloud', aliases: ['microsoft azure'] },
  {
    id: 'cloudflare',
    label: 'Cloudflare',
    category: 'cloud',
    aliases: ['cloudflare workers', 'workers'],
  },
  { id: 'vercel', label: 'Vercel', category: 'cloud', aliases: [] },
  {
    id: 'serverless',
    label: 'Serverless',
    category: 'cloud',
    aliases: ['serverless architecture', 'lambda functions', 'edge functions'],
  },
  {
    id: 'iaac',
    label: 'Infrastructure as Code',
    category: 'cloud',
    aliases: ['terraform', 'pulumi', 'cloudformation', 'cdk', 'infrastructure as code'],
  },

  // ---------------------------------------------------------------- devops
  {
    id: 'docker',
    label: 'Docker',
    category: 'devops',
    aliases: ['containers', 'containerization', 'dockerfile'],
  },
  { id: 'kubernetes', label: 'Kubernetes', category: 'devops', aliases: ['k8s', 'helm', 'gke'] },
  {
    id: 'ci_cd',
    label: 'CI/CD',
    category: 'devops',
    aliases: [
      'ci/cd',
      'continuous integration',
      'continuous delivery',
      'continuous deployment',
      'github actions',
      'gitlab ci',
      'jenkins',
      'circleci',
    ],
  },
  {
    id: 'observability',
    label: 'Observability',
    category: 'devops',
    aliases: [
      'monitoring',
      'datadog',
      'grafana',
      'prometheus',
      'opentelemetry',
      'new relic',
      'sentry',
    ],
  },
  {
    id: 'linux',
    label: 'Linux',
    category: 'devops',
    aliases: ['unix', 'ubuntu', 'debian', 'linux administration'],
  },
  {
    id: 'git',
    label: 'Git',
    category: 'devops',
    aliases: ['github', 'gitlab', 'version control', 'bitbucket'],
  },
  {
    id: 'networking',
    label: 'Networking',
    category: 'devops',
    aliases: ['tcp/ip', 'dns', 'load balancing', 'load balancer', 'nginx', 'http/2'],
  },
  {
    id: 'logging',
    label: 'Logging',
    category: 'devops',
    aliases: ['elk stack', 'elastic stack', 'log aggregation', 'structured logging'],
  },
  {
    id: 'sre',
    label: 'SRE practices',
    category: 'devops',
    aliases: ['sre', 'on-call', 'on call', 'incident response', 'slo', 'sla', 'postmortem'],
  },
  {
    id: 'performance_eng',
    label: 'Performance engineering',
    category: 'devops',
    aliases: ['profiling', 'load testing', 'k6', 'jmeter', 'locust'],
  },

  // ---------------------------------------------------------------- data
  {
    id: 'data_pipelines',
    label: 'Data pipelines',
    category: 'data',
    aliases: ['etl', 'elt', 'data pipeline', 'airflow', 'dbt', 'data engineering'],
  },
  { id: 'spark', label: 'Spark', category: 'data', aliases: ['pyspark', 'apache spark'] },
  {
    id: 'data_warehouse',
    label: 'Data warehousing',
    category: 'data',
    aliases: ['data warehouse', 'warehouse', 'data lake', 'lakehouse'],
  },
  { id: 'pandas', label: 'Pandas', category: 'data', aliases: ['pandas dataframe'] },
  { id: 'numpy', label: 'NumPy', category: 'data', aliases: ['numpy arrays'] },
  {
    id: 'analytics',
    label: 'Product analytics',
    category: 'data',
    aliases: [
      'mixpanel',
      'amplitude',
      'google analytics',
      'product analytics',
      'analytics instrumentation',
    ],
  },
  {
    id: 'bi_tools',
    label: 'BI & dashboards',
    category: 'data',
    aliases: ['tableau', 'power bi', 'looker', 'metabase', 'superset', 'dashboarding'],
  },
  {
    id: 'sql_analysis',
    label: 'SQL analysis',
    category: 'data',
    aliases: ['window functions', 'sql queries', 'analytical sql'],
  },
  {
    id: 'experimentation',
    label: 'Experimentation / A-B tests',
    category: 'data',
    aliases: ['a/b testing', 'ab testing', 'experimentation', 'hypothesis testing'],
  },
  {
    id: 'statistics',
    label: 'Statistics',
    category: 'data',
    aliases: ['statistical analysis', 'regression analysis', 'probabilistic modelling'],
  },
  {
    id: 'data_viz',
    label: 'Data visualisation',
    category: 'data',
    aliases: ['data visualization', 'data visualisation', 'matplotlib', 'plotly', 'd3'],
  },

  // ---------------------------------------------------------------- ml
  {
    id: 'machine_learning',
    label: 'Machine learning',
    category: 'ml',
    aliases: ['ml', 'supervised learning', 'predictive modelling', 'predictive modeling'],
  },
  {
    id: 'deep_learning',
    label: 'Deep learning',
    category: 'ml',
    aliases: ['neural networks', 'cnn', 'rnn', 'transformers'],
  },
  { id: 'pytorch', label: 'PyTorch', category: 'ml', aliases: [] },
  { id: 'tensorflow', label: 'TensorFlow', category: 'ml', aliases: ['keras', 'tf.keras'] },
  { id: 'sklearn', label: 'scikit-learn', category: 'ml', aliases: ['scikit learn', 'sklearn'] },
  {
    id: 'nlp',
    label: 'NLP',
    category: 'ml',
    aliases: [
      'natural language processing',
      'text classification',
      'named entity recognition',
      'spacy',
      'text mining',
    ],
  },
  {
    id: 'llms',
    label: 'LLM engineering',
    category: 'ml',
    aliases: [
      'llm',
      'llms',
      'large language models',
      'prompt engineering',
      'retrieval augmented generation',
      'fine-tuning',
      'fine tuning',
      'langchain',
      'openai api',
    ],
    risky: ['rag'],
  },
  {
    id: 'vector_db',
    label: 'Vector databases',
    category: 'ml',
    aliases: ['pinecone', 'weaviate', 'chroma', 'faiss', 'pgvector', 'embeddings store'],
  },
  {
    id: 'computer_vision',
    label: 'Computer vision',
    category: 'ml',
    aliases: ['opencv', 'image classification', 'object detection'],
  },
  {
    id: 'mlops',
    label: 'MLOps',
    category: 'ml',
    aliases: ['model deployment', 'ml pipelines', 'mlflow', 'model monitoring', 'feature store'],
  },
  {
    id: 'recommender',
    label: 'Recommender systems',
    category: 'ml',
    aliases: ['recommendation systems', 'ranking systems', 'recsys'],
  },
  {
    id: 'ml_evaluation',
    label: 'Model evaluation',
    category: 'ml',
    aliases: ['model evaluation', 'cross validation', 'precision recall', 'a/b model testing'],
  },

  // ---------------------------------------------------------------- mobile
  {
    id: 'android',
    label: 'Android',
    category: 'mobile',
    aliases: ['android sdk', 'jetpack compose'],
  },
  { id: 'ios', label: 'iOS', category: 'mobile', aliases: ['swiftui', 'uikit', 'ios sdk'] },
  { id: 'flutter', label: 'Flutter', category: 'mobile', aliases: [] },
  { id: 'expo', label: 'Expo', category: 'mobile', aliases: [] },
  {
    id: 'mobile_release',
    label: 'App store release',
    category: 'mobile',
    aliases: ['app store', 'play store', 'testflight', 'fastlane'],
  },

  // ---------------------------------------------------------------- testing
  {
    id: 'unit_testing',
    label: 'Unit testing',
    category: 'testing',
    aliases: ['unit tests', 'jest', 'vitest', 'pytest', 'junit', 'mocha', 'test coverage'],
  },
  {
    id: 'integration_testing',
    label: 'Integration testing',
    category: 'testing',
    aliases: ['integration tests', 'supertest', 'testcontainers'],
  },
  {
    id: 'e2e_testing',
    label: 'End-to-end testing',
    category: 'testing',
    aliases: ['playwright', 'cypress', 'selenium', 'e2e tests', 'end to end testing'],
  },
  {
    id: 'tdd',
    label: 'TDD',
    category: 'testing',
    aliases: ['test driven development', 'test-driven development'],
  },
  {
    id: 'qa_process',
    label: 'QA process',
    category: 'testing',
    aliases: ['quality assurance', 'test plans', 'regression testing', 'manual testing'],
  },

  // ---------------------------------------------------------------- security
  {
    id: 'appsec',
    label: 'Application security',
    category: 'security',
    aliases: ['appsec', 'owasp', 'secure coding', 'security review', 'vulnerability assessment'],
  },
  {
    id: 'pentesting',
    label: 'Penetration testing',
    category: 'security',
    aliases: ['pen testing', 'pentest', 'burp suite', 'red team'],
  },
  {
    id: 'cryptography',
    label: 'Cryptography',
    category: 'security',
    aliases: ['encryption', 'tls', 'cryptographic'],
  },
  {
    id: 'compliance',
    label: 'Compliance',
    category: 'security',
    aliases: ['soc 2', 'soc2', 'gdpr', 'hipaa', 'iso 27001', 'pci dss'],
  },
  {
    id: 'iam',
    label: 'Identity & access mgmt',
    category: 'security',
    aliases: ['identity and access management', 'rbac', 'zero trust', 'okta'],
  },

  // ---------------------------------------------------------------- design
  { id: 'figma', label: 'Figma', category: 'design', aliases: [] },
  {
    id: 'ux_research',
    label: 'UX research',
    category: 'design',
    aliases: ['user research', 'usability testing', 'user interviews', 'ux research'],
  },
  {
    id: 'wireframing',
    label: 'Wireframing & prototyping',
    category: 'design',
    aliases: ['wireframes', 'prototyping', 'wireframing', 'high fidelity mockups'],
  },
  {
    id: 'interaction_design',
    label: 'Interaction design',
    category: 'design',
    aliases: ['ux design', 'ui design', 'user experience design'],
  },
  {
    id: 'visual_design',
    label: 'Visual design',
    category: 'design',
    aliases: ['graphic design', 'brand design', 'typography'],
  },

  // ---------------------------------------------------------------- product
  {
    id: 'product_management',
    label: 'Product management',
    category: 'product',
    aliases: ['product owner', 'product strategy', 'roadmap', 'prd', 'product requirements'],
  },
  {
    id: 'stakeholder_mgmt',
    label: 'Stakeholder management',
    category: 'product',
    aliases: ['stakeholder communication', 'cross functional collaboration', 'cross-functional'],
  },
  {
    id: 'agile',
    label: 'Agile / Scrum',
    category: 'product',
    aliases: ['scrum', 'kanban', 'sprint planning', 'agile methodologies', 'standups'],
  },
  {
    id: 'project_mgmt',
    label: 'Project management',
    category: 'product',
    aliases: ['jira', 'asana', 'project planning', 'program management', 'confluence'],
  },
  {
    id: 'tech_writing',
    label: 'Technical writing',
    category: 'product',
    aliases: ['documentation', 'technical documentation', 'rfc', 'developer docs'],
  },
  {
    id: 'customer_success',
    label: 'Customer-facing work',
    category: 'product',
    aliases: [
      'customer support',
      'customer success',
      'client communication',
      'sales engineering',
      'solutions engineering',
    ],
  },
  {
    id: 'hiring_mentoring',
    label: 'Mentoring & hiring',
    category: 'soft',
    aliases: [
      'mentoring',
      'mentorship',
      'coaching',
      'interviewing candidates',
      'code reviews',
      'technical leadership',
    ],
  },
  {
    id: 'ownership',
    label: 'Ownership & autonomy',
    category: 'soft',
    aliases: [
      'end-to-end ownership',
      'self starter',
      'self-starter',
      'autonomy',
      'bias for action',
    ],
  },
  {
    id: 'communication',
    label: 'Communication',
    category: 'soft',
    aliases: [
      'written communication',
      'presentation skills',
      'verbal communication',
      'storytelling',
    ],
  },
  {
    id: 'collaboration',
    label: 'Collaboration',
    category: 'soft',
    aliases: ['teamwork', 'pair programming', 'collaborative', 'partnering'],
  },
  {
    id: 'problem_solving',
    label: 'Problem solving',
    category: 'soft',
    aliases: ['analytical thinking', 'critical thinking', 'root cause analysis', 'troubleshooting'],
  },
  {
    id: 'fast_paced',
    label: 'Fast-paced / startup',
    category: 'soft',
    aliases: [
      'fast paced',
      'fast-paced',
      'startup environment',
      '0 to 1',
      'zero to one',
      'ambiguity',
    ],
  },
];

/** Skills that appear in tech contexts — used to disambiguate `risky` aliases. */
export const TECH_CONTEXT_WORDS = [
  'language',
  'developer',
  'engineer',
  'engineering',
  'programming',
  'code',
  'software',
  'backend',
  'frontend',
  'stack',
  'library',
  'framework',
  'compiler',
  'runtime',
  'experience',
];

const BY_ID = new Map(SKILLS.map((s) => [s.id, s]));
export const SKILL_IDS = SKILLS.map((s) => s.id);

export function getSkill(id: string): SkillDefinition | undefined {
  return BY_ID.get(id);
}

export function skillLabel(id: string): string {
  return BY_ID.get(id)?.label ?? id;
}
