import { type Experience, experiences } from '@/config/Experience';
import { Link } from 'next-view-transitions';
import React from 'react';

import Section from '../common/Section';
import SectionHeading from '../common/SectionHeading';
import { ExperienceCard } from '../experience/ExperienceCard';

export default function Experience() {
  return (
    <Section id="experience">
      <SectionHeading subHeading="Experience" heading="Where I've worked" />
      {experiences.length === 0 ? (
        // PLACEHOLDER until the résumé is in; deliberately visible so it is not shipped by accident
        <div className="border-border text-muted-foreground mt-8 rounded-2xl border border-dashed p-6 font-mono text-sm">
          [Placeholder] Roles, dates and highlights will be added from the résumé.
        </div>
      ) : (
        <>
          <div className="mt-10 flex flex-col gap-10">
            {experiences.slice(0, 2).map((experience: Experience) => (
              <ExperienceCard key={experience.company} experience={experience} />
            ))}
          </div>
          {experiences.length > 2 && (
            <Link
              href="/work-experience"
              className="text-mint-ink mt-8 inline-block text-sm font-semibold underline-offset-4 hover:underline"
            >
              All experience →
            </Link>
          )}
        </>
      )}
    </Section>
  );
}
