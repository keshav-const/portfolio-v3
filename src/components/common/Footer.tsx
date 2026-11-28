import { footerConfig } from '@/config/Footer';
import React from 'react';

export default function Footer() {
  const f = footerConfig;
  return (
    <footer className="px-4 pt-4 pb-10">
      <div className="border-border text-muted-foreground mx-auto flex max-w-5xl flex-col gap-3 border-t pt-6 text-sm sm:flex-row sm:items-center sm:justify-between">
        <p>
          © {new Date().getFullYear()} {f.name}
        </p>
        <p className="flex flex-wrap gap-x-4 gap-y-1">
          <a className="hover:text-foreground" href={f.game.href} target="_blank" rel="noreferrer">
            Off the clock: {f.game.text} ↗
          </a>
          <a className="hover:text-foreground" href={f.creditHref} target="_blank" rel="noreferrer">
            {f.creditText} {f.creditName}
          </a>
        </p>
      </div>
    </footer>
  );
}
