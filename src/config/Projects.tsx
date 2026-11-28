import { Project } from '@/types/project';

// Every description and highlight here was checked against the code in the repository, not copied from READMEs.
// Don't add numbers (users, entity counts, speed-ups) unless they can be shown.
export const projects: Project[] = [
  {
    title: 'Rasta',
    kind: 'LLM data pipeline · knowledge graph',
    description:
      'A pipeline that uses LLMs to turn videos, wikis, blogs and podcasts into a sourced knowledge graph of places and culture in India.',
    roles: ['Applied AI', 'AI Backend'],
    stack: ['Python', 'PostgreSQL', 'Supabase', 'faster-whisper', 'Next.js'],
    highlights: [
      'Eight-stage batch pipeline: ingest, a cheap LLM gate, transcription, LLM extraction, entity resolution and scoring',
      'Provider-agnostic LLM client with backoff on 429/5xx, pacing and tolerant JSON parsing',
      'Entity resolution: exact, then alias, then fuzzy match, with ambiguous cases sent to a review queue',
      'Every entity links back to its sources with stance, claims and confidence',
    ],
    github: 'https://github.com/keshav-const/rasta',
    live: 'https://khoj-beta-five.vercel.app',
    featured: true,
    details: true,
    projectDetailsPageSlug: '/projects/rasta',
  },
  {
    title: 'Khoj API',
    kind: 'Go REST API',
    description:
      "A Go API that serves Rasta's graph, with API-key plans, Redis rate limiting, response caching, and trust and freshness signals.",
    roles: ['AI Backend', 'SDE'],
    stack: ['Go', 'chi', 'pgx', 'PostgreSQL', 'Redis', 'Docker'],
    highlights: [
      'Plan-aware rate limiting: per-minute and per-day windows in one atomic Redis Lua call, with RateLimit headers',
      'Redis response cache with strong ETags and 304 Not Modified',
      'Fuzzy search with pg_trgm, radius and bounding-box geo filters, and keyset pagination',
      'Distroless Docker image; CI runs vet and unit tests',
    ],
    github: 'https://github.com/keshav-const/rasta-api',
    live: 'https://khoj-ibli.onrender.com/healthz',
    featured: true,
    details: true,
    projectDetailsPageSlug: '/projects/khoj-api',
  },
  {
    title: 'Taste Concierge',
    kind: 'Tool-calling agent',
    description:
      'An LLM agent that turns your taste in music, film and food into an India itinerary, checked against verified places.',
    roles: ['Applied AI', 'AI Backend'],
    stack: ['TypeScript', 'Next.js', 'Qloo API', 'Upstash Redis'],
    highlights: [
      'Hand-written agent loop with OpenAI-format tools and a step budget',
      'Fallback across LLM providers that reads retry-after hints and puts rate-limited providers on cooldown',
      'Falls back to a deterministic plan if every model fails, so the page always renders',
      'Picks are cross-checked against places from the Rasta graph',
    ],
    github: 'https://github.com/keshav-const/qloo-taste-concierge',
    live: 'https://qloo-taste-concierge-silk.vercel.app',
    featured: true,
    details: true,
    projectDetailsPageSlug: '/projects/taste-concierge',
  },
  {
    title: 'PromptLens',
    kind: 'Chrome extension · metered API',
    description:
      'A Chrome extension that rewrites prompts inside ChatGPT and Gemini, backed by a metered Express API and a usage dashboard.',
    roles: ['Applied AI', 'AI Backend', 'SDE'],
    stack: ['TypeScript', 'Express', 'MongoDB', 'Gemini', 'Next.js', 'Jest'],
    highlights: [
      'Per-plan daily quotas plus general and strict rate limiters',
      'Gemini model fallback with retries and exponential backoff',
      'Webhook signatures verified with HMAC, plus an idempotent event store',
      'About 60 backend tests against an in-memory MongoDB, and a Playwright end-to-end spec',
    ],
    github: 'https://github.com/keshav-const/promptlens',
    featured: true,
    details: true,
    projectDetailsPageSlug: '/projects/promptlens',
  },
  {
    title: 'ScriptSmith',
    kind: 'AI code review tool',
    description:
      'A Monaco-based tool that analyses, rates, fixes and documents code with Gemini, running on serverless edge functions.',
    roles: ['Applied AI', 'SDE'],
    stack: ['React', 'TypeScript', 'Supabase Edge Functions', 'Gemini'],
    highlights: [
      'Prompt strategy and output-token budget scale with the size of the input',
      'A deterministic quality score computed on top of the model output',
      'Multi-turn "code mentor" chat with saved history',
    ],
    github: 'https://github.com/keshav-const/scriptsmith-ai-craft',
    live: 'https://scriptsmith-two.vercel.app',
    featured: false,
    details: false,
    projectDetailsPageSlug: '/projects/scriptsmith',
  },
  {
    title: 'Lexi',
    kind: 'Document AI service',
    description:
      'A FastAPI service that uses Gemini to turn legal documents into variable templates and drafts new ones through chat.',
    roles: ['Applied AI', 'AI Backend'],
    stack: ['Python', 'FastAPI', 'SQLAlchemy', 'Gemini', 'Next.js'],
    highlights: [
      'Chunked variable extraction for long documents; each chunk sees the variables already found',
      'Chat flow picks a template, pre-fills what it can and asks only for what is missing',
      'Routers split by domain, with a service layer and Pydantic models',
    ],
    github: 'https://github.com/keshav-const/Lexi',
    featured: false,
    details: false,
    projectDetailsPageSlug: '/projects/lexi',
  },
  {
    title: 'Pipeline Builder',
    kind: 'Node editor · technical assessment',
    description:
      'A drag-and-drop pipeline editor in ReactFlow, with a FastAPI check that the graph is acyclic.',
    roles: ['SDE'],
    stack: ['React', 'ReactFlow', 'Zustand', 'FastAPI'],
    highlights: [
      'One BaseNode abstraction behind nine node types',
      'Text node creates an input handle for every {{variable}} it contains',
      "Cycle detection with Kahn's topological sort",
    ],
    github: 'https://github.com/keshav-const/VectorShift_assessment',
    featured: false,
    details: false,
    projectDetailsPageSlug: '/projects/pipeline-builder',
  },
];
