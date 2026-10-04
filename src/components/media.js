import { ScrollTrigger } from 'gsap/ScrollTrigger';

const BASE = import.meta.env.BASE_URL;
// phones and small tablets get the 720p renditions
const SMALL = Math.min(screen.width, screen.height) < 820 || innerWidth < 900;
// bump when media files are re-encoded so browsers and the CDN fetch fresh copies
export const MEDIA_V = 7;
export const videoSrc = (name) => `${BASE}media/${name}-${SMALL ? 720 : 1080}.mp4?v=${MEDIA_V}`;

/**
 * iOS only lets media play with sound if play() was first called inside a
 * user gesture. Calling play()+pause() during the "Sound On" tap unlocks the
 * element for later, programmatic playback.
 */
function prime(el) {
  try {
    const p = el.play();
    el.pause();
    p?.catch?.(() => {});
  } catch { /* ignore */ }
}

// ───────────── the plane arriving over Sydney ─────────────
export function createFilm(video) {
  video.src = videoSrc('plane');
  video.preload = 'auto';
  video.playsInline = true;
  video.setAttribute('playsinline', '');
  video.load();
  return {
    video,
    prime(withSound) {
      video.muted = !withSound;
      prime(video);
    },
    /** resolves once enough is buffered to play through (or after a timeout) */
    ready(timeout = 5000) {
      if (video.readyState >= 3) return Promise.resolve();
      return new Promise((res) => {
        const done = () => { video.removeEventListener('canplaythrough', done); res(); };
        video.addEventListener('canplaythrough', done);
        setTimeout(done, timeout);
      });
    },
    async play(withSound) {
      video.currentTime = 0;
      video.muted = !withSound;
      try {
        await video.play();
      } catch {
        video.muted = true; // autoplay policy refused sound: keep the picture
        await video.play().catch(() => {});
      }
    },
    stop() {
      video.pause();
    },
  };
}

// ───────────── seamless background loops ─────────────
export function createLoop(video, name, { lazy = false } = {}) {
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.setAttribute('playsinline', '');
  video.setAttribute('muted', '');
  let loaded = false;
  const load = () => {
    if (loaded) return;
    loaded = true;
    video.src = videoSrc(name);
    video.load();
  };
  if (!lazy) load();
  let visible = !lazy;
  const play = () => {
    load();
    if (visible && !document.hidden) video.play().catch(() => {});
  };
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible) play();
    else video.pause();
  }, { rootMargin: '120px' }).observe(video);
  document.addEventListener('visibilitychange', () => (document.hidden ? video.pause() : visible && play()));
  if (lazy) ScrollTrigger.create({ trigger: video, start: 'top 250%', once: true, onEnter: load });
  return { video, play, load };
}

// ───────────── the soundtrack ─────────────
export function createSong({ onStart, onPause } = {}) {
  const audio = new Audio();
  audio.src = `${BASE}media/soundtrack.m4a?v=${MEDIA_V}`;
  audio.preload = 'auto';
  audio.setAttribute('playsinline', '');
  let wanted = false;
  let loopTimer = 0;
  let resumeOnShow = false;

  audio.addEventListener('ended', () => {
    // a short breath, then the song comes round again
    clearTimeout(loopTimer);
    loopTimer = setTimeout(() => {
      if (!wanted) return;
      audio.currentTime = 0;
      audio.play().catch(() => {});
    }, 3500);
  });
  audio.addEventListener('play', () => onStart?.());
  audio.addEventListener('pause', () => { if (!audio.ended) onPause?.(); });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      resumeOnShow = !audio.paused;
      audio.pause();
    } else if (resumeOnShow && wanted) {
      audio.play().catch(() => {});
    }
  });

  return {
    audio,
    prime: () => prime(audio),
    get playing() {
      return !audio.paused;
    },
    get started() {
      return audio.currentTime > 0 || !audio.paused;
    },
    /** start from the top; resolves false if the browser refused */
    async start() {
      wanted = true;
      audio.currentTime = 0;
      try {
        await audio.play();
        return true;
      } catch {
        return false;
      }
    },
    async resume() {
      wanted = true;
      try {
        await audio.play();
        return true;
      } catch {
        return false;
      }
    },
    pause() {
      wanted = false;
      clearTimeout(loopTimer);
      audio.pause();
    },
  };
}
