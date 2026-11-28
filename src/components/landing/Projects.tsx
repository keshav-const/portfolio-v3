import { projects } from '@/config/Projects';
import { Link } from 'next-view-transitions';
import React from 'react';

import Section from '../common/Section';
import SectionHeading from '../common/SectionHeading';
import { ProjectList } from '../projects/ProjectList';

export default function Projects() {
  const featured = projects.filter((p) => p.featured);
  return (
    <Section id="work">
      <SectionHeading
        subHeading="Selected work"
        heading="Things I've built"
        text="LLM pipelines, agents and the APIs behind them. Each one links to its code."
      />
      <ProjectList className="mt-10" projects={featured} leadFirst />
      <Link
        href="/projects"
        className="bg-card border-border shadow-soft mt-6 inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-transform hover:-translate-y-0.5"
      >
        All projects ({projects.length}) →
      </Link>
    </Section>
  );
}
