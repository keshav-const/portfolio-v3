import SectionHeading from '@/components/common/SectionHeading';
import { ProjectList } from '@/components/projects/ProjectList';
import { generateMetadata as getMetadata } from '@/config/Meta';
import { projects } from '@/config/Projects';
import { Metadata } from 'next';

export const metadata: Metadata = getMetadata('/projects');

export default function ProjectsPage() {
  return (
    <main className="px-4 pt-14 pb-16 sm:pt-20">
      <div className="mx-auto max-w-5xl">
        <SectionHeading
          subHeading={`Projects · ${projects.length}`}
          heading="Everything worth showing"
          text="AI pipelines and agents, the backends behind them, and a few smaller builds. Descriptions are written from the code, not the READMEs."
        />
        <ProjectList className="mt-10" projects={projects} leadFirst />
      </div>
    </main>
  );
}
