// A kangaroo drops by: it leaps in from the left, bounds along the top of the
// countdown, nearly topples off the far edge, backs up, and launches itself off
// screen. Real skinned animation clips (three.js) with hand-tuned secondary
// motion layered on top. Loaded on demand, rendered only while it plays.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { gsap } from 'gsap';
import { spring } from '../lib/spring.js';

const RUN = 0.367; // one full bound of the Run clip
const OFF = 0.067; // Run: toes leave the ground…
const ON = 0.333; // …and touch down again
const TOP = 2.62; // tallest moment (the little hop) in model units, with squash room
const FLY_TOP = 2.4; // tallest moment of a bound
const FACE = 0.42; // turned toward the viewer: a three-quarter view
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export function loadKangaroo(url) {
  return new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(url);
}

/**
 * Plays the visit once. `countdown` is the block it lands on; `obstacles` are
 * elements its head must never reach (the title above). Resolves when it's gone.
 */
export function kangarooVisit({ gltf, countdown, obstacles = [], onLand, manual = false }) {
  return new Promise((resolve) => {
    // ───────────── measure the stage ─────────────
    const radius = parseFloat(getComputedStyle(countdown).borderTopRightRadius) || 0;
    const rects = () => {
      const c = countdown.getBoundingClientRect();
      return { c, obs: obstacles.filter(Boolean).map((e) => e.getBoundingClientRect()).filter((r) => r.width && r.bottom <= c.top + 4) };
    };
    const first = rects();
    const roofOver = (x0, x1, obs) => obs.reduce((m, r) => (r.right + 6 > x0 && r.left - 6 < x1 ? Math.max(m, r.bottom) : m), -Infinity);
    const room = first.c.top - roofOver(first.c.left, first.c.right, first.obs);
    const u = clamp(Number.isFinite(room) ? (room - 3) / TOP : 26, 10, 26); // px per model unit
    const h = 1.69 * u; // standing height
    const W = innerWidth;
    const above = Math.min(Number.isFinite(room) ? room + 1.6 * h : 4 * h, 6 * h); // band above the ground line
    // stage space: x from the viewport's left, y as a height above the countdown's top
    const L = first.c.left;
    const R = first.c.right;
    const relObs = first.obs.map((r) => ({ left: r.left, right: r.right, bottom: first.c.top - r.bottom })); // heights of their bottoms
    const ceilingAt = (x) => {
      const hit = relObs.filter((r) => r.right + 6 > x - 0.45 * u && r.left - 6 < x + 1.05 * u);
      return hit.length ? Math.min(...hit.map((r) => r.bottom)) : above - 2;
    };
    // the top of a gently rounded corner drops away toward the edge
    const groundAt = (x) => {
      if (x < L || x > R) return null;
      const d = x < L + radius ? L + radius - x : x > R - radius ? x - (R - radius) : 0;
      return d ? -(radius - Math.sqrt(Math.max(0, radius * radius - d * d))) : 0;
    };
    /** the highest extra arc that keeps the head under every obstacle */
    const fitRise = (x0, x1, want, topU = FLY_TOP) => {
      let best = want;
      for (let i = 1; i < 20; i++) {
        const p = i / 20;
        const free = ceilingAt(x0 + (x1 - x0) * p) - topU * u - 2;
        best = Math.min(best, free / (4 * p * (1 - p)));
      }
      return Math.max(0, best);
    };
    const G = 51 * u; // gravity (px/s²), so a plain bound lasts ~0.28s
    const airFor = (rise) => 2 * Math.sqrt((2 * (rise + 0.48 * u)) / G);

    // ───────────── the plan ─────────────
    const landX = L + radius + 0.9 * h;
    // the lip of the far corner, but never so close to the screen's edge that
    // the head would lean out of view while it teeters
    const edgeX = Math.min(R - radius * 0.42, W - 1.6 * u - 4);
    // the way in: with a wide margin beside the countdown (desktop) it leaps up
    // onto the block from lower left, peaking just as it clears the corner; on
    // phones it bounds in level from beyond the screen's edge
    const ledge = L > 2.6 * h;
    const inFrom = ledge ? -1.2 * h : -1.6 * h - 0.9 * u;
    const peak = ledge ? clamp(ceilingAt(landX) - FLY_TOP * u - 2, 2, 0.5 * h) : 0;
    const drop = ledge ? clamp((landX - inFrom) * 0.42, 1.5 * h, 6 * h) : 0;
    // the way out: off the lip with as much lift as the title above allows,
    // sailing on out of frame (a touch of hang time for the big leap)
    const exitDist = W + 2.6 * u - edgeX;
    const exitT = clamp(exitDist / (8 * h), 0.42, 0.85);
    const exitVx = exitDist / exitT;
    const gOut = G * 0.7;
    const exitY = (vy, tt) => vy * tt - (gOut * tt * tt) / 2;
    let exitVy = Math.sqrt(2 * gOut * 2.2 * h);
    for (let k = 0; k < 30; k++) {
      let ok = true;
      for (let i = 1; i <= 24 && ok; i++) {
        const tt = (exitT * i) / 24;
        if (exitY(exitVy, tt) > ceilingAt(edgeX + exitVx * tt) - FLY_TOP * u - 2) ok = false;
      }
      if (ok) break;
      exitVy *= 0.85;
    }
    const below = Math.max(0.6 * h + 16, drop + 1.3 * h, -Math.min(0, exitY(exitVy, exitT)) + 1.5 * h);
    const bandH = Math.ceil(above + below);

    // ───────────── renderer & scene ─────────────
    const canvas = document.createElement('canvas');
    canvas.className = 'roo';
    canvas.setAttribute('aria-hidden', 'true');
    Object.assign(canvas.style, { position: 'fixed', left: '0', top: '0', width: '100vw', height: `${bandH}px`, pointerEvents: 'none', zIndex: '39', willChange: 'transform' });
    document.body.appendChild(canvas);
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    } catch {
      // no WebGL 2 here (older devices): the visit simply doesn't happen
      canvas.remove();
      resolve();
      return;
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    renderer.setSize(W, bandH, false);
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;

    const scene = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(22, W / bandH, 1, 20000);
    cam.position.set(0, 0, bandH / 2 / Math.tan(THREE.MathUtils.degToRad(11)));
    // Sydney at night: cool sky fill, a warm key from the city, flag-red and blue rims
    scene.add(new THREE.HemisphereLight(0xc4d2ff, 0x1a2142, 1.35));
    const key = new THREE.DirectionalLight(0xffe4c8, 2.5);
    key.position.set(-0.6, 1, 0.9);
    const rimR = new THREE.DirectionalLight(0xff3b5c, 1.5); // along its back and tail
    rimR.position.set(-0.85, 0.6, -0.9);
    const rimB = new THREE.DirectionalLight(0x6a96ff, 1.0); // a cool edge down its front
    rimB.position.set(0.8, 0.35, -0.9);
    scene.add(key, rimR, rimB);

    const rig = new THREE.Group(); // sits at the toes: tilts and squashes about them
    const body = new THREE.Group();
    const model = gltf.scene;
    model.scale.setScalar(u);
    model.rotation.set(0, Math.PI / 2 - FACE, 0);
    model.traverse((o) => {
      if (o.isMesh) {
        o.frustumCulled = false;
        if (o.material) o.material.roughness = 0.82;
      }
    });
    body.add(model);
    rig.add(body);
    scene.add(rig);

    // soft contact shadow hugging the countdown's top edge
    const shadowTex = (() => {
      const c = document.createElement('canvas');
      c.width = c.height = 64;
      const g = c.getContext('2d');
      const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, 'rgba(0,4,16,0.75)');
      gr.addColorStop(0.55, 'rgba(0,4,16,0.32)');
      gr.addColorStop(1, 'rgba(0,4,16,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, 64, 64);
      return new THREE.CanvasTexture(c);
    })();
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthTest: false, depthWrite: false }));
    shadow.renderOrder = -1;
    scene.add(shadow);

    // glints of glass dust kicked up on landings, crumbs off the edge
    const MAXP = 64;
    const pPos = new Float32Array(MAXP * 3);
    const pCol = new Float32Array(MAXP * 3);
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
    const dotTex = (() => {
      const c = document.createElement('canvas');
      c.width = c.height = 32;
      const g = c.getContext('2d');
      const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
      gr.addColorStop(0, 'rgb(255,255,255)');
      gr.addColorStop(0.4, 'rgb(110,110,110)');
      gr.addColorStop(1, 'rgb(0,0,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, 32, 32);
      return new THREE.CanvasTexture(c);
    })();
    // light only adds: colour accumulates, alpha is left alone
    const pMat = new THREE.PointsMaterial({
      size: 2.3 * renderer.getPixelRatio(), sizeAttenuation: false, map: dotTex, vertexColors: true, transparent: true, depthWrite: false,
      blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
    });
    const points = new THREE.Points(pGeo, pMat);
    points.frustumCulled = false;
    scene.add(points);
    const parts = [];
    const emit = (x, y, n, { spread = 1, up = 1, life = 0.55, fall = false } = {}) => {
      for (let i = 0; i < n && parts.length < MAXP; i++) {
        const dir = Math.random() < 0.5 ? -1 : 1;
        parts.push({
          x: x + (Math.random() - 0.5) * 0.4 * u,
          y,
          vx: fall ? (Math.random() - 0.2) * 0.8 * u : dir * (0.6 + Math.random() * 1.6) * u * spread,
          vy: fall ? -Math.random() * 0.5 * u : (0.6 + Math.random() * 1.8) * u * up,
          life,
          max: life,
          tint: 0.75 + Math.random() * 0.25,
        });
      }
    };

    // ───────────── skeleton & clips ─────────────
    const bone = (re) => {
      let f = null;
      model.traverse((o) => { if (!f && o.isBone && re.test(o.name)) f = o; });
      return f;
    };
    const B = {
      spine: bone(/^spine_01x/), neck: bone(/^neckx/), head: bone(/^headx/),
      earL: bone(/^c_ear_01l/), earR: bone(/^c_ear_01r/), armL: bone(/^arm_stretchl/), armR: bone(/^arm_stretchr/),
      tail0: bone(/^c_tail_00x/), tail1: bone(/^c_tail_01x/), tail2: bone(/^c_tail_02x/),
      toeL: bone(/^toes_01l/), toeR: bone(/^toes_01r/), hips: bone(/^rootx/),
    };
    const rest = new Map(Object.values(B).filter(Boolean).map((b) => [b, b.quaternion.clone()]));
    const mixer = new THREE.AnimationMixer(model);
    const act = {};
    for (const clip of gltf.animations) {
      const a = mixer.clipAction(clip);
      a.play();
      a.setEffectiveWeight(0);
      act[clip.name] = a;
    }
    const FREE = ['Idle_A', 'Idle_B', 'Idle_D']; // these play on their own; Run and Idle_C are scrubbed

    // On the ground the toes are the anchor (no sliding); in the air it's the
    // hips, which fly a clean arc while the legs swing. The hand-over offsets:
    const v = new THREE.Vector3();
    const xOf = (b) => b.getWorldPosition(v).x;
    const toeX = () => (xOf(B.toeL) + xOf(B.toeR)) / 2;
    const hipToToe = (time) => {
      for (const k in act) act[k].setEffectiveWeight(k === 'Run' ? 1 : 0);
      act.Run.time = time;
      mixer.update(0);
      rig.updateMatrixWorld(true);
      return xOf(B.hips) - toeX();
    };
    const dOff = hipToToe(OFF);
    const dOn = hipToToe(ON);

    // ───────────── performance state (driven by the timeline) ─────────────
    const S = {
      x: 0, anchor: 1, lift: 0, tilt: 0, squash: 1, impact: 1, wiggle: 0,
      w: { Idle_A: 0, Idle_B: 0, Idle_C: 0, Idle_D: 0, Run: 1 },
      t: { Idle_A: 0, Idle_B: 0, Idle_C: 0.8, Idle_D: 0, Run: 0.12 },
      spine: 0, look: 0, yaw: 0, cock: 0, tail: 0, ears: 0, arms: 0,
    };
    const ear = { x: 0, v: 0 };
    const tail = { x: 0, v: 0 };
    let armPhase = 0;
    let lastLift = 0;

    // touch-downs: dust, a dip in the glass, ears and tail carried by momentum
    const land = (energy) => {
      const g = groundAt(S.x);
      if (g !== null) {
        emit(S.x, g, Math.round(3 + energy * 6), { spread: 0.6 + energy, up: 0.5 + energy * 0.6 });
        gsap.fromTo(countdown, { y: 0.5 + energy * 1.8 }, { y: 0, duration: 0.6, ease: spring({ bounce: 0.45 }), overwrite: 'auto' });
      }
      ear.v += 6 + energy * 8;
      tail.v -= 3 + energy * 5;
      gsap.fromTo(S, { impact: 1 - (0.05 + energy * 0.12) }, { impact: 1, duration: 0.5, ease: spring({ bounce: 0.42 }) });
      onLand?.(energy);
    };
    const takeoff = (energy) => {
      ear.v -= 3 + energy * 4;
      gsap.fromTo(S, { impact: 1 + 0.04 + energy * 0.03 }, { impact: 1, duration: 0.35, ease: 'power2.out' });
    };

    // ───────────── choreography ─────────────
    const tl = gsap.timeline({ paused: true, onComplete: finish });
    const fade = (from, to, at, dur) => {
      const v = {};
      for (const k of Object.keys(S.w)) v[k] = k === to ? 1 : 0;
      tl.to(S.w, { ...v, duration: dur, ease: 'sine.inOut' }, at);
      if (from && FREE.includes(to)) tl.set(S.t, { [to]: 0 }, at);
    };
    /** one bound of the Run cycle from x=a to x=b; returns the time it ends */
    const bound = (at, a, b, { rise = 0, path, air, push = 0.075, landT = 0.07, energy = 0.35, c0 = 0 } = {}) => {
      path ??= (p) => 4 * rise * p * (1 - p); // height above the top edge through the flight
      air ??= airFor(rise);
      let t = at;
      if (c0 < OFF) {
        tl.fromTo(S.t, { Run: c0 }, { Run: OFF, duration: push, ease: 'none', immediateRender: false }, t);
        tl.call(takeoff, [energy], t + push * 0.6);
        t += push;
      }
      tl.fromTo(S.t, { Run: Math.max(c0, OFF) }, { Run: ON, duration: air, ease: 'none', immediateRender: false }, t);
      tl.set(S, { anchor: 1 }, t);
      const f = { p: 0 };
      const fx0 = a + dOff;
      const fx1 = b + dOn;
      tl.fromTo(f, { p: 0 }, {
        p: 1, duration: air, ease: 'none', immediateRender: false,
        onUpdate: () => {
          S.x = fx0 + (fx1 - fx0) * f.p;
          S.lift = path(f.p);
        },
      }, t);
      t += air;
      tl.set(S, { anchor: 0, x: b, lift: 0 }, t);
      tl.call(land, [energy], t);
      tl.fromTo(S.t, { Run: ON }, { Run: RUN, duration: landT, ease: 'none', immediateRender: false }, t);
      return t + landT;
    };
    /** a little hop on the spot (Idle_C), drifting by dx: used for backing up */
    const hopBack = (at, a, dx) => {
      tl.fromTo(S.t, { Idle_C: 0.8 }, { Idle_C: 0.9, duration: 0.07, ease: 'none', immediateRender: false }, at);
      tl.fromTo(S.t, { Idle_C: 0.9 }, { Idle_C: 1.25, duration: 0.27, ease: 'none', immediateRender: false }, at + 0.07);
      tl.fromTo(S, { x: a }, { x: a + dx, duration: 0.27, ease: 'sine.inOut', immediateRender: false }, at + 0.07);
      tl.call(land, [0.18], at + 0.34);
      tl.fromTo(S.t, { Idle_C: 1.25 }, { Idle_C: 1.4, duration: 0.12, ease: 'none', immediateRender: false }, at + 0.34);
      return at + 0.46;
    };

    let t = 0;

    // 1 · the leap in
    if (ledge) {
      // a ballistic arc from lower left: rises, peaks just over the corner, lands
      const r = Math.sqrt((drop + peak) / peak);
      const pa = r / (1 + r);
      const k = peak / ((1 - pa) * (1 - pa));
      const air = Math.sqrt((2 * (drop + peak)) / G) + Math.sqrt((2 * peak) / G);
      S.x = inFrom + dOff;
      S.lift = -drop;
      t = bound(0, inFrom, landX, { path: (p) => peak - k * (p - pa) * (p - pa), air, c0: 0.1, energy: 1, landT: 0.09 });
    } else {
      const rise = fitRise(inFrom, landX, 1.7 * h);
      S.x = inFrom + dOff;
      t = bound(0, inFrom, landX, { rise, c0: 0.1, energy: 1, landT: 0.09 });
    }
    // the landing soaks in; it settles, ears up, and takes a look around
    fade('Run', 'Idle_A', t, 0.22);
    tl.to(S, { look: 0.18, duration: 0.25, ease: 'power2.out' }, t);
    tl.to(S, { look: 0, duration: 0.4, ease: 'sine.inOut' }, t + 0.3);
    fade('Idle_A', 'Idle_B', t + 0.3, 0.3);
    tl.set(S.t, { Idle_B: 0.25 }, t + 0.3);
    t += 1.05;

    // 2 · bounding along the top of the countdown
    fade('Idle_B', 'Run', t, 0.12);
    tl.set(S.t, { Run: 0 }, t);
    tl.to(S, { squash: 0.9, duration: 0.1, ease: 'power2.in' }, t); // a little gather before the first push
    tl.to(S, { squash: 1, duration: 0.18, ease: 'power2.out' }, t + 0.12);
    t += 0.1;
    const span = edgeX - landX;
    const n = clamp(Math.round(span / (1.55 * h)), 3, 7);
    let x = landX;
    for (let i = 0; i < n; i++) {
      const nx = landX + (span * (i + 1)) / n;
      const rise = fitRise(x, nx, 0.12 * (nx - x));
      t = bound(t, x, nx, { rise, energy: i === n - 1 ? 0.55 : 0.3, landT: i === n - 1 ? 0.08 : 0.06 });
      x = nx;
    }

    // 3 · whoa — the edge: momentum tips it over the drop, arms going, tail up
    fade('Run', 'Idle_A', t, 0.12);
    tl.call(() => emit(R - 2, groundAt(R - 2) ?? 0, 5, { fall: true, life: 1.3 }), null, t + 0.12);
    tl.to(S, { arms: 1, tail: 0.75, look: 0.55, spine: 0.15, ears: -0.25, duration: 0.18, ease: 'power2.out' }, t);
    const wobble = [0.62, 0.2, 0.5, 0.14, 0.4, 0.08, 0.3];
    let wt = t;
    wobble.forEach((a, i) => {
      const d = i === 0 ? 0.2 : 0.17 + i * 0.012;
      tl.to(S, { tilt: a, duration: d, ease: i === 0 ? 'power2.out' : 'sine.inOut' }, wt);
      wt += d;
    });
    tl.call(() => emit(R - 2, groundAt(R - 2) ?? 0, 3, { fall: true, life: 1.2 }), null, t + 0.7);
    t = wt;
    // …and it saves itself: pulls back, stands tall, ears straight up
    tl.to(S, { tilt: -0.16, arms: 0, tail: 0, look: -0.12, spine: -0.05, ears: -0.35, duration: 0.32, ease: 'power3.out' }, t);
    fade('Idle_A', 'Idle_D', t, 0.28);
    tl.set(S.t, { Idle_D: 0.35 }, t);
    t += 0.42;
    // a glance at the audience — did you see that?
    tl.to(S, { yaw: 0.85, cock: 0.32, duration: 0.24, ease: 'power2.out' }, t);
    tl.to(S, { yaw: 0, cock: 0, duration: 0.26, ease: 'power2.inOut' }, t + 0.7);
    tl.to(S, { tilt: 0, ears: 0, look: 0, duration: 0.4, ease: 'sine.inOut' }, t + 0.5);
    t += 0.96;

    // 4 · a few cautious hops back from the edge
    fade('Idle_D', 'Idle_C', t, 0.16);
    tl.set(S.t, { Idle_C: 0.8 }, t);
    t += 0.12;
    const back = 0.62 * h;
    let bx = edgeX;
    for (let i = 0; i < 3; i++) {
      t = hopBack(t, bx, -back);
      bx -= back;
    }

    // 5 · gathers itself — a wiggle, ears back — and goes for it
    fade('Idle_C', 'Run', t, 0.14);
    tl.set(S.t, { Run: 0 }, t);
    tl.to(S, { squash: 0.86, tilt: 0.12, ears: 0.45, duration: 0.18, ease: 'power2.out' }, t);
    tl.fromTo(S, { wiggle: -1.3 }, { wiggle: 1.3, duration: 0.06, repeat: 5, yoyo: true, ease: 'sine.inOut', immediateRender: false }, t + 0.12);
    tl.to(S, { wiggle: 0, duration: 0.05 }, t + 0.48);
    t += 0.55;
    tl.to(S, { squash: 1, tilt: 0, duration: 0.12, ease: 'power2.in' }, t - 0.06);
    const mid = bx + (edgeX - bx) * 0.5;
    t = bound(t, bx, mid, { rise: fitRise(bx, mid, 0.15 * (mid - bx)), energy: 0.4, landT: 0.05, push: 0.06 });
    t = bound(t, mid, edgeX, { rise: fitRise(mid, edgeX, 0.15 * (edgeX - mid)), energy: 0.45, landT: 0.05, push: 0.05 });
    // the launch: off the lip and out of frame, stretched long through the air
    tl.fromTo(S.t, { Run: 0 }, { Run: OFF, duration: 0.06, ease: 'none', immediateRender: false }, t);
    tl.call(takeoff, [1], t + 0.04);
    t += 0.06;
    tl.set(S, { anchor: 1 }, t);
    const fo = { p: 0 };
    tl.fromTo(fo, { p: 0 }, {
      p: 1, duration: exitT, ease: 'none', immediateRender: false,
      onUpdate: () => {
        const tt = fo.p * exitT;
        S.x = edgeX + dOff + exitVx * tt;
        S.lift = exitY(exitVy, tt);
      },
    }, t);
    tl.fromTo(S.t, { Run: OFF }, { Run: 0.3, duration: exitT, ease: 'sine.inOut', immediateRender: false }, t);
    tl.to(S, { tail: 0.35, duration: exitT * 0.4 }, t);
    // (the timeline ends right as it clears the right edge)

    // ───────────── per-frame: pose, secondary motion, placement ─────────────
    const frame = (time, dtMs) => {
      const dt = Math.min(0.05, dtMs / 1000);
      for (const k of FREE) S.t[k] += dt;
      rest.forEach((q, b) => b.quaternion.copy(q)); // bones the clips don't drive start clean
      let sum = 0;
      for (const k in act) sum += S.w[k] || 0;
      for (const k in act) {
        const a = act[k];
        const d = a.getClip().duration;
        a.setEffectiveWeight(sum ? (S.w[k] || 0) / sum : 0);
        a.time = k === 'Idle_C' ? clamp(S.t[k], 0, d - 1e-3) : ((S.t[k] % d) + d) % d;
      }
      mixer.update(0);

      // secondary motion: ears and tail lag the body's vertical motion
      const vy = (S.lift - lastLift) / Math.max(dt, 1e-3);
      lastLift = S.lift;
      const step = (s, target, k, c) => {
        s.v += (-(s.x - target) * k - s.v * c) * dt;
        s.x += s.v * dt;
      };
      step(ear, clamp(vy / (h * 9), -0.35, 0.55), 160, 11);
      step(tail, clamp(-vy / (h * 7), -0.45, 0.45), 90, 9);
      B.spine?.rotateX(S.spine);
      B.neck?.rotateX(S.look);
      B.head?.rotateY(S.yaw);
      B.head?.rotateZ(S.cock);
      const e = S.ears + ear.x;
      B.earL?.rotateX(e);
      B.earR?.rotateX(e);
      const tr = S.tail + tail.x;
      B.tail0?.rotateX(tr * 0.55);
      B.tail1?.rotateX(tr * 0.35);
      B.tail2?.rotateX(tr * 0.25);
      if (S.arms > 0.01) {
        armPhase += dt * 15;
        B.armL?.rotateX(S.arms * (0.6 + 1.2 * Math.sin(armPhase)));
        B.armR?.rotateX(S.arms * (0.6 + 1.2 * Math.sin(armPhase + 2.3)));
      }

      // keep the toes on the anchor: no foot sliding while the body moves over them
      rig.position.set(0, 0, 0);
      rig.rotation.set(0, 0, 0);
      rig.scale.set(1, 1, 1);
      body.position.set(0, 0, 0);
      rig.updateMatrixWorld(true);
      const tx = toeX();
      const hx = xOf(B.hips);
      body.position.x = -(S.anchor > 0.5 ? hx : tx);

      // follow the countdown wherever the page has scrolled it
      const c = countdown.getBoundingClientRect();
      canvas.style.transform = `translate3d(0, ${c.top - above}px, 0)`;
      const toWorldY = (height) => bandH / 2 - (above - height);
      const gx = S.x + S.wiggle;
      const ground = groundAt(gx);
      rig.position.set(gx - W / 2, toWorldY((ground ?? 0) + S.lift), 0);
      rig.rotation.z = -S.tilt;
      const sq = S.squash * S.impact;
      rig.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));

      // the shadow stays on the glass and thins out as it rises
      const sx = gx + hx + body.position.x - 0.25 * u; // under the body
      const sg = groundAt(sx);
      const air = clamp(S.lift / (1.8 * h), 0, 1);
      shadow.visible = sg !== null;
      if (shadow.visible) {
        shadow.position.set(sx - W / 2, toWorldY(sg) - 0.04 * u, -0.6 * u);
        shadow.scale.set(2.4 * u * (1 - 0.4 * air), 0.42 * u * (1 - 0.3 * air), 1);
        shadow.material.opacity = 0.9 * (1 - air) * clamp((Math.min(sx - L, R - sx) + 0.5 * u) / (1.2 * u), 0, 1);
      }

      // particles
      let w = 0;
      for (let i = 0; i < parts.length; i++) {
        const p = parts[i];
        p.life -= dt;
        if (p.life <= 0) continue;
        p.vy -= 6 * u * dt;
        p.vx *= Math.exp(-2.2 * dt);
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        parts[w++] = p;
      }
      parts.length = w;
      for (let i = 0; i < MAXP; i++) {
        const p = parts[i];
        const a = p ? Math.min(1, (p.life / p.max) * 1.6) * p.tint : 0;
        pPos[i * 3] = p ? p.x - W / 2 : 0;
        pPos[i * 3 + 1] = p ? toWorldY(p.y) : -1e5;
        pPos[i * 3 + 2] = 0.5 * u;
        pCol[i * 3] = a * 0.86;
        pCol[i * 3 + 1] = a * 0.92;
        pCol[i * 3 + 2] = a;
      }
      pGeo.attributes.position.needsUpdate = true;
      pGeo.attributes.color.needsUpdate = true;

      renderer.render(scene, cam);
    };

    let done = false;
    function finish() {
      if (done) return;
      done = true;
      gsap.ticker.remove(frame);
      removeEventListener('resize', bail);
      mixer.stopAllAction();
      renderer.dispose();
      shadowTex.dispose();
      dotTex.dispose();
      pGeo.dispose();
      pMat.dispose();
      shadow.geometry.dispose();
      shadow.material.dispose();
      canvas.remove();
      gsap.set(countdown, { y: 0 });
      resolve();
    }
    // a rotated phone or resized window changes the stage: bow out gracefully
    const bail = () => {
      if (Math.abs(innerWidth - W) < 2) return;
      tl.kill();
      gsap.to(canvas, { opacity: 0, duration: 0.3, onComplete: finish });
    };
    addEventListener('resize', bail);

    frame(0, 16);
    if (manual) {
      // tests drive GSAP's clock themselves and render frame by frame
      window.__roo = { duration: tl.duration(), start: () => tl.play(), render: (dt) => frame(0, dt * 1000) };
      return;
    }
    tl.play();
    gsap.ticker.add(frame);
  });
}
