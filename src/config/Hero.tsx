/*
 * Hero: everything shown in the first screen of the home page.
 * Items marked PLACEHOLDER are waiting for the résumé and must be checked before launch.
 */
import Github from '@/components/svgs/Github';

export const heroConfig = {
  name: 'Keshav Laddha',
  // cycles in the line under the name
  roles: [
    'Applied AI Engineer',
    'AI Backend Engineer',
    'Software Development Engineer',
  ],
  title: 'Applied AI · AI Backend · Software Engineer',
  // PLACEHOLDER: confirm availability wording
  status: 'Open to AI, backend and SDE roles',

  summary: {
    before: 'I build ',
    mark: 'AI products end to end',
    after:
      ': the retrieval, model calls and evaluation at the core, the backend services that keep them fast and reliable, and the interfaces people actually use.',
  },

  // the main stack, shown as chips (kept short; the full list lives in the projects)
  stack: ['Python', 'TypeScript', 'Go', 'LLM APIs', 'RAG', 'Node.js', 'PostgreSQL', 'Next.js'],

  buttons: [
    { variant: 'default', text: 'Get in touch', href: '/contact', icon: 'Chat' },
    { variant: 'outline', text: 'Résumé', href: '/resume', icon: 'CV' },
  ],

  // the console card on the right of the hero
  console: {
    file: 'api.keshav.dev — ask',
    method: 'POST',
    path: '/v1/ask',
    query: '{ "q": "what do you build?" }',
    fields: [
      { key: 'roles', value: ['Applied AI', 'AI Backend', 'SDE'] },
      { key: 'builds', value: ['RAG pipelines', 'LLM services', 'APIs'] },
      { key: 'stack', value: ['Python', 'TypeScript', 'Go'] },
      { key: 'status', value: 'shipping' },
    ] as { key: string; value: string | string[] }[],
    caption: 'An illustrative API response summarising roles, what I build and my main stack.',
  },
};

export const socialLinks = [
  { name: 'GitHub', href: 'https://github.com/keshav-const', icon: <Github /> },
  // PLACEHOLDER: add LinkedIn, X and email once confirmed, e.g.
  // { name: 'LinkedIn', href: 'https://www.linkedin.com/in/…', icon: <LinkedIn /> },
  // { name: 'Email', href: 'mailto:…', icon: <Mail /> },
];
