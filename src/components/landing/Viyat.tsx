import Image from 'next/image';
import React from 'react';

import Section from '../common/Section';

// A small teaser for the side project. It's a still image, so it costs nothing on phones.
export default function Viyat() {
  return (
    <Section id="viyat">
      <div className="shadow-lift relative overflow-hidden rounded-3xl bg-[#07090a] text-[#edf2ee]">
        <div className="grid md:grid-cols-[1fr_1.2fr]">
          <div className="relative z-10 flex flex-col justify-center p-6 sm:p-10">
            <p className="font-mono text-xs tracking-[0.08em] text-[#9aa49f] uppercase">Off the clock</p>
            <h2 className="mt-3 text-3xl font-bold tracking-[-0.025em] sm:text-4xl">Viyat</h2>
            <p className="mt-2 font-serif text-xl text-[#d6ec4f] italic">An invented star system you can fly through.</p>
            <p className="mt-4 text-[15px] leading-relaxed text-[#b7c0bb]">
              Fly between four made-up planets, land, drive a rover and walk around, all in the browser. Built from
              scratch in Three.js: custom shaders, terrain generated in a Web Worker, sound synthesised live, and touch
              controls for phones.
            </p>
            <a
              href="https://github.com/keshav-const/viyat"
              target="_blank"
              rel="noreferrer"
              className="mt-6 inline-flex w-fit items-center gap-2 rounded-xl bg-[#edf2ee] px-4 py-2.5 text-sm font-semibold text-[#07090a] transition-transform hover:-translate-y-0.5"
            >
              Explore the code ↗
            </a>
          </div>
          <div className="relative min-h-60 md:min-h-[22rem]">
            <Image
              src="/viyat/ekatva.jpg"
              alt="The planet Ekatva from orbit, with the survey ship in front of it"
              fill
              sizes="(min-width: 768px) 55vw, 100vw"
              className="object-cover object-[70%_50%]"
            />
            {/* blend the picture into the text side */}
            <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-[#07090a] via-transparent to-transparent md:bg-gradient-to-r" />
          </div>
        </div>
      </div>
    </Section>
  );
}
