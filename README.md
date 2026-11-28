# Keshav Laddha · Portfolio

Personal portfolio for applied AI, AI backend and software engineering roles.

- **Stack:** Next.js 15 (App Router), TypeScript, Tailwind CSS 4, shadcn/ui, MDX
- **Built on:** [Sleek Portfolio](https://github.com/ramxcodes/sleek-portfolio) by ramxcodes (MIT, see `LICENSE`), restyled and rewritten
- **Side project:** the explorable star system that started in this repo now lives in [keshav-const/viyat](https://github.com/keshav-const/viyat)

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # production build
```

## Where things live

| What | File |
| --- | --- |
| Name, roles, hero text, stack chips, console card | `src/config/Hero.tsx` |
| "What I do" lanes and bio | `src/config/About.tsx` |
| Projects (list on home and /projects) | `src/config/Projects.tsx` |
| Case studies (/projects/&lt;slug&gt;) | `src/data/projects/*.mdx` |
| Work experience | `src/config/Experience.tsx` |
| Résumé link | `src/config/Resume.ts` |
| Theme colours and shadows | `src/app/globals.css` (`:root` and `.dark`) |

Project descriptions are written from the code in each repository, not from READMEs. Don't add numbers you can't show.

## Placeholders still to fill (from the résumé)

Search for `PLACEHOLDER` / `[Placeholder]`: availability line, bio, experience, résumé file, LinkedIn and email links.

## Optional services (server-side only)

Copy `.env.example` to `.env`. Every key is read on the server; none of them is sent to the browser.

- `GEMINI_API_KEY`: turns on the portfolio chat assistant (the bubble is hidden without it)
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`: delivers contact-form messages
- `NEXT_PUBLIC_UMAMI_SRC`, `NEXT_PUBLIC_UMAMI_ID`: privacy-friendly analytics (public by design)
