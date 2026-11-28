export interface NavItem {
  label: string;
  href: string;
  hideOnMobile?: boolean;
}

export const navbarConfig = {
  mark: 'KL',
  name: 'Keshav Laddha',
  navItems: [
    { label: 'Work', href: '/#work' },
    { label: 'Projects', href: '/projects' },
    { label: 'Experience', href: '/work-experience', hideOnMobile: true },
    { label: 'Résumé', href: '/resume', hideOnMobile: true },
  ] as NavItem[],
};
