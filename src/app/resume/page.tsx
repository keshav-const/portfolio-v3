import Container from '@/components/common/Container';
import { Separator } from '@/components/ui/separator';
import { generateMetadata as getMetadata } from '@/config/Meta';
import { resumeConfig } from '@/config/Resume';
import { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
  ...getMetadata('/resume'),
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export default function ResumePage() {
  return (
    <Container className="py-16">
      <div className="space-y-8">
        <div className="space-y-4 text-center">
          <h1 className="text-4xl font-bold tracking-tight lg:text-5xl">
            Résumé
          </h1>
          <p className="text-muted-foreground mx-auto max-w-2xl text-lg">
            Experience, education and skills on one page.
          </p>
        </div>
        <Separator />
        <div className="mx-auto max-w-2xl">
          {resumeConfig.url ? (
            <iframe
              src={resumeConfig.url}
              title="Résumé"
              className="shadow-soft min-h-screen w-full rounded-2xl border"
            ></iframe>
          ) : (
            <p className="border-border text-muted-foreground rounded-2xl border border-dashed p-6 text-center font-mono text-sm">
              [Placeholder] The résumé will be added here.
            </p>
          )}
        </div>
      </div>
    </Container>
  );
}
