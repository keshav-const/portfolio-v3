import { about, lanes } from '@/config/About';
import React from 'react';

import Section from '../common/Section';
import SectionHeading from '../common/SectionHeading';

// "What I do": the three roles as a ruled, three-column list (one column on phones), then a short bio.
export default function About() {
  return (
    <Section id="about">
      <SectionHeading subHeading="What I do" heading="Three roles, one habit: ship it properly." />
      <ol className="border-border mt-10 grid border-t md:grid-cols-3">
        {lanes.map((l, i) => (
          <li
            key={l.no}
            className={`border-border py-7 md:px-6 md:py-8 ${i > 0 ? 'border-t md:border-t-0 md:border-l' : ''} ${i === 0 ? 'md:pl-0' : ''}`}
          >
            <p className="text-mint-ink font-mono text-xs">{l.no}</p>
            <h3 className="mt-2 text-xl font-semibold tracking-tight">{l.title}</h3>
            <p className="text-muted-foreground mt-1.5 font-serif text-lg italic">{l.line}</p>
            <ul className="mt-4 space-y-2 text-[15px]">
              {l.points.map((p) => (
                <li key={p} className="flex gap-2.5">
                  <span aria-hidden className="bg-mint mt-[0.6em] size-1.5 shrink-0 rounded-full" />
                  {p}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
      <div className="border-border mt-2 grid gap-4 border-t pt-8 md:grid-cols-[12rem_1fr]">
        <p className="eyebrow pt-1">About</p>
        <div className="max-w-2xl space-y-4 text-[17px] leading-relaxed">
          {about.bio.map((p) => (
            <p key={p} className={p.startsWith('[') ? 'text-muted-foreground font-mono text-sm' : ''}>
              {p}
            </p>
          ))}
        </div>
      </div>
    </Section>
  );
}
