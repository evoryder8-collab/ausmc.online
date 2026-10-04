// Damped-harmonic-oscillator easing, usable directly as a GSAP `ease`.
// `bounce` 0 → critically damped, ~0.6 → very springy. `velocity` is the
// initial velocity in "progress units per duration" (positive = launched
// toward the target, which reads as a flick).
const cache = new Map();

export function spring({ bounce = 0.3, velocity = 0 } = {}) {
  const key = `${bounce}|${velocity}`;
  if (cache.has(key)) return cache.get(key);
  const zeta = Math.min(0.995, Math.max(0.08, 1 - bounce));
  const w = 7 / zeta; // envelope decays to ~e^-7 by t = 1
  const wd = w * Math.sqrt(1 - zeta * zeta);
  const B = (velocity - zeta * w) / wd;
  const ease = (t) => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    return 1 + Math.exp(-zeta * w * t) * (-Math.cos(wd * t) + B * Math.sin(wd * t));
  };
  cache.set(key, ease);
  return ease;
}

export const springs = {
  soft: spring({ bounce: 0.18 }),
  smooth: spring({ bounce: 0.28 }),
  bouncy: spring({ bounce: 0.45 }),
  jelly: spring({ bounce: 0.6 }),
};
