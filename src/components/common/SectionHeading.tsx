import React from 'react';

interface SectionHeadingProps {
  subHeading: string;
  heading: string;
  text?: string;
  id?: string;
}

// An eyebrow in mono, a bold heading, and an optional line of text under it.
export default function SectionHeading({ subHeading, heading, text, id }: SectionHeadingProps) {
  return (
    <div className="max-w-2xl">
      <p className="eyebrow flex items-center gap-2">
        <span aria-hidden className="bg-mint inline-block h-px w-6" />
        {subHeading}
      </p>
      <h2 id={id} className="mt-3 text-3xl font-bold tracking-[-0.025em] sm:text-4xl">
        {heading}
      </h2>
      {text && <p className="text-muted-foreground mt-3 text-base leading-relaxed sm:text-lg">{text}</p>}
    </div>
  );
}
