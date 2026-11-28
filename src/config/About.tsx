// About: the short bio and what each role means in practice.
// PLACEHOLDER: the bio is waiting for the résumé (education, location, years of experience).
export const about = {
  name: 'Keshav Laddha',
  description:
    'Software engineer working across applied AI, AI backends and full-stack product engineering.',
  // shown on the home page; the bracketed note is visible on purpose until the résumé arrives
  bio: [
    'I like the part of AI work that happens after the demo: getting answers grounded in the right data, keeping latency and cost in check, and wrapping it all in services and interfaces that hold up when real people use them.',
    '[Placeholder: education, current role and location go here once the résumé is in.]',
  ],
};

// The three roles, with what each one covers. Used by the "What I do" section.
export const lanes = [
  {
    no: '01',
    title: 'Applied AI',
    line: 'Turning models into features people rely on.',
    points: ['Retrieval-augmented generation', 'Prompt and output design', 'Evaluating answers, not vibes'],
  },
  {
    no: '02',
    title: 'AI Backend',
    line: 'The services underneath the model calls.',
    points: ['APIs, queues and streaming', 'Data stores and embeddings', 'Latency, cost and reliability'],
  },
  {
    no: '03',
    title: 'Software Engineering',
    line: 'Shipping complete products, front to back.',
    points: ['TypeScript, Python and Go', 'Typed, tested, reviewable code', 'Interfaces that feel quick'],
  },
];
