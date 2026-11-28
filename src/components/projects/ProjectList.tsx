import { type Project } from '@/types/project';
import { Link } from 'next-view-transitions';
import React from 'react';

interface ProjectListProps {
  projects: Project[];
  className?: string;
  // the first project gets a larger, lifted row
  leadFirst?: boolean;
}

function ExtLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="hover:text-foreground inline-flex items-center gap-1 underline-offset-4 hover:underline"
    >
      {children}
    </a>
  );
}

export function ProjectRow({ project: p, lead = false, index }: { project: Project; lead?: boolean; index: number }) {
  return (
    <article
      className={
        lead
          ? 'bg-card border-border shadow-lift rounded-3xl border p-6 sm:p-8'
          : 'border-border border-t py-8 first:border-t-0 sm:py-10'
      }
    >
      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] md:gap-10">
        <div>
          <p className="eyebrow flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-mint-ink">{String(index + 1).padStart(2, '0')}</span>
            {p.kind}
          </p>
          <h3 className={`mt-2 font-bold tracking-[-0.02em] ${lead ? 'text-3xl sm:text-4xl' : 'text-2xl'}`}>
            {p.details ? (
              <Link href={p.projectDetailsPageSlug} className="hover:text-mint-ink transition-colors">
                {p.title}
              </Link>
            ) : (
              p.title
            )}
          </h3>
          <p className="text-muted-foreground mt-3 text-[16px] leading-relaxed">{p.description}</p>
          <ul className="mt-4 flex flex-wrap gap-1.5" aria-label="Roles">
            {p.roles.map((r) => (
              <li key={r} className="bg-accent text-accent-foreground rounded-md px-2 py-0.5 text-xs font-medium">
                {r}
              </li>
            ))}
          </ul>
          <p className="text-muted-foreground mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm font-medium">
            {p.details && (
              <Link href={p.projectDetailsPageSlug} className="text-foreground underline-offset-4 hover:underline">
                Case study →
              </Link>
            )}
            {p.live && <ExtLink href={p.live}>Live ↗</ExtLink>}
            {p.github && <ExtLink href={p.github}>Code ↗</ExtLink>}
          </p>
        </div>
        <div>
          <ul className="space-y-2.5 text-[15px] leading-snug">
            {p.highlights.map((h) => (
              <li key={h} className="flex gap-3">
                <span aria-hidden className="bg-mint mt-[0.5em] size-1.5 shrink-0 rounded-full" />
                <span>{h}</span>
              </li>
            ))}
          </ul>
          <p className="text-muted-foreground mt-5 font-mono text-xs leading-relaxed">{p.stack.join('  ·  ')}</p>
        </div>
      </div>
    </article>
  );
}

export function ProjectList({ projects, className = '', leadFirst = false }: ProjectListProps) {
  if (projects.length === 0) {
    return <p className="text-muted-foreground py-8">No projects yet.</p>;
  }
  const [first, ...rest] = projects;
  return (
    <div className={className}>
      {leadFirst ? (
        <>
          <ProjectRow project={first} lead index={0} />
          <div className="mt-4">
            {rest.map((p, i) => (
              <ProjectRow key={p.title} project={p} index={i + 1} />
            ))}
          </div>
        </>
      ) : (
        projects.map((p, i) => <ProjectRow key={p.title} project={p} index={i} />)
      )}
    </div>
  );
}
