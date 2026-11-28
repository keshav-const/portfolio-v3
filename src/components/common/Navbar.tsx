import { navbarConfig } from '@/config/Navbar';
import React from 'react';

import { ThemeToggleButton } from './ThemeSwitch';
import { TrackedLink } from './TrackedLink';

export default function Navbar() {
  return (
    <header className="sticky top-0 z-30 px-3 pt-3 sm:px-4">
      <nav
        aria-label="Main"
        className="bg-background/85 shadow-soft border-border mx-auto flex max-w-5xl items-center justify-between gap-3 rounded-2xl border px-3 py-2 backdrop-blur-md sm:px-4"
      >
        <TrackedLink
          href="/"
          className="flex items-center gap-2.5"
          track={{
            name: 'button_click',
            data: { buttonId: 'logo', section: 'navbar' },
          }}
        >
          <span
            aria-hidden
            className="bg-primary text-primary-foreground shadow-btn grid size-9 place-items-center rounded-xl font-mono text-[13px] font-semibold tracking-tight"
          >
            {navbarConfig.mark}
          </span>
          <span className="hidden text-[15px] font-semibold tracking-tight sm:inline">
            {navbarConfig.name}
          </span>
        </TrackedLink>

        <div className="flex items-center gap-1 sm:gap-2">
          {navbarConfig.navItems.map((item) => (
            <TrackedLink
              key={item.label}
              href={item.href}
              className={`text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg px-2 py-1.5 text-sm transition-colors sm:px-3 ${item.hideOnMobile ? 'hidden sm:inline-block' : ''}`}
              track={{
                name: 'button_click',
                data: { buttonId: item.label, section: 'navbar' },
              }}
            >
              {item.label}
            </TrackedLink>
          ))}
          <TrackedLink
            href="/contact"
            className="bg-primary text-primary-foreground shadow-btn ml-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-transform hover:-translate-y-px"
            track={{
              name: 'button_click',
              data: { buttonId: 'contact', section: 'navbar' },
            }}
          >
            Contact
          </TrackedLink>
          <ThemeToggleButton variant="circle" start="top-right" blur />
        </div>
      </nav>
    </header>
  );
}
