// Procedural sound design — every sound is synthesised with the Web Audio API,
// so it stays perfectly in sync with the motion and needs no audio files.

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
// D-major pentatonic, high register — used for stars and row ticks
const PENTA = [74, 76, 78, 81, 83, 86, 88, 90, 93, 95, 98, 100, 102, 105];

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.enabled = false;
    this.lastHover = 0;
    this.ambient = null;
  }

  /** Must be called from inside a user gesture the first time (iOS unlock). */
  ensure() {
    if (this.ctx) return this.ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try {
      // Play through the iOS silent switch once the visitor has opted in.
      if (navigator.audioSession) navigator.audioSession.type = 'playback';
    } catch { /* not supported */ }
    const ctx = (this.ctx = new AC({ latencyHint: 'interactive' }));

    this.master = ctx.createGain();
    this.master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.knee.value = 14;
    comp.ratio.value = 3.5;
    comp.attack.value = 0.003;
    comp.release.value = 0.25;

    this.dry = ctx.createGain();
    this.verbIn = ctx.createGain();
    this.verb = ctx.createConvolver();
    this.verb.buffer = this.impulse(3.4, 2.4);
    const verbOut = ctx.createGain();
    verbOut.gain.value = 0.6;

    this.dry.connect(comp);
    this.verbIn.connect(this.verb);
    this.verb.connect(verbOut);
    verbOut.connect(comp);
    comp.connect(this.master);
    this.master.connect(ctx.destination);

    this.noise = this.makeNoise(2.5);

    // unlock: a silent blip inside the gesture
    const b = ctx.createBuffer(1, 1, 22050);
    const s = ctx.createBufferSource();
    s.buffer = b;
    s.connect(ctx.destination);
    s.start(0);

    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) this.ctx.suspend();
      else if (this.enabled) this.ctx.resume();
    });
    return ctx;
  }

  impulse(seconds, decay) {
    const { ctx } = this;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) {
        const t = i / len;
        // slightly darker tail: average two randoms as t grows
        const n = Math.random() * 2 - 1;
        d[i] = n * Math.pow(1 - t, decay) * (i < 80 ? i / 80 : 1);
      }
    }
    return buf;
  }

  makeNoise(seconds) {
    const { ctx } = this;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  setEnabled(on) {
    this.enabled = on;
    if (on) {
      const ctx = this.ensure();
      if (!ctx) return;
      if (ctx.state !== 'running') ctx.resume();
      const g = this.master.gain;
      g.cancelScheduledValues(ctx.currentTime);
      g.setTargetAtTime(0.9, ctx.currentTime, 0.08);
    } else if (this.ctx) {
      const g = this.master.gain;
      g.cancelScheduledValues(this.ctx.currentTime);
      g.setTargetAtTime(0, this.ctx.currentTime, 0.06);
    }
  }

  get live() {
    return this.enabled && this.ctx && this.ctx.state === 'running';
  }

  now(offset = 0) {
    return this.ctx.currentTime + offset;
  }

  /** route a node to the dry bus + reverb send, with optional panning */
  route(node, { pan = 0, wet = 0.3, gain = 1 } = {}) {
    const { ctx } = this;
    const g = ctx.createGain();
    g.gain.value = gain;
    node.connect(g);
    let out = g;
    if (pan && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = pan;
      g.connect(p);
      out = p;
    }
    out.connect(this.dry);
    if (wet > 0) {
      const w = ctx.createGain();
      w.gain.value = wet;
      out.connect(w);
      w.connect(this.verbIn);
    }
    return { gain: g, out };
  }

  noiseSrc(t, dur) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noise;
    s.loop = true;
    s.start(t, Math.random() * 1.5);
    s.stop(t + dur + 0.05);
    return s;
  }

  // ───────────────────────── voices ─────────────────────────

  whoosh({ delay = 0, dur = 0.7, f0 = 260, f1 = 2400, gain = 0.32, pan0 = -0.6, pan1 = 0.6, wet = 0.35 } = {}) {
    if (!this.live) return;
    const { ctx } = this;
    const t = this.now(delay);
    const src = this.noiseSrc(t, dur);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 0.9;
    bp.frequency.setValueAtTime(f0, t);
    bp.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.55);
    bp.frequency.exponentialRampToValueAtTime(Math.max(120, f0 * 1.4), t + dur);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(gain, t + dur * 0.5);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(bp).connect(env);
    let out = env;
    if (ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.setValueAtTime(pan0, t);
      p.pan.linearRampToValueAtTime(pan1, t + dur);
      env.connect(p);
      out = p;
    }
    this.route(out, { wet });
  }

  thump({ delay = 0, f0 = 150, f1 = 44, gain = 0.85, dur = 0.7, click = 0.22, wet = 0.12 } = {}) {
    if (!this.live) return;
    const { ctx } = this;
    const t = this.now(delay);
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + 0.16);
    const e = ctx.createGain();
    e.gain.setValueAtTime(0.0001, t);
    e.gain.linearRampToValueAtTime(gain, t + 0.006);
    e.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(e);
    this.route(e, { wet });
    o.start(t);
    o.stop(t + dur + 0.05);
    // transient click
    const n = this.noiseSrc(t, 0.05);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1800;
    const ne = ctx.createGain();
    ne.gain.setValueAtTime(click, t);
    ne.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
    n.connect(hp).connect(ne);
    this.route(ne, { wet: 0.08 });
  }

  /** glassy bell — additive partials with individual decays */
  chime(midi, { delay = 0, gain = 0.2, dur = 3, pan = 0, wet = 0.55, bright = 1 } = {}) {
    if (!this.live) return;
    const { ctx } = this;
    const t = this.now(delay);
    const f = mtof(midi);
    const partials = [
      [1, 1, 1],
      [2.0, 0.42 * bright, 0.7],
      [2.76, 0.3 * bright, 0.5],
      [4.07, 0.18 * bright, 0.34],
      [5.43, 0.1 * bright, 0.24],
      [6.8, 0.05 * bright, 0.16],
    ];
    const sum = ctx.createGain();
    sum.gain.value = gain;
    for (const [ratio, amp, life] of partials) {
      const fr = f * ratio * (1 + (Math.random() - 0.5) * 0.002);
      if (fr > 18000) continue;
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = fr;
      const e = ctx.createGain();
      e.gain.setValueAtTime(0.0001, t);
      e.gain.linearRampToValueAtTime(amp, t + 0.004);
      e.gain.exponentialRampToValueAtTime(0.0001, t + dur * life);
      o.connect(e).connect(sum);
      o.start(t);
      o.stop(t + dur * life + 0.05);
    }
    this.route(sum, { pan, wet });
  }

  /** ascending pentatonic tick for schedule rows landing */
  tick(i = 0, { delay = 0, gain = 0.09 } = {}) {
    if (!this.live) return;
    const { ctx } = this;
    const t = this.now(delay);
    const f = mtof(PENTA[i % PENTA.length] - 12);
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(f * 1.02, t);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.03);
    const e = ctx.createGain();
    e.gain.setValueAtTime(0.0001, t);
    e.gain.linearRampToValueAtTime(gain, t + 0.003);
    e.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
    o.connect(e);
    this.route(e, { wet: 0.28, pan: ((i % 5) - 2) * 0.12 });
    o.start(t);
    o.stop(t + 0.32);
    // soft "landing" knock underneath
    const k = ctx.createOscillator();
    k.type = 'sine';
    k.frequency.setValueAtTime(220, t);
    k.frequency.exponentialRampToValueAtTime(90, t + 0.08);
    const ke = ctx.createGain();
    ke.gain.setValueAtTime(gain * 0.9, t);
    ke.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    k.connect(ke);
    this.route(ke, { wet: 0.05 });
    k.start(t);
    k.stop(t + 0.14);
  }

  starNote(i, opts = {}) {
    this.chime(PENTA[3 + i], { gain: 0.16, dur: 2.6, wet: 0.65, pan: (i - 2) * 0.25, ...opts });
  }

  snap({ delay = 0, pitch = 1, gain = 0.22 } = {}) {
    if (!this.live) return;
    const { ctx } = this;
    const t = this.now(delay);
    const n = this.noiseSrc(t, 0.08);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 3200 * pitch;
    bp.Q.value = 2.5;
    const e = ctx.createGain();
    e.gain.setValueAtTime(gain, t);
    e.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    n.connect(bp).connect(e);
    this.route(e, { wet: 0.25 });
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(1400 * pitch, t);
    o.frequency.exponentialRampToValueAtTime(700 * pitch, t + 0.05);
    const oe = ctx.createGain();
    oe.gain.setValueAtTime(gain * 0.5, t);
    oe.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    o.connect(oe);
    this.route(oe, { wet: 0.25 });
    o.start(t);
    o.stop(t + 0.08);
  }

  rustle({ delay = 0, dur = 0.45, gain = 0.07 } = {}) {
    if (!this.live) return;
    const { ctx } = this;
    const t = this.now(delay);
    const n = this.noiseSrc(t, dur);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 4200;
    bp.Q.value = 0.7;
    const e = ctx.createGain();
    e.gain.setValueAtTime(0.0001, t);
    for (let i = 0; i < 7; i++) {
      const tt = t + (i / 7) * dur;
      e.gain.linearRampToValueAtTime(gain * (0.5 + Math.random() * 0.5), tt + 0.015);
      e.gain.linearRampToValueAtTime(gain * 0.15, tt + dur / 7);
    }
    e.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.05);
    n.connect(bp).connect(e);
    this.route(e, { wet: 0.3 });
  }

  /** rising pad used to open the logo sequence */
  swell({ delay = 0, dur = 2.4, gain = 0.16 } = {}) {
    if (!this.live) return;
    const { ctx } = this;
    const t = this.now(delay);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 6;
    lp.frequency.setValueAtTime(160, t);
    lp.frequency.exponentialRampToValueAtTime(2600, t + dur * 0.85);
    const e = ctx.createGain();
    e.gain.setValueAtTime(0.0001, t);
    e.gain.linearRampToValueAtTime(gain, t + dur * 0.8);
    e.gain.exponentialRampToValueAtTime(0.0001, t + dur + 1.2);
    lp.connect(e);
    for (const m of [38, 45, 50, 57, 62]) {
      for (const det of [-7, 7]) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = mtof(m);
        o.detune.value = det;
        const g = ctx.createGain();
        g.gain.value = 0.08;
        o.connect(g).connect(lp);
        o.start(t);
        o.stop(t + dur + 1.3);
      }
    }
    this.route(e, { wet: 0.5 });
    // airy riser
    const n = this.noiseSrc(t, dur);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 1.4;
    bp.frequency.setValueAtTime(400, t);
    bp.frequency.exponentialRampToValueAtTime(7000, t + dur);
    const ne = ctx.createGain();
    ne.gain.setValueAtTime(0.0001, t);
    ne.gain.linearRampToValueAtTime(0.06, t + dur * 0.95);
    ne.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.1);
    n.connect(bp).connect(ne);
    this.route(ne, { wet: 0.4 });
  }

  /** a glittering cascade for the final gleam */
  shimmer({ delay = 0, dur = 1.8, count = 18, gain = 0.07 } = {}) {
    if (!this.live) return;
    for (let i = 0; i < count; i++) {
      const p = i / count;
      const m = PENTA[6 + Math.floor(Math.random() * 7)];
      this.chime(m, { delay: delay + p * dur + Math.random() * 0.05, gain: gain * (1 - p * 0.5), dur: 1.6, wet: 0.75, pan: Math.random() * 1.6 - 0.8, bright: 0.6 });
    }
    const { ctx } = this;
    const t = this.now(delay);
    const n = this.noiseSrc(t, dur + 0.6);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 7500;
    const e = ctx.createGain();
    e.gain.setValueAtTime(0.0001, t);
    e.gain.linearRampToValueAtTime(0.045, t + dur * 0.3);
    e.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.5);
    n.connect(hp).connect(e);
    this.route(e, { wet: 0.6 });
  }

  /** final resolving chord */
  bloom({ delay = 0, gain = 0.1 } = {}) {
    if (!this.live) return;
    [62, 74, 78, 81, 88].forEach((m, i) => this.chime(m, { delay: delay + i * 0.025, gain: gain * (i === 0 ? 1.4 : 1), dur: 4.5, wet: 0.7, pan: (i - 2) * 0.2 }));
    const { ctx } = this;
    const t = this.now(delay);
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = mtof(38);
    const e = ctx.createGain();
    e.gain.setValueAtTime(0.0001, t);
    e.gain.linearRampToValueAtTime(0.22, t + 0.25);
    e.gain.exponentialRampToValueAtTime(0.0001, t + 3.5);
    o.connect(e);
    this.route(e, { wet: 0.3 });
    o.start(t);
    o.stop(t + 3.6);
  }

  // ───────────────────────── UI ─────────────────────────

  hover() {
    if (!this.live) return;
    const n = performance.now();
    if (n - this.lastHover < 70) return;
    this.lastHover = n;
    const { ctx } = this;
    const t = this.now();
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(2300, t);
    o.frequency.exponentialRampToValueAtTime(1800, t + 0.03);
    const e = ctx.createGain();
    e.gain.setValueAtTime(0.022, t);
    e.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    o.connect(e);
    this.route(e, { wet: 0.15 });
    o.start(t);
    o.stop(t + 0.06);
  }

  tap() {
    if (!this.live) return;
    const { ctx } = this;
    const t = this.now();
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(640, t);
    o.frequency.exponentialRampToValueAtTime(320, t + 0.09);
    const e = ctx.createGain();
    e.gain.setValueAtTime(0.13, t);
    e.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    o.connect(e);
    this.route(e, { wet: 0.2 });
    o.start(t);
    o.stop(t + 0.15);
  }

  // ───────────────────────── ambient bed ─────────────────────────

  startAmbient() {
    if (!this.ctx || this.ambient) return;
    const { ctx } = this;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, ctx.currentTime);
    out.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 6);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900;
    lp.Q.value = 0.6;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.045;
    const lfoAmt = ctx.createGain();
    lfoAmt.gain.value = 380;
    lfo.connect(lfoAmt).connect(lp.frequency);
    lfo.start();
    lp.connect(out);
    this.route(out, { wet: 0.55, gain: 1 });

    const chords = [
      [50, 57, 62, 66, 69, 76], // D maj9
      [47, 54, 59, 62, 66, 73], // Bm11
      [43, 50, 55, 59, 62, 69], // G maj9
      [45, 52, 57, 61, 64, 71], // A add9
    ];
    const step = 9.5;
    let idx = 0;
    const play = (when) => {
      const notes = chords[idx++ % chords.length];
      for (const m of notes) {
        for (const [type, det, amp] of [['sine', 0, 0.022], ['triangle', 6, 0.011]]) {
          const o = ctx.createOscillator();
          o.type = type;
          o.frequency.value = mtof(m);
          o.detune.value = det + (Math.random() - 0.5) * 6;
          const e = ctx.createGain();
          e.gain.setValueAtTime(0.0001, when);
          e.gain.linearRampToValueAtTime(amp, when + 3.5);
          e.gain.setValueAtTime(amp, when + step - 0.5);
          e.gain.linearRampToValueAtTime(0.0001, when + step + 3.5);
          o.connect(e).connect(lp);
          o.start(when);
          o.stop(when + step + 3.6);
        }
      }
    };
    let next = ctx.currentTime + 0.1;
    play(next);
    next += step;
    const timer = setInterval(() => {
      if (!this.ctx) return;
      while (next < this.ctx.currentTime + 2) {
        play(next);
        next += step;
      }
    }, 1000);
    this.ambient = { out, timer, lfo };
  }
}

export const sound = new SoundEngine();
