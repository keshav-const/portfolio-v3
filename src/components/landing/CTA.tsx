import { ctaConfig } from '@/config/CTA';
import { Link } from 'next-view-transitions';
import React from 'react';

import Section from '../common/Section';

export default function CTA() {
  const c = ctaConfig;
  return (
    <Section id="contact">
      <div className="bg-primary text-primary-foreground shadow-lift relative overflow-hidden rounded-3xl px-6 py-12 sm:px-12 sm:py-16">
        <div aria-hidden className="dot-field absolute inset-0 opacity-40 invert dark:invert-0" />
        <div className="relative max-w-2xl">
          <p className="font-mono text-xs tracking-[0.08em] uppercase opacity-60">{c.eyebrow}</p>
          <h2 className="mt-3 text-3xl font-bold tracking-[-0.025em] sm:text-[2.6rem] sm:leading-[1.1]">
            {c.heading}
          </h2>
          <p className="mt-4 text-base opacity-75 sm:text-lg">{c.text}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href={c.primary.href}
              className="bg-citrus inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold text-[#101513] shadow-[0_1px_0_rgba(255,255,255,0.5)_inset,0_8px_20px_-8px_rgba(0,0,0,0.5)] transition-transform hover:-translate-y-0.5"
            >
              {c.primary.text} →
            </Link>
            <a
              href={c.secondary.href}
              target="_blank"
              rel="noreferrer"
              className="border-primary-foreground/20 hover:bg-primary-foreground/10 inline-flex items-center justify-center rounded-xl border px-5 py-3 text-sm font-semibold transition-colors"
            >
              {c.secondary.text}
            </a>
          </div>
        </div>
      </div>
    </Section>
  );
}
