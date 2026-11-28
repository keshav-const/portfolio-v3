import About from '@/components/landing/About';
import CTA from '@/components/landing/CTA';
import Experience from '@/components/landing/Experience';
import Github from '@/components/landing/Github';
import Hero from '@/components/landing/Hero';
import Work from '@/components/landing/Projects';
import Viyat from '@/components/landing/Viyat';
import React from 'react';

export default function page() {
  return (
    <main>
      <Hero />
      <Work />
      <About />
      <Experience />
      <Viyat />
      <Github />
      <CTA />
    </main>
  );
}
