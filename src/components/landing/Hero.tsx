'use client';

import { heroConfig, socialLinks } from '@/config/Hero';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Link } from 'next-view-transitions';
import React, { useEffect, useState } from 'react';

import { TrackedLink } from '../common/TrackedLink';
import CV from '../svgs/CV';
import Chat from '../svgs/Chat';

// The role line cycles through the three roles. With reduced motion it stays on the first one.
function RoleCycle({ roles }: { roles: string[] }) {
  const reduce = useReducedMotion();
  const [i, setI] = useState(0);
  useEffect(() => {
    if (reduce) return;
    const t = setInterval(() => setI((v) => (v + 1) % roles.length), 2600);
    return () => clearInterval(t);
  }, [reduce, roles.length]);
  return (
    <span className="relative inline-grid align-bottom">
      {/* every role is laid out invisibly so the line never changes width or jumps */}
      {roles.map((r) => (
        <span key={r} aria-hidden className="invisible col-start-1 row-start-1">
          {r}
        </span>
      ))}
      <span className="sr-only">{roles.join(', ')}</span>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={roles[i]}
          aria-hidden
          className="text-mint-ink col-start-1 row-start-1 font-serif italic"
          initial={{ y: '60%', opacity: 0, filter: 'blur(6px)' }}
          animate={{ y: '0%', opacity: 1, filter: 'blur(0px)' }}
          exit={{ y: '-60%', opacity: 0, filter: 'blur(6px)' }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        >
          {roles[i]}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

// The card on the right reads like a request to an API that answers with who I am. On phones it sits under the text.
function ConsoleCard() {
  const { console: c } = heroConfig;
  return (
    <div className="relative mx-auto w-full max-w-md min-w-0 lg:mx-0">
      {/* a second sheet behind the card, for depth */}
      <div
        aria-hidden
        className="bg-card border-border shadow-soft absolute inset-0 translate-x-3 translate-y-3 rotate-2 rounded-2xl border opacity-70 max-lg:hidden"
      />
      <figure className="bg-card border-border shadow-lift relative overflow-hidden rounded-2xl border lg:-rotate-1">
        <div className="border-border flex items-center gap-2 border-b px-4 py-2.5">
          <span className="size-2.5 rounded-full bg-[#ff5f57]" />
          <span className="size-2.5 rounded-full bg-[#febc2e]" />
          <span className="size-2.5 rounded-full bg-[#28c840]" />
          <span className="text-muted-foreground ml-2 truncate font-mono text-[11px]">
            {c.file}
          </span>
        </div>
        <pre className="overflow-x-auto px-4 py-4 font-mono text-[12.5px] leading-6 sm:text-[13px]">
          <code>
            <span className="text-mint-ink font-semibold">{c.method}</span>{' '}
            <span>{c.path}</span>
            {'\n'}
            <span className="text-muted-foreground">{c.query}</span>
            {'\n\n'}
            <span className="text-muted-foreground">{'← '}</span>
            <span className="text-mint-ink">200 OK</span>
            <span className="text-muted-foreground"> · streamed</span>
            {'\n'}
            {'{'}
            {'\n'}
            {c.fields.map((f, idx) => (
              <React.Fragment key={f.key}>
                {'  '}
                <span className="text-muted-foreground">&quot;{f.key}&quot;</span>
                {': '}
                {Array.isArray(f.value) ? (
                  <>
                    {'['}
                    {f.value.map((v, j) => (
                      <React.Fragment key={v}>
                        <span>&quot;{v}&quot;</span>
                        {j < f.value.length - 1 ? ', ' : ''}
                      </React.Fragment>
                    ))}
                    {']'}
                  </>
                ) : (
                  <span>&quot;{f.value}&quot;</span>
                )}
                {idx < c.fields.length - 1 ? ',' : ''}
                {'\n'}
              </React.Fragment>
            ))}
            {'}'}
            <span className="caret ml-1" aria-hidden />
          </code>
        </pre>
        <figcaption className="sr-only">{c.caption}</figcaption>
      </figure>
    </div>
  );
}

export default function Hero() {
  const { name, roles, status, summary, stack, buttons } = heroConfig;
  return (
    <section
      id="top"
      className="relative isolate overflow-hidden px-4 pt-14 pb-16 sm:pt-20 md:pb-24"
    >
      <div aria-hidden className="dot-field absolute inset-0 -z-10" />
      <div className="mx-auto grid max-w-5xl items-center gap-12 lg:grid-cols-[1.15fr_1fr] lg:gap-10 [&>*]:min-w-0">
        <div>
          <p className="bg-card border-border shadow-soft inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium">
            <span className="live-dot" aria-hidden />
            {status}
          </p>

          <h1 className="mt-6 text-[2.6rem] leading-[1.02] font-bold tracking-[-0.035em] sm:text-6xl lg:text-[4.1rem]">
            {name}
          </h1>
          <p className="mt-3 text-[1.45rem] leading-tight font-medium tracking-tight sm:text-3xl lg:text-[2.1rem]">
            <RoleCycle roles={roles} />
          </p>

          <p className="text-muted-foreground mt-6 max-w-xl text-base leading-relaxed sm:text-lg">
            {summary.before}
            <span className="mark text-foreground">{summary.mark}</span>
            {summary.after}
          </p>

          <ul className="mt-6 flex flex-wrap gap-2" aria-label="Main stack">
            {stack.map((s) => (
              <li
                key={s}
                className="bg-card border-border skill-inner-shadow rounded-lg border px-2.5 py-1 font-mono text-xs"
              >
                {s}
              </li>
            ))}
          </ul>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            {buttons.map((b) => {
              const Icon = b.icon === 'CV' ? CV : Chat;
              const primary = b.variant === 'default';
              return (
                <Link
                  key={b.text}
                  href={b.href}
                  className={
                    primary
                      ? 'bg-primary text-primary-foreground shadow-btn inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition-transform hover:-translate-y-0.5'
                      : 'bg-card border-border shadow-soft inline-flex items-center justify-center gap-2 rounded-xl border px-5 py-3 text-sm font-semibold transition-transform hover:-translate-y-0.5'
                  }
                >
                  <span className="size-4 [&_svg]:size-4">
                    <Icon />
                  </span>
                  {b.text}
                </Link>
              );
            })}
            <div className="flex items-center gap-1 sm:ml-2">
              {socialLinks.map((l) => (
                <TrackedLink
                  key={l.name}
                  href={l.href}
                  aria-label={l.name}
                  className="text-muted-foreground hover:text-foreground hover:bg-muted grid size-10 place-items-center rounded-lg transition-colors [&_svg]:size-5"
                  track={{
                    name: 'external_link_click',
                    data: { url: l.href, text: l.name, location: 'hero_social' },
                  }}
                >
                  {l.icon}
                </TrackedLink>
              ))}
            </div>
          </div>
        </div>

        <ConsoleCard />
      </div>
    </section>
  );
}
