# AusMC 2026 — Official Schedule

Landing page for the Australian Massage Championship 2026 (9–11 October, Cockatoo Island, Sydney), served at **https://ausmc.online**.

## Editing the schedule

Everything on the page comes from [`src/data/schedule.js`](src/data/schedule.js): days, sessions, presenters, times and the two map locations. Times are Sydney wall-clock times (`"14:30"`). Commit and push to `main`, and GitHub Actions rebuilds and redeploys in about a minute.

## Develop

```bash
npm install
npm run dev
```

`npm run build` writes the static site to `dist/`.

## How it is built

- Vite + vanilla JS, GSAP (timelines, ScrollTrigger, Flip, MotionPath), Lenis smooth scroll
- WebGL flag-silk background, canvas starfield and particle FX
- Logo intro animates the 16 separated logo layers in `public/logo/` (cropped and downscaled from the 4096px masters by `scripts/build-logo-layers.py`)
- Sound is synthesised live with the Web Audio API (`src/lib/audio.js`), so there are no audio files
- Map: MapLibre GL + OpenFreeMap tiles, restyled in AusMC navy and red
- Social image: `scripts/build-og.py` → `public/og.jpg`

## Custom domain (ausmc.online)

DNS records at the registrar:

| Type  | Host | Value |
|-------|------|-------|
| A     | @    | 185.199.108.153 |
| A     | @    | 185.199.109.153 |
| A     | @    | 185.199.110.153 |
| A     | @    | 185.199.111.153 |
| AAAA  | @    | 2606:50c0:8000::153 |
| AAAA  | @    | 2606:50c0:8001::153 |
| AAAA  | @    | 2606:50c0:8002::153 |
| AAAA  | @    | 2606:50c0:8003::153 |
| CNAME | www  | evoryder8-collab.github.io. |

Then set the custom domain to `ausmc.online` in the repo's Settings → Pages and tick "Enforce HTTPS" once the certificate is issued.
