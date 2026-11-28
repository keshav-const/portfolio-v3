export type Role = 'Applied AI' | 'AI Backend' | 'SDE';

export interface Project {
  title: string;
  // one line, shown in lists
  description: string;
  // what it is in a few words, shown above the title
  kind: string;
  roles: Role[];
  stack: string[];
  highlights: string[];
  github?: string;
  live?: string;
  featured: boolean;
  // '/projects/<slug>' when there is a case study page in src/data/projects
  projectDetailsPageSlug: string;
  details: boolean;
}

export interface ProjectCaseStudyFrontmatter {
  title: string;
  description: string;
  image?: string;
  technologies: string[];
  github: string;
  live: string;
  timeline?: string;
  role: string;
  team?: string;
  status: 'completed' | 'in-progress' | 'archived';
  featured: boolean;
  challenges?: string[];
  learnings?: string[];
  isPublished: boolean;
}

export interface ProjectCaseStudy {
  slug: string;
  frontmatter: ProjectCaseStudyFrontmatter;
  content: string;
}

export interface ProjectCaseStudyPreview {
  slug: string;
  frontmatter: ProjectCaseStudyFrontmatter;
}
