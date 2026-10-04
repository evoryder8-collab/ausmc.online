import { gsap } from 'gsap';
import { MotionPathPlugin } from 'gsap/MotionPathPlugin';
import { spring } from '../lib/spring.js';
import { sound } from '../lib/audio.js';
import { STAR_IDS } from './logo.js';

gsap.registerPlugin(MotionPathPlugin);

// the short cut: the full choreography, played 2.5× faster
const SPEED = 2.5;

/**
 * The logo assembles itself piece by piece: the badge drops in, the ring
 * settles, both text arcs spin home around the badge, leaves sprout, the
 * continent slams down, the Union Jack stamps on and the Southern Cross
 * arrives as shooting stars — then a gleam, bloom and glow.
 */
export function playIntro({ logo, stage, fx, bg, stars, reduced }) {
  return new Promise((resolve) => {
    const P = logo.pieces;
    const shakeEl = stage.querySelector('.intro__shake');
    const caption = stage.querySelector('.intro__caption');
    const title = stage.querySelector('.intro__title');
    const rays = stage.querySelector('.intro__rays');
    const skipBtn = stage.querySelector('.intro__skip');
    const S = logo.size();
    const mobile = innerWidth < 720;
    let finished = false;
    let skipped = false;

    const fire = (fn) => () => { if (!skipped) fn(); };
    const shake = (amp, dur) => {
      if (skipped || reduced) return;
      const t = gsap.timeline();
      const n = 9;
      for (let i = 0; i < n; i++) {
        const k = Math.pow(1 - i / n, 1.6);
        t.to(shakeEl, { x: (Math.random() - 0.5) * 2 * amp * k, y: (Math.random() - 0.5) * 2 * amp * k, rotation: (Math.random() - 0.5) * 0.8 * k, duration: dur / n / SPEED, ease: 'sine.inOut' });
      }
      t.to(shakeEl, { x: 0, y: 0, rotation: 0, duration: 0.12 });
    };
    const blur = (px) => `blur(${mobile ? px * 0.6 : px}px)`;

    logo.root.classList.add('is-assembling');
    if (!reduced) fx.speed = SPEED * 0.85; // particles keep pace with the short cut
    gsap.set(Object.values(P), { opacity: 0 });
    gsap.set([logo.glow, logo.rim], { opacity: 0 });
    gsap.set(caption.children, { opacity: 0, y: 24 });
    gsap.set(rays, { opacity: 0, scale: 0.85 });

    const finish = () => {
      if (finished) return;
      finished = true;
      skipBtn.removeEventListener('click', onSkip);
      logo.root.classList.remove('is-assembling');
      fx.speed = 1;
      gsap.set(Object.values(P), { clearProps: 'filter,clipPath', transformPerspective: 0 });
      gsap.set(P.mainland, { filter: 'drop-shadow(0px 3px 4px rgba(0,8,30,0.22))' });
      resolve({ skipped });
    };

    const tl = gsap.timeline({ onComplete: finish });

    if (reduced) {
      tl.to(bg, { level: 1, duration: 0.8 }, 0)
        .to(stars, { level: 1, duration: 0.8 }, 0)
        .fromTo(Object.values(P), { opacity: 0, scale: 0.97 }, { opacity: 1, scale: 1, duration: 0.8, ease: 'power2.out' }, 0.1)
        .to(logo.glow, { opacity: 1, duration: 0.8 }, 0.3)
        .to(caption.children, { opacity: 1, y: 0, duration: 0.6, stagger: 0.1 }, 0.4)
        .to({}, { duration: 0.6 });
    } else {
      // ── 0 · atmosphere + first spark
      tl.to(bg, { level: 0.55, duration: 1.4, ease: 'power2.out' }, 0);
      tl.to(stars, { level: 0.6, duration: 1.6, ease: 'power2.out' }, 0);
      tl.call(fire(() => sound.puff({ dur: 0.9, gain: 0.035, f: 700 })), null, 0);
      tl.call(fire(() => {
        const c = logo.badgeCenter();
        fx.flare(c.x, c.y, { size: S * 0.28, life: 0.8 });
        fx.ring(c.x, c.y, { radius: S * 0.12, life: 0.5, alpha: 0.6 });
      }), null, 0.18);

      // ── 1 · badge drops in
      tl.fromTo(P.badge, { opacity: 0 }, { opacity: 1, duration: 0.2, ease: 'none' }, 0.42);
      tl.fromTo(P.badge, { scale: 0.14, rotationX: 62, y: S * 0.06, transformPerspective: 900 }, { scale: 1, rotationX: 0, y: 0, duration: 1.2, ease: spring({ bounce: 0.42 }) }, 0.42);
      tl.call(fire(() => {
        const c = logo.badgeCenter();
        fx.ring(c.x, c.y, { radius: S * 0.85, life: 1.1, width: 3 });
        fx.burst(c.x, c.y, { count: mobile ? 16 : 28, speed: [240, 700], life: [0.4, 0.9], colors: ['white', 'ice', 'blue'], gravity: 80 });
        sound.thud({ gain: 0.28 });
        shake(6, 0.45);
      }), null, 0.68);
      tl.to(bg, { pulse: 0.9, duration: 0.07 }, 0.68).to(bg, { pulse: 0, duration: 1.1, ease: 'power2.out' }, 0.75);

      // ── 2 · inner ring settles
      tl.fromTo(P.ring, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: 'none' }, 0.88);
      tl.fromTo(P.ring, { scale: 1.32, rotation: -32 }, { scale: 1, rotation: 0, duration: 1, ease: spring({ bounce: 0.36 }) }, 0.88);
      tl.call(fire(() => sound.softPop({ pitch: 1.3, gain: 0.035 })), null, 1.02);

      // ── 3 · text arcs spin home around the badge
      tl.call(fire(() => sound.whoosh({ dur: 0.5, f0: 200, f1: 1300, pan0: -0.6, pan1: 0.45, gain: 0.08 })), null, 0.96);
      tl.fromTo(P['text-top'], { opacity: 0 }, { opacity: 1, duration: 0.35, ease: 'none' }, 1.02);
      tl.fromTo(P['text-top'], { rotation: -150, filter: blur(10) }, { rotation: 0, duration: 1.3, ease: spring({ bounce: 0.3, velocity: 1.2 }) }, 1.02);
      tl.to(P['text-top'], { filter: blur(0), duration: 0.6, ease: 'power2.out' }, 1.12);
      tl.call(fire(() => sound.whoosh({ dur: 0.5, f0: 230, f1: 1200, pan0: 0.6, pan1: -0.45, gain: 0.07 })), null, 1.1);
      tl.fromTo(P['text-bottom'], { opacity: 0 }, { opacity: 1, duration: 0.35, ease: 'none' }, 1.16);
      tl.fromTo(P['text-bottom'], { rotation: 150, filter: blur(10) }, { rotation: 0, duration: 1.3, ease: spring({ bounce: 0.3, velocity: 1.2 }) }, 1.16);
      tl.to(P['text-bottom'], { filter: blur(0), duration: 0.6, ease: 'power2.out' }, 1.26);
      tl.call(fire(() => sound.softPop({ pitch: 0.8, gain: 0.04 })), null, 1.5);
      tl.call(fire(() => sound.softPop({ pitch: 0.75, gain: 0.035 })), null, 1.64);

      // ── 4 · laurel sprigs sprout
      tl.fromTo([P['leaf-left'], P['leaf-right']], { opacity: 0, scale: 0, rotation: (i) => (i ? 42 : -42) }, { opacity: 1, scale: 1, rotation: 0, duration: 1.05, ease: spring({ bounce: 0.5 }), stagger: 0.09 }, 1.55);
      tl.call(fire(() => sound.rustle({ dur: 0.35, gain: 0.025 })), null, 1.56);

      // ── 5 · continent slams down from above the camera
      tl.fromTo(P.mainland,
        { opacity: 0, scale: 2.9, y: -S * 0.04, rotation: -7, filter: `${blur(18)} drop-shadow(0px 60px 40px rgba(0,8,30,0.55))` },
        { opacity: 1, scale: 1, y: 0, rotation: 0, filter: 'blur(0px) drop-shadow(0px 3px 4px rgba(0,8,30,0.22))', duration: 0.5, ease: 'power3.in' }, 1.9);
      tl.call(fire(() => sound.whoosh({ dur: 0.35, f0: 700, f1: 160, pan0: 0, pan1: 0, gain: 0.06 })), null, 1.9);
      tl.to(P.mainland, { keyframes: [{ scaleX: 1.055, scaleY: 0.935, duration: 0.07, ease: 'power2.out' }, { scaleX: 1, scaleY: 1, duration: 0.75, ease: spring({ bounce: 0.55 }) }] }, 2.4);
      tl.call(fire(() => {
        const c = logo.centerOf('mainland', 0.5, 0.6);
        fx.ring(c.x, c.y, { radius: S * 0.6, life: 0.85, width: 4, color: '150,180,255' });
        fx.dust(c.x, c.y + S * 0.12, S * 0.55, { count: mobile ? 24 : 44 });
        sound.thud({ gain: 0.4, dur: 0.7 });
        shake(12, 0.6);
      }), null, 2.4);
      tl.to(bg, { pulse: 0.75, duration: 0.06 }, 2.4).to(bg, { pulse: 0, duration: 1.0 }, 2.46);

      // ── 6 · Tasmania hops in
      tl.fromTo(P.tasmania, { opacity: 0, scale: 2.3, filter: blur(10) }, { opacity: 1, scale: 1, filter: 'blur(0px)', duration: 0.36, ease: 'power3.in' }, 2.58);
      tl.to(P.tasmania, { keyframes: [{ y: -S * 0.012, duration: 0.12, ease: 'power2.out' }, { y: 0, duration: 0.45, ease: 'bounce.out' }] }, 2.94);
      tl.call(fire(() => {
        const c = logo.centerOf('tasmania', 0.75, 0.92);
        fx.burst(c.x, c.y, { count: 14, speed: [60, 240], life: [0.3, 0.7], colors: ['ice', 'white'], gravity: 300 });
        sound.softPop({ pitch: 0.7, gain: 0.05 });
      }), null, 2.94);

      // ── 7 · Union Jack stamps on
      tl.fromTo(P['jack-white'], { opacity: 0, scaleX: 0, scaleY: 0.25 }, { opacity: 1, scaleX: 1, scaleY: 1, duration: 0.85, ease: spring({ bounce: 0.45 }) }, 3.08);
      tl.call(fire(() => sound.softPop({ pitch: 1, gain: 0.04 })), null, 3.1);
      tl.fromTo(P['jack-red'], { opacity: 0, scale: 1.5, clipPath: 'inset(50% 50% 50% 50%)' }, { opacity: 1, scale: 1, clipPath: 'inset(0% 0% 0% 0%)', duration: 0.6, ease: 'expo.out' }, 3.22);
      tl.call(fire(() => {
        const c = logo.centerOf('jack-red');
        sound.softPop({ pitch: 1.2, gain: 0.04 });
        fx.burst(c.x, c.y, { count: 18, speed: [90, 320], colors: ['red', 'white'], life: [0.3, 0.7] });
      }), null, 3.26);

      // ── 8 · Commonwealth Star
      tl.fromTo(P['star-commonwealth'], { opacity: 0, scale: 0, rotation: -220 }, { opacity: 1, scale: 1, rotation: 0, duration: 1.05, ease: spring({ bounce: 0.5 }) }, 3.42);
      tl.call(fire(() => {
        const c = logo.centerOf('star-commonwealth');
        fx.flare(c.x, c.y, { size: S * 0.24, life: 0.9 });
        fx.burst(c.x, c.y, { count: mobile ? 18 : 32, speed: [100, 440], colors: ['white', 'ice', 'red'], life: [0.4, 1.0] });
        sound.softPop({ pitch: 0.9, gain: 0.05 });
        sound.puff({ gain: 0.025, dur: 0.45, f: 1300 });
      }), null, 3.52);

      // ── 9 · Southern Cross — shooting stars, one chime each
      const dirs = [[1.25, -1.05], [-1.35, -0.75], [0.7, -1.45], [1.5, -0.35], [1.35, 0.55]];
      STAR_IDS.forEach((id, i) => {
        const t = 3.82 + i * 0.17;
        const el = P[id];
        const [dx, dy] = dirs[i];
        const sx = dx * S;
        const sy = dy * S;
        const mx = sx * 0.38 - dy * S * 0.22;
        const my = sy * 0.38 + dx * S * 0.22;
        tl.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.1 }, t);
        tl.fromTo(el, { scale: 0.6, rotation: 300 }, { motionPath: { path: [{ x: sx, y: sy }, { x: mx, y: my }, { x: 0, y: 0 }], curviness: 1.25 }, scale: 1, rotation: 0, duration: 0.62, ease: 'power2.in' }, t);
        tl.call(fire(() => {
          fx.trail(() => {
            const r = el.getBoundingClientRect();
            return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
          }, 0.6 / SPEED, { color: i % 2 ? 'ice' : 'white', rate: mobile ? 70 : 120 });
          sound.whoosh({ dur: 0.35, f0: 700, f1: 2200, gain: 0.02, pan0: Math.sign(dx) * 0.6, pan1: 0, wet: 0.3 });
        }), null, t);
        tl.fromTo(el, { scale: 1.9 }, { scale: 1, duration: 0.7, ease: spring({ bounce: 0.5 }), immediateRender: false }, t + 0.62);
        tl.call(fire(() => {
          const c = logo.centerOf(id);
          fx.flare(c.x, c.y, { size: S * 0.14, life: 0.7, rot: i * 0.4 });
          fx.burst(c.x, c.y, { count: mobile ? 8 : 14, speed: [60, 260], life: [0.3, 0.8], colors: ['white', 'ice', 'blue'], gravity: 40 });
          sound.softPop({ pitch: 1.05 + i * 0.05, gain: 0.04, pan: (i - 2) * 0.2 });
        }), null, t + 0.62);
      });

      // ── 10 · finale: bloom, gleam, rim glint, glow
      const F = 5.05;
      tl.to(logo.glow, { opacity: 1, scale: 1.12, duration: 0.55, ease: 'power2.out' }, F).to(logo.glow, { scale: 1, duration: 1.6, ease: 'sine.inOut' }, F + 0.55);
      tl.fromTo(logo.gleam.firstElementChild, { x: 0, xPercent: -160 }, { x: 0, xPercent: 160, duration: 1.25, ease: 'power2.inOut' }, F);
      tl.fromTo(logo.rim, { opacity: 0, rotation: -100 }, { opacity: 1, rotation: 260, duration: 1.7, ease: 'power2.inOut' }, F).to(logo.rim, { opacity: 0, duration: 0.6 }, F + 1.4);
      tl.to(rays, { opacity: 0.6, scale: 1, duration: 1.6, ease: 'power2.out' }, F);
      tl.to(bg, { pulse: 1, duration: 0.15 }, F).to(bg, { pulse: 0.15, duration: 1.8 }, F + 0.15);
      tl.to(stars, { level: 1, duration: 1.5 }, F);
      tl.call(fire(() => {
        sound.bloomSoft({ gain: 0.055 });
        const c = logo.badgeCenter();
        fx.ring(c.x, c.y, { radius: S * 1.05, life: 1.5, width: 2, color: '200,215,255', alpha: 0.55 });
        fx.ring(c.x, c.y, { radius: S * 0.75, life: 1.2, width: 1.5, color: '255,80,110', alpha: 0.4 });
        fx.burst(c.x, c.y, { count: mobile ? 40 : 80, speed: [260, 950], life: [0.6, 1.6], size: [1, 3], colors: ['white', 'ice', 'blue', 'red'], gravity: 50, drag: 1.5 });
        ['star-commonwealth', ...STAR_IDS].forEach((id, k) => {
          gsap.delayedCall((0.12 + k * 0.08) / SPEED, () => {
            if (skipped) return;
            const p = logo.centerOf(id);
            fx.flare(p.x, p.y, { size: S * (k === 0 ? 0.22 : 0.13), life: 1.0, rot: k * 0.35 });
          });
        });
      }), null, F);

      // ── caption
      tl.fromTo(title, { letterSpacing: '0.6em', filter: 'blur(10px)' }, { letterSpacing: '0.14em', filter: 'blur(0px)', duration: 1.5, ease: 'expo.out' }, F + 0.3);
      tl.to(caption.children, { opacity: 1, y: 0, duration: 1, ease: spring({ bounce: 0.2 }), stagger: 0.14 }, F + 0.3);
      tl.to({}, { duration: 0.01 }, F + 1.75);
    }

    if (!reduced) tl.timeScale(SPEED);

    function onSkip() {
      if (finished) return;
      skipped = true;
      sound.tap();
      tl.progress(1, true);
      fx.clear();
      gsap.set(shakeEl, { x: 0, y: 0, rotation: 0 });
      gsap.set(Object.values(P), { opacity: 1, x: 0, y: 0, scale: 1, rotation: 0, rotationX: 0 });
      gsap.set(logo.glow, { opacity: 1, scale: 1 });
      gsap.set(logo.rim, { opacity: 0 });
      gsap.set(bg, { level: 1, pulse: 0 });
      gsap.set(stars, { level: 1 });
      finish();
    }
    skipBtn.addEventListener('click', onSkip);
    addEventListener('keydown', function esc(e) {
      if (finished) return removeEventListener('keydown', esc);
      if (e.key === 'Escape') onSkip();
    });
  });
}
