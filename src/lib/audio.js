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
    this.diag = []; // what loaded / what played, shown on screen with ?sfx
    this.ctxReady = new Promise((res) => (this.onCtx = res));
  }

  note(msg) {
    this.diag.push(`${(performance.now() / 1000).toFixed(1)}s ${msg}`);
    if (this.diag.length > 60) this.diag.shift();
  }

  // ───── sample loading: one shared decoder, two files at a time (phones can
  // drop decodes when two dozen start at once); a failed decode is retried
  // once with the live audio context ─────
  load(url) {
    const name = url.split('/').pop().replace(/\?.*$/, '');
    return fetch(url)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((bytes) => this.decode(bytes).then((b) => b || (this.note(`${name} decode failed, retrying`), this.ctxReady.then(() => this.decode(bytes)))))
      .then((b) => {
        this.note(b ? `${name} ok ${b.duration.toFixed(2)}s` : `${name} FAILED to decode`);
        return b;
      })
      .catch((e) => {
        this.note(`${name} FAILED to load (${e.message})`);
        return null;
      });
  }

  decode(bytes) {
    return new Promise((resolve) => {
      const run = () => {
        this.decoding = (this.decoding || 0) + 1;
        const ctx = this.ctx || (this.decoder ??= new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(2, 1, 48000));
        let settled = false;
        const done = (b) => {
          if (settled) return;
          settled = true;
          this.decoding--;
          this.decodeWait?.shift()?.();
          resolve(b || null);
        };
        try {
          // callbacks for older WebKit; the promise form where it exists
          const p = ctx.decodeAudioData(bytes.slice(0), done, () => done(null));
          if (p?.then) p.then(done, () => done(null));
        } catch {
          done(null);
        }
      };
      if ((this.decoding || 0) < 2) run();
      else (this.decodeWait ??= []).push(run);
    });
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
    this.onCtx(ctx);

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

    // fireworks get their own bus so they can fade with scroll (tails included)
    this.fwDry = ctx.createGain();
    this.fwWet = ctx.createGain();
    this.fwDry.connect(this.dry);
    this.fwWet.connect(this.verbIn);
    this.fwDry.gain.value = this.fwWet.gain.value = this.fwVol ?? 1;

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
    // iOS can pause ("interrupt") the context on its own — a call, Siri, the
    // soundtrack element taking over; every tap is a chance to wake it again
    for (const type of ['pointerup', 'touchend', 'keydown']) {
      addEventListener(type, () => this.wake(), { capture: true, passive: true });
    }
    return ctx;
  }

  /** resume a paused context (only works inside a user gesture on iOS) */
  wake() {
    if (this.enabled && this.ctx && this.ctx.state !== 'running') this.ctx.resume().catch(() => {});
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
  /** 0..1: fireworks loudness (smoothly ramped) */
  setFireworksVolume(v) {
    this.fwVol = v;
    if (!this.fwDry) return;
    const t = this.ctx.currentTime;
    this.fwDry.gain.setTargetAtTime(v, t, 0.12);
    this.fwWet.gain.setTargetAtTime(v, t, 0.12);
  }

  route(node, { pan = 0, wet = 0.3, gain = 1, fw = false, bus = null } = {}) {
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
    out.connect(bus ? bus.dry : fw ? this.fwDry : this.dry);
    if (wet > 0) {
      const w = ctx.createGain();
      w.gain.value = wet;
      out.connect(w);
      w.connect(bus ? bus.wet : fw ? this.fwWet : this.verbIn);
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

  /**
   * Muted, rounded "pop": a very fast pitch drop through a lowpass, so it reads
   * as a soft physical tap rather than a note. Used for rows landing and the
   * gentler logo beats.
   */
  softPop({ delay = 0, pitch = 1, gain = 0.07, wet = 0.1, pan = 0 } = {}) {
    if (!this.live) return;
    const { ctx } = this;
    const t = this.now(delay);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1100 * pitch;
    lp.Q.value = 0.3;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(420 * pitch, t);
    o.frequency.exponentialRampToValueAtTime(110 * pitch, t + 0.05);
    const e = ctx.createGain();
    e.gain.setValueAtTime(0.0001, t);
    e.gain.linearRampToValueAtTime(gain, t + 0.003);
    e.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    o.connect(e).connect(lp);
    const n = this.noiseSrc(t, 0.03);
    const nb = ctx.createBiquadFilter();
    nb.type = 'lowpass';
    nb.frequency.value = 1800;
    nb.Q.value = 0.2;
    const ne = ctx.createGain();
    ne.gain.setValueAtTime(gain * 0.35, t);
    ne.gain.exponentialRampToValueAtTime(0.0001, t + 0.018);
    n.connect(nb).connect(ne).connect(lp);
    this.route(lp, { wet, pan });
    o.start(t);
    o.stop(t + 0.12);
  }

  /** schedule rows landing: muted pops with a touch of random variation */
  tick(i = 0, { delay = 0 } = {}) {
    this.softPop({ delay, pitch: 0.9 + Math.random() * 0.2, gain: 0.055, wet: 0.08, pan: ((i % 5) - 2) * 0.08 });
  }

  /** soft low thud (no click): a weighty landing without the sharp edge */
  thud({ delay = 0, gain = 0.32, f0 = 120, f1 = 42, dur = 0.5 } = {}) {
    if (!this.live) return;
    const { ctx } = this;
    const t = this.now(delay);
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + 0.09);
    const e = ctx.createGain();
    e.gain.setValueAtTime(0.0001, t);
    e.gain.linearRampToValueAtTime(gain, t + 0.012);
    e.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 260;
    o.connect(e).connect(lp);
    this.route(lp, { wet: 0.08 });
    o.start(t);
    o.stop(t + dur + 0.05);
    const n = this.noiseSrc(t, 0.2);
    const nl = ctx.createBiquadFilter();
    nl.type = 'lowpass';
    nl.frequency.value = 500;
    nl.Q.value = 0.2;
    const ne = ctx.createGain();
    ne.gain.setValueAtTime(gain * 0.4, t);
    ne.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    n.connect(nl).connect(ne);
    this.route(ne, { wet: 0.1 });
  }

  /** an airy, non-tonal puff (breath of filtered noise) */
  puff({ delay = 0, gain = 0.05, dur = 0.5, f = 900 } = {}) {
    if (!this.live) return;
    const { ctx } = this;
    const t = this.now(delay);
    const n = this.noiseSrc(t, dur);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 0.5;
    bp.frequency.setValueAtTime(f * 0.6, t);
    bp.frequency.exponentialRampToValueAtTime(f, t + dur * 0.4);
    const e = ctx.createGain();
    e.gain.setValueAtTime(0.0001, t);
    e.gain.linearRampToValueAtTime(gain, t + dur * 0.25);
    e.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    n.connect(bp).connect(e);
    this.route(e, { wet: 0.35 });
  }

  /** the logo's final glow: a deep, soft bloom of air — no notes */
  bloomSoft({ delay = 0, gain = 0.07 } = {}) {
    if (!this.live) return;
    const { ctx } = this;
    const t = this.now(delay);
    const n = this.noiseSrc(t, 2.4);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 0.2;
    lp.frequency.setValueAtTime(300, t);
    lp.frequency.exponentialRampToValueAtTime(1400, t + 0.5);
    lp.frequency.exponentialRampToValueAtTime(400, t + 2.2);
    const e = ctx.createGain();
    e.gain.setValueAtTime(0.0001, t);
    e.gain.linearRampToValueAtTime(gain, t + 0.35);
    e.gain.exponentialRampToValueAtTime(0.0001, t + 2.3);
    n.connect(lp).connect(e);
    this.route(e, { wet: 0.5 });
    const air = this.noiseSrc(t, 1.8);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 6500;
    const ae = ctx.createGain();
    ae.gain.setValueAtTime(0.0001, t);
    ae.gain.linearRampToValueAtTime(gain * 0.25, t + 0.4);
    ae.gain.exponentialRampToValueAtTime(0.0001, t + 1.7);
    air.connect(hp).connect(ae);
    this.route(ae, { wet: 0.5 });
    this.thud({ delay, gain: gain * 2.2, f0: 90, f1: 38, dur: 1.2 });
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

  // ───────────────────────── fireworks ─────────────────────────

  // ───── real firework one-shots (round-robin), decoded ahead of time ─────
  preloadFireworks(base) {
    if (this.fwBufs) return;
    const names = {
      big: ['boombang-599', 'boomsingle-600', 'boomsingle-601', 'boomsingle-602'],
      burst: ['burst-60076', 'burst-60078', 'burst-60079', 'burst-60080'],
      crackles: ['crackles-19'],
    };
    const dec = (n) => this.load(`${base}${n}.m4a`);
    this.fwBufs = {};
    this.fwLast = {};
    for (const [k, list] of Object.entries(names)) {
      Promise.all(list.map(dec)).then((bufs) => (this.fwBufs[k] = bufs.filter(Boolean)));
    }
  }

  /** play one sample from a pool, never the same one twice in a row */
  fwSample(pool, { pan = 0, gain = 0.4, delay = 0, rate = 1, wet = 0.12 } = {}) {
    const bufs = this.fwBufs?.[pool];
    if (!this.live || !bufs?.length) return false;
    let i = Math.floor(Math.random() * bufs.length);
    if (bufs.length > 1 && i === this.fwLast[pool]) i = (i + 1) % bufs.length;
    this.fwLast[pool] = i;
    const { ctx } = this;
    const t = this.now(delay);
    const src = ctx.createBufferSource();
    src.buffer = bufs[i];
    src.playbackRate.value = rate;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(g);
    this.route(g, { fw: true, pan, wet });
    src.start(t);
    return true;
  }

  // ───── location scenes (map interface): each gets its own bus so a new
  // location can smoothly fade out the previous one's sounds ─────
  preloadScenes(base) {
    if (this.sceneBufs) return;
    this.sceneBufs = {};
    this.sceneBase = base;
    const dec = (n) => this.load(`${base}${n}.m4a`);
    const pools = {
      clinks: ['clink-a2', 'clink-b2', 'clink-b4', 'clink-b5', 'clink-c2'],
      cheer: ['cheer-195'],
      bowl: ['bowl-1', 'bowl-2', 'bowl-3'],
      ticks: ['tick-1', 'tick-2', 'tick-3', 'tick-4'],
    };
    this.scenesReady = Promise.all(Object.entries(pools).map(([k, list]) => Promise.all(list.map(dec)).then((b) => (this.sceneBufs[k] = b.filter(Boolean)))));
  }

  /** fade out whatever the current location scene is playing */
  endScene(fade = 0.6) {
    const sc = this.scene;
    if (!sc || !this.ctx) return;
    this.scene = null;
    const t = this.ctx.currentTime;
    for (const g of [sc.dry, sc.wet]) {
      g.gain.cancelScheduledValues(t);
      g.gain.setValueAtTime(g.gain.value, t);
      g.gain.linearRampToValueAtTime(0, t + fade);
    }
    setTimeout(() => { sc.dry.disconnect(); sc.wet.disconnect(); }, (fade + 0.2) * 1000);
  }

  /** `direct` skips the bus compressor, for samples played at an exact level */
  newScene({ direct = false } = {}) {
    this.endScene();
    const dry = this.ctx.createGain();
    const wet = this.ctx.createGain();
    dry.connect(direct ? this.master : this.dry);
    wet.connect(this.verbIn);
    this.scene = { dry, wet };
    return this.scene;
  }

  /**
   * The countdown ticking: four takes of a real clock tick in a shuffled
   * order, round and round, at half the recording's level. The tick bus
   * fades with the scroll (setTicksVolume), so they hush as you leave.
   */
  clockTick(n) {
    const bufs = this.sceneBufs?.ticks;
    if (!this.live || !bufs?.length || (this.tickVol ?? 1) < 0.01) return;
    this.tickOrder ??= bufs.map((b, i) => [Math.random(), i]).sort((a, b) => a[0] - b[0]).map(([, i]) => i);
    const { ctx } = this;
    if (!this.tickBus) {
      this.tickBus = ctx.createGain();
      this.tickBus.gain.value = this.tickVol ?? 1;
      this.tickBus.connect(this.master);
    }
    const src = ctx.createBufferSource();
    src.buffer = bufs[this.tickOrder[n % bufs.length]];
    const g = ctx.createGain();
    g.gain.value = 0.5 / 0.9; // straight into the master: exact level (see announce)
    src.connect(g);
    g.connect(this.tickBus);
    src.start(this.now(0.005));
  }

  /** 0–1: the ticks' share, eased toward smoothly */
  setTicksVolume(v) {
    this.tickVol = v;
    if (this.tickBus) this.tickBus.gain.setTargetAtTime(v, this.ctx.currentTime, 0.12);
  }

  // ───── the soundtrack through Web Audio, so it can step back for speech
  // (iOS ignores media-element volume). Connected only when first needed. ─────
  attachSong(el) {
    if (this.songGain) return true;
    if (!el || !this.ctx) return false;
    try {
      const src = this.ctx.createMediaElementSource(el);
      this.songGain = this.ctx.createGain();
      src.connect(this.songGain);
      this.songGain.connect(this.ctx.destination); // straight out, exactly as before
      return true;
    } catch {
      return false;
    }
  }

  /** glide the soundtrack to `level` (1 = as recorded) over about `seconds` */
  duckSong(level, seconds = 0.4) {
    const g = this.songGain?.gain;
    if (!g) return;
    const t = this.ctx.currentTime;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.setTargetAtTime(level, t, seconds / 3);
  }

  // ───── a spoken line (the kangaroo), with its loudness for lip sync ─────
  preloadLine(url) {
    this.lineBufs ??= {};
    this.lineBufs[url] ??= this.load(url);
    return this.lineBufs[url];
  }

  speak(buf, { gain = 1 } = {}) {
    if (!this.live || !buf) return null;
    const { ctx } = this;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.value = gain / 0.9; // exact level, past the bus compressor
    const an = ctx.createAnalyser();
    an.fftSize = 512;
    src.connect(g);
    g.connect(this.master);
    src.connect(an);
    const data = new Float32Array(an.fftSize);
    const t0 = ctx.currentTime + 0.02;
    src.start(t0);
    return {
      elapsed: () => ctx.currentTime - t0,
      level: () => {
        an.getFloatTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
        return Math.sqrt(sum / data.length);
      },
      stop: () => { try { src.stop(); } catch { /* already done */ } },
    };
  }

  /** a paused context or samples still on their way: try once more when ready */
  whenReady(play) {
    const waits = [this.scenesReady];
    if (this.ctx.state !== 'running') waits.push(this.ctx.resume());
    Promise.all(waits).then(play).catch(() => {});
  }

  /** the Championship: one deep strike of a Tibetan bowl, a different take each time */
  bowl({ gain = 0.5, retry = true } = {}) {
    if (!this.enabled || !this.ctx) return;
    const bufs = this.sceneBufs?.bowl;
    if (!this.live || !bufs?.length) {
      if (retry) this.whenReady(() => this.bowl({ gain, retry: false }));
      return;
    }
    const { ctx } = this;
    const bus = this.newScene({ direct: true });
    let i;
    do i = (Math.random() * bufs.length) | 0;
    while (bufs.length > 1 && i === this.lastBowl);
    this.lastBowl = i;
    const src = ctx.createBufferSource();
    src.buffer = bufs[i];
    const g = ctx.createGain();
    g.gain.value = gain / 0.9; // undo the master's 0.9: exactly `gain` × the recording
    src.connect(g);
    g.connect(bus.dry);
    src.start(this.now(0.01));
  }

  /**
   * A table of glasses meeting in the middle: every clink lands within a
   * tight, human spread (not perfectly together), each a little different in
   * loudness, position and pitch. `cheer` adds the small applause.
   */
  toast({ cheer = false, retry = true } = {}) {
    if (!this.enabled || !this.ctx) return;
    const clinks = this.sceneBufs?.clinks;
    this.note(`toast${cheer ? ' + applause' : ''}: ctx ${this.ctx.state}, clinks ${clinks?.length ?? '…'}, applause ${this.sceneBufs?.cheer?.length ?? '…'}`);
    if (!this.live || !clinks?.length) {
      if (retry) this.whenReady(() => this.toast({ cheer, retry: false }));
      return;
    }
    const { ctx } = this;
    const bus = this.newScene();
    const t0 = ctx.currentTime + 0.02;
    const order = clinks.map((b, i) => [b, Math.random(), i]).sort((a, b) => a[1] - b[1]);
    const n = order.length;
    order.forEach(([buf], k) => {
      // first glass on the beat; the rest cluster just after (≈10–85ms)
      const g1 = (Math.random() + Math.random() + Math.random()) / 3; // soft bell-curve
      const off = k === 0 ? 0 : 0.01 + g1 * 0.075;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = 0.975 + Math.random() * 0.05;
      const g = ctx.createGain();
      g.gain.value = 0.16 * (0.75 + Math.random() * 0.4);
      src.connect(g);
      const pan = ((k / Math.max(1, n - 1)) * 2 - 1) * 0.55 + (Math.random() - 0.5) * 0.15;
      this.route(g, { pan, wet: 0.22, bus });
      src.start(t0 + off);
    });
    if (!cheer || this.cheered) return; // the crowd cheers once per visit
    const applause = (buf, t) => {
      if (this.cheered) return;
      this.cheered = true;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const g = ctx.createGain();
      // applause body ≈ -13 dB at unity; 0.357 = 0.85, lowered by 30%, then 40%
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.357, t + 0.1);
      src.connect(g);
      this.route(g, { wet: 0.15, bus });
      src.start(t);
      this.note('applause playing');
    };
    const ch = this.sceneBufs.cheer?.[0];
    if (ch) return applause(ch, t0 + 0.04);
    // not decoded on this device (yet): fetch it again now and join the clinks
    const asked = ctx.currentTime;
    this.load(`${this.sceneBase}cheer-195.m4a`).then((b) => {
      if (!b) return;
      this.sceneBufs.cheer = [b];
      if (this.scene === bus && ctx.currentTime - asked < 3) applause(b, ctx.currentTime + 0.02);
    });
  }

  /** soft rising hiss of a shell climbing (broad filter, no whistle) */
  fwLaunch({ dur = 1.2, pan = 0, gain = 0.035 } = {}) {
    if (!this.live) return;
    const { ctx } = this;
    const t = this.now();
    const n = this.noiseSrc(t, dur);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 0.45;
    bp.frequency.setValueAtTime(380, t);
    bp.frequency.exponentialRampToValueAtTime(1500, t + dur * 0.85);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 3200;
    const e = ctx.createGain();
    e.gain.setValueAtTime(0.0001, t);
    e.gain.linearRampToValueAtTime(gain, t + 0.1);
    e.gain.exponentialRampToValueAtTime(gain * 0.3, t + dur * 0.8);
    e.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    n.connect(bp).connect(lp).connect(e);
    this.route(e, { fw: true, pan, wet: 0.15 });
  }

  /** the burst: a short, dull thump of air — no ringing sweep */
  fwBoom({ pan = 0, size = 1, gain = 0.26 } = {}) {
    if (!this.live) return;
    // real recordings when loaded: big shells boom, regular ones burst
    const rate = 0.93 + Math.random() * 0.12;
    if (this.fwSample(size >= 1.15 || Math.random() < 0.3 ? 'big' : 'burst', { pan: pan * 0.7, gain: gain * 1.25 * (0.75 + 0.25 * size), rate })) return;
    const { ctx } = this;
    const t = this.now();
    const g = gain * (0.7 + 0.3 * size);
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(75, t);
    o.frequency.exponentialRampToValueAtTime(34, t + 0.1);
    const oe = ctx.createGain();
    oe.gain.setValueAtTime(0.0001, t);
    oe.gain.linearRampToValueAtTime(g * 0.8, t + 0.01);
    oe.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
    o.connect(oe);
    this.route(oe, { fw: true, pan: pan * 0.4, wet: 0.06 });
    o.start(t);
    o.stop(t + 0.6);

    const n = this.noiseSrc(t, 1.6);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 0.15;
    lp.frequency.setValueAtTime(800, t);
    lp.frequency.exponentialRampToValueAtTime(140, t + 1.1);
    const ne = ctx.createGain();
    ne.gain.setValueAtTime(0.0001, t);
    ne.gain.linearRampToValueAtTime(g * 0.75, t + 0.008);
    ne.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
    n.connect(lp).connect(ne);
    this.route(ne, { fw: true, pan, wet: 0.2 });
  }

  /** a soft glitter tail (one generated buffer per call) */
  fwCrackle({ pan = 0, delay = 0.35, dur = 1.1, density = 45, gain = 0.06 } = {}) {
    if (!this.live) return;
    const { ctx } = this;
    const t = this.now(delay);
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    const pops = Math.round(density * dur);
    for (let k = 0; k < pops; k++) {
      const at = Math.floor(Math.pow(Math.random(), 0.8) * (len - 400));
      const amp = 0.3 + Math.random() * 0.7;
      const decay = 20 + Math.random() * 60;
      for (let i = 0; i < 400; i++) d[at + i] += (Math.random() * 2 - 1) * amp * Math.exp(-i / decay);
    }
    const s = ctx.createBufferSource();
    s.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 3800;
    bp.Q.value = 0.35;
    const e = ctx.createGain();
    e.gain.setValueAtTime(gain, t);
    e.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(bp).connect(e);
    this.route(e, { fw: true, pan, wet: 0.18 });
    s.start(t);
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

  // ───────────────────────── harbour ambience ─────────────────────────
  // Decoded ahead of time (no context needed) so it can start the instant the
  // visitor taps "Yes", then loops sample-accurately through Web Audio.

  // ───── the announcer: "And the winner is…" as the arrival lands ─────
  preloadVoice(url) {
    if (this.voiceLoading) return;
    this.voiceLoading = this.load(url).then((b) => (this.voiceBuf = b));
  }

  announce({ gain = 0.168 } = {}) { // 0.4, then a further 30%, then 40% down
    const buf = this.voiceBuf;
    if (!this.live || !buf) return;
    const { ctx } = this;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    // straight into the master (past the bus compressor, undoing its 0.9) so
    // the voice sits at exactly `gain` × the recording's own level
    g.gain.value = gain / 0.9;
    src.connect(g);
    g.connect(this.master);
    src.start(this.now(0.01));
  }

  preloadHarbour(url) {
    if (this.harbourBuf) return this.harbourBuf;
    this.harbourBuf = this.load(url);
    return this.harbourBuf;
  }

  async startHarbour({ level = 1, fade = 1.4 } = {}) {
    const ctx = this.ensure();
    if (!ctx || this.harbour) return;
    this.harbour = { pending: true };
    const buf = await this.harbourBuf;
    if (!buf) return;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.linearRampToValueAtTime(level, ctx.currentTime + fade);
    src.connect(g).connect(this.dry);
    src.start();
    this.harbour = { src, g };
  }

  /** settle the harbour to a soft bed (e.g. under the soundtrack) */
  harbourLevel(level, seconds = 2) {
    const h = this.harbour;
    if (!h?.g) return;
    const t = this.ctx.currentTime;
    h.g.gain.cancelScheduledValues(t);
    h.g.gain.setValueAtTime(h.g.gain.value, t);
    h.g.gain.linearRampToValueAtTime(level, t + seconds);
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
