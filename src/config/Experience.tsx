// Work experience. PLACEHOLDER: empty until the résumé arrives; nothing here is invented.
// Example entry (image is optional, initials are shown without it):
// {
//   company: 'Company', position: 'Role', location: 'City (Remote)', startDate: 'Jan 2025', endDate: 'Present',
//   isCurrent: true, website: 'https://…', description: ['What you did, with *bold* for key results.'], technologies: [],
// },
export interface Technology {
  name: string;
  href: string;
  icon: React.ReactNode;
}

export interface Experience {
  company: string;
  position: string;
  location: string;
  image?: string;
  description: string[];
  startDate: string;
  endDate: string;
  website: string;
  x?: string;
  linkedin?: string;
  github?: string;
  technologies: Technology[];
  isCurrent: boolean;
  isBlur?: boolean;
}

export const experiences: Experience[] = [];
