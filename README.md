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

## The opening sequence

Sound On → the layered logo assembles (short cut, ~2.7s; the harbour ambience rises in one second before it completes) → the camera flies through the badge into the sky → the plane arrives over Sydney (`public/media/plane-*.mp4`, trimmed to 10.9s, with its own flyby audio). The official soundtrack enters 2.97s into that footage, the opening lyrics play over the film, "Skip intro" appears 6.2s in, and when the film ends the page opens with a short welcome wave of fireworks (one star, and a heart that blooms around the badge) before the regular show.

- **Harbour ambience**: `public/media/harbour-ambience.m4a`, a seamless 38s loop. It is decoded ahead of time, starts one second before the logo finishes and settles to a soft bed once the soundtrack enters.

- **Soundtrack**: `public/media/soundtrack.m4a` ("Run It Down Again"), looping with a short pause. It plays only after a visitor chooses sound; the nav toggle pauses and resumes it.
- **Kinetic lyrics**: `src/data/lyrics.js` holds the 53 phrase cues exported from DaVinci Resolve. `AUDIO_OFFSET` (0.094s) corrects the soundtrack file's encoder padding, measured by cross-correlating against the full master. Movement for each phrase lives in `src/components/lyrics.js`.
- **Fireworks**: `src/lib/fireworks.js`. Shells use real ballistics, so the big ones are timed to burst on the song's "again." beats. Their sounds are synthesised in `src/lib/audio.js`.
- **Reminders**: every schedule entry has a bell. `scripts/build-ics.mjs` (part of `npm run build`) writes one `.ics` per entry to `public/ics/`, with the UTC time, the location and a 15-minute alert. iPhone opens it straight into the native "Add to Calendar" sheet; other devices choose Apple, Google or Outlook.
- **Local time**: "Check your local time" asks for location, then switches the clock, countdown and schedule to the visitor's time zone. The zone comes from the device; coordinates are only used on the device to name the nearest city.
- **Footage**: `scripts/build-media.sh` re-encodes the source clips to H.264 at 1080p (desktop) and 720p (phones), and bakes a long crossfade into the `harbour` (header) and `skyline` (footer) loops so the loop point is invisible.

## How it is built

- Vite + vanilla JS, GSAP (timelines, ScrollTrigger, Flip, MotionPath), Lenis smooth scroll
- WebGL flag-silk background, canvas starfield and particle FX
- Logo intro animates the 16 separated logo layers in `public/logo/` (cropped and downscaled from the 4096px masters by `scripts/build-logo-layers.py`)
- Sound is synthesised live with the Web Audio API (`src/lib/audio.js`), so there are no audio files
- Map: MapLibre GL + OpenFreeMap tiles, restyled in AusMC navy and red
- Social preview: `public/social/ausmc-2026-cover-v2.jpg` (1200×630), generated using the official badge and Sydney Harbour reference. Open Graph, Twitter card and event metadata in `index.html` all reference this versioned image.
- Favicons: `public/favicon.ico` and PNG variants in `public/icons/`; `public/site.webmanifest` supplies the larger device icons. The simplified Australia mark is based on the official badge.
- Legacy social image: `scripts/build-og.py` → `public/og.jpg` is retained for older cached links; it does not regenerate the current cover.

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
