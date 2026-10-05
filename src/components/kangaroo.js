// The AusMC kangaroo. One skinned model (three.js, real Run/Idle clips) with
// hand-tuned secondary motion layered on top, performing in three places:
//   · kangarooVisit  — once: bounds along the countdown, nearly topples off
//                      the far edge, backs up and launches out of frame
//   · kangarooWander — lives on top of the map frame: lost, finds the pin,
//                      follows it when the location changes
//   · kangarooPeek   — leans in from the screen's edge with a speech bubble
// Loaded on demand; each stage renders only while it's on screen.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { gsap } from 'gsap';
import { spring } from '../lib/spring.js';

const RUN = 0.367; // one full bound of the Run clip
const OFF = 0.067; // Run: toes leave the ground…
const ON = 0.333; // …and touch down again
const TOP = 2.62; // tallest moment (the little hop) in model units, with squash room
const FLY_TOP = 2.4; // tallest moment of a bound
const FACE = 0.42; // turned toward the viewer: a three-quarter view
const FREE = ['Idle_A', 'Idle_B', 'Idle_D']; // these play on their own; Run and Idle_C are scrubbed
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export function loadKangaroo(url) {
  return new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(url);
}

// ───────────────────────── shared pieces ─────────────────────────

function makeRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  return renderer;
}

/** Sydney at night: cool sky fill, a warm key from the city, flag-red and blue rims */
function addLights(scene) {
  scene.add(new THREE.HemisphereLight(0xc4d2ff, 0x1a2142, 1.35));
  const key = new THREE.DirectionalLight(0xffe4c8, 2.5);
  key.position.set(-0.6, 1, 0.9);
  const rimR = new THREE.DirectionalLight(0xff3b5c, 1.5); // along its back and tail
  rimR.position.set(-0.85, 0.6, -0.9);
  const rimB = new THREE.DirectionalLight(0x6a96ff, 1.0); // a cool edge down its front
  rimB.position.set(0.8, 0.35, -0.9);
  scene.add(key, rimR, rimB);
}

/** px-per-unit camera: world (x, y) at z=0 lands on canvas pixels */
function pixelCamera(w, hgt, fov = 22) {
  const cam = new THREE.PerspectiveCamera(fov, w / hgt, 1, 20000);
  cam.position.set(0, 0, hgt / 2 / Math.tan(THREE.MathUtils.degToRad(fov / 2)));
  return cam;
}

/**
 * The kangaroo itself: a fresh copy of the model, its clips and the layered
 * motion (head, ears, tail, arms, jaw) driven by a plain state object.
 */
function makeKangaroo(gltf, u) {
  const model = cloneSkinned(gltf.scene);
  model.scale.setScalar(u);
  model.traverse((o) => {
    if (o.isMesh) {
      o.frustumCulled = false;
      if (o.material) o.material.roughness = 0.82;
    }
  });
  const bone = (re) => {
    let f = null;
    model.traverse((o) => { if (!f && o.isBone && re.test(o.name)) f = o; });
    return f;
  };
  const B = {
    spine: bone(/^spine_01x/), neck: bone(/^neckx/), head: bone(/^headx/), jaw: bone(/^jaw/),
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
  const S = {
    x: 0, anchor: 0, lift: 0, tilt: 0, squash: 1, impact: 1, wiggle: 0, face: 1,
    w: { Idle_A: 1, Idle_B: 0, Idle_C: 0, Idle_D: 0, Run: 0 },
    t: { Idle_A: 0, Idle_B: 0, Idle_C: 0.8, Idle_D: 0, Run: 0 },
    spine: 0, look: 0, yaw: 0, cock: 0, tail: 0, ears: 0, arms: 0, jaw: 0,
  };
  const ear = { x: 0, v: 0 };
  const tail = { x: 0, v: 0 };
  let armPhase = 0;
  let lastLift = 0;
  const v = new THREE.Vector3();
  const xOf = (b) => b.getWorldPosition(v).x;

  /** applies clips + layered motion for this frame */
  const pose = (dt, h) => {
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
    B.jaw?.rotateX(S.jaw);
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
  };
  return { model, B, act, mixer, S, ear, tail, pose, xOf, toeX: () => (xOf(B.toeL) + xOf(B.toeR)) / 2 };
}

const softTexture = (size, stops, opaque = false) => {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  stops.forEach(([o, col]) => gr.addColorStop(o, col));
  g.fillStyle = opaque ? '#000' : 'rgba(0,0,0,0)';
  g.fillRect(0, 0, size, size);
  g.fillStyle = gr;
  g.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(c);
};

// ───────────────────────── a stage along an element's top edge ─────────────────────────

/**
 * Builds the kangaroo on top of `anchor` (the countdown, the map frame) and
 * hands a toolkit to `choreo`. The band canvas follows the element wherever
 * the page scrolls; `obstacles` are elements the head must never reach.
 */
function edgeStage({ gltf, anchor, obstacles = [], onLand, uMax = 26, manual = false, persistent = false }, choreo) {
  return new Promise((resolve) => {
    // ───────────── measure ─────────────
    const radius = parseFloat(getComputedStyle(anchor).borderTopRightRadius) || 0;
    const c0 = anchor.getBoundingClientRect();
    // where obstacles will rest (ignoring an entrance still sliding them in)
    const restRect = (e) => {
      const r = e.getBoundingClientRect();
      const dy = Number(gsap.getProperty(e, 'y')) || 0;
      return { left: r.left, right: r.right, top: r.top - dy, bottom: r.bottom - dy, width: r.width };
    };
    const obs = obstacles.filter(Boolean).map(restRect).filter((r) => r.width && r.bottom <= c0.top + 4);
    const roofOver = (x0, x1) => obs.reduce((m, r) => (r.right + 6 > x0 && r.left - 6 < x1 ? Math.max(m, r.bottom) : m), -Infinity);
    const room = c0.top - roofOver(c0.left, c0.right);
    const u = clamp(Number.isFinite(room) ? (room - 3) / TOP : uMax, 10, uMax); // px per model unit
    const h = 1.69 * u; // standing height
    const W = innerWidth;
    const above = Math.min(Number.isFinite(room) ? room + 1.6 * h : 4 * h, 6 * h); // band above the top edge
    // stage space: x from the viewport's left, heights above the element's top edge
    const L = c0.left;
    const R = c0.right;
    const relObs = obs.map((r) => ({ left: r.left, right: r.right, bottom: c0.top - r.bottom }));
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

    // ───────────── the entrance and exit, worked out from the layout ─────────────
    const landX = L + radius + 0.9 * h;
    // the lip of the far corner, never so close to the screen's edge that the
    // head would lean out of view
    const edgeX = Math.min(R - radius * 0.42, W - 1.6 * u - 4);
    // with a wide margin beside the element (desktop) it leaps up from lower
    // left, peaking just as it clears the corner; on phones it bounds in level
    const ledge = L > 2.6 * h;
    const inFrom = ledge ? -1.2 * h : -1.6 * h - 0.9 * u;
    const peak = ledge ? clamp(ceilingAt(landX) - FLY_TOP * u - 2, 2, 0.5 * h) : 0;
    const drop = ledge ? clamp((landX - inFrom) * 0.42, 1.5 * h, 6 * h) : 0;
    // off the lip with as much lift as the space above allows, sailing out of frame
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
    const below = Math.max(0.6 * h + 16, drop + 1.3 * h, persistent ? 0 : -Math.min(0, exitY(exitVy, exitT)) + 1.5 * h);
    const bandH = Math.ceil(above + below);

    // ───────────── renderer & scene ─────────────
    const canvas = document.createElement('canvas');
    canvas.className = 'roo';
    canvas.setAttribute('aria-hidden', 'true');
    Object.assign(canvas.style, { position: 'fixed', left: '0', top: '0', width: '100vw', height: `${bandH}px`, pointerEvents: 'none', zIndex: '39', willChange: 'transform' });
    document.body.appendChild(canvas);
    let renderer;
    try {
      renderer = makeRenderer(canvas);
    } catch {
      canvas.remove(); // no WebGL 2 here (older devices): no kangaroo
      resolve();
      return;
    }
    renderer.setSize(W, bandH, false);
    const scene = new THREE.Scene();
    const cam = pixelCamera(W, bandH);
    addLights(scene);

    const K = makeKangaroo(gltf, u);
    const { S, B, act, mixer, ear, tail } = K;
    const rig = new THREE.Group(); // sits at the toes: tilts and squashes about them
    const body = new THREE.Group();
    body.add(K.model);
    rig.add(body);
    scene.add(rig);

    // soft contact shadow hugging the top edge
    const shadowTex = softTexture(64, [[0, 'rgba(0,4,16,0.75)'], [0.55, 'rgba(0,4,16,0.32)'], [1, 'rgba(0,4,16,0)']]);
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
    const dotTex = softTexture(32, [[0, 'rgb(255,255,255)'], [0.4, 'rgb(110,110,110)'], [1, 'rgb(0,0,0)']], true);
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

    // On the ground the toes are the anchor (no sliding); in the air it's the
    // hips, which fly a clean arc while the legs swing. The hand-over offsets:
    const hipToToe = (time) => {
      for (const k in act) act[k].setEffectiveWeight(k === 'Run' ? 1 : 0);
      act.Run.time = time;
      mixer.update(0);
      K.model.rotation.set(0, Math.PI / 2 - FACE, 0);
      rig.updateMatrixWorld(true);
      return K.xOf(B.hips) - K.toeX();
    };
    const dOff = hipToToe(OFF);
    const dOn = hipToToe(ON);

    // touch-downs: dust, a dip in the glass, ears and tail carried by momentum
    const land = (energy) => {
      const g = groundAt(S.x);
      if (g !== null) {
        emit(S.x, g, Math.round(3 + energy * 6), { spread: 0.6 + energy, up: 0.5 + energy * 0.6 });
        gsap.fromTo(anchor, { translate: `0 ${(0.5 + energy * 1.8).toFixed(2)}px` }, { translate: '0 0px', duration: 0.6, ease: spring({ bounce: 0.45 }), overwrite: 'auto' });
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

    // ───────────── choreography toolkit ─────────────
    let tl = gsap.timeline({ paused: true });
    const fade = (to, at, dur) => {
      const w = {};
      for (const k of Object.keys(S.w)) w[k] = k === to ? 1 : 0;
      tl.to(S.w, { ...w, duration: dur, ease: 'sine.inOut' }, at);
      if (FREE.includes(to)) tl.set(S.t, { [to]: 0 }, at);
    };
    /** one bound of the Run cycle from x=a to x=b; returns the time it ends */
    const bound = (at, a, b, { rise = 0, path, air, push = 0.075, landT = 0.07, energy = 0.35, c0: cs = 0 } = {}) => {
      path ??= (p) => 4 * rise * p * (1 - p); // height above the top edge through the flight
      air ??= airFor(rise);
      const dir = Math.sign(b - a) || 1;
      let t = at;
      if (cs < OFF) {
        tl.fromTo(S.t, { Run: cs }, { Run: OFF, duration: push, ease: 'none', immediateRender: false }, t);
        tl.call(takeoff, [energy], t + push * 0.6);
        t += push;
      }
      tl.fromTo(S.t, { Run: Math.max(cs, OFF) }, { Run: ON, duration: air, ease: 'none', immediateRender: false }, t);
      tl.set(S, { anchor: 1 }, t);
      const f = { p: 0 };
      const fx0 = a + dOff * dir;
      const fx1 = b + dOn * dir;
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
    /** a little hop on the spot (Idle_C), drifting by dx */
    const hop = (at, a, dx = 0, energy = 0.18) => {
      tl.fromTo(S.t, { Idle_C: 0.8 }, { Idle_C: 0.9, duration: 0.07, ease: 'none', immediateRender: false }, at);
      tl.fromTo(S.t, { Idle_C: 0.9 }, { Idle_C: 1.25, duration: 0.27, ease: 'none', immediateRender: false }, at + 0.07);
      tl.fromTo(S, { x: a }, { x: a + dx, duration: 0.27, ease: 'sine.inOut', immediateRender: false }, at + 0.07);
      tl.call(land, [energy], at + 0.34);
      tl.fromTo(S.t, { Idle_C: 1.25 }, { Idle_C: 1.4, duration: 0.12, ease: 'none', immediateRender: false }, at + 0.34);
      return at + 0.46;
    };
    /** the way in (see the plan above); returns the time it has landed */
    const enter = (at = 0) => {
      S.w = { Idle_A: 0, Idle_B: 0, Idle_C: 0, Idle_D: 0, Run: 1 };
      S.t.Run = 0.12;
      S.anchor = 1;
      if (ledge) {
        // a ballistic arc from lower left: rises, peaks just over the corner, lands
        const r = Math.sqrt((drop + peak) / peak);
        const pa = r / (1 + r);
        const k = peak / ((1 - pa) * (1 - pa));
        const air = Math.sqrt((2 * (drop + peak)) / G) + Math.sqrt((2 * peak) / G);
        S.x = inFrom + dOff;
        S.lift = -drop;
        return bound(at, inFrom, landX, { path: (p) => peak - k * (p - pa) * (p - pa), air, c0: 0.1, energy: 1, landT: 0.09 });
      }
      S.x = inFrom + dOff;
      return bound(at, inFrom, landX, { rise: fitRise(inFrom, landX, 1.7 * h), c0: 0.1, energy: 1, landT: 0.09 });
    };

    // ───────────── per frame: pose, placement, shadow, particles ─────────────
    const frame = (time, dtMs) => {
      const dt = Math.min(0.05, dtMs / 1000);
      K.pose(dt, h);
      const dir = S.face >= 0 ? 1 : -1;
      K.model.rotation.set(0, S.face * (Math.PI / 2 - FACE), 0);
      // keep the toes on the anchor: no foot sliding while the body moves over them
      rig.position.set(0, 0, 0);
      rig.rotation.set(0, 0, 0);
      rig.scale.set(1, 1, 1);
      body.position.set(0, 0, 0);
      rig.updateMatrixWorld(true);
      const hx = K.xOf(B.hips);
      body.position.x = -(S.anchor > 0.5 ? hx : K.toeX());

      // follow the element wherever the page has scrolled it
      const c = anchor.getBoundingClientRect();
      canvas.style.transform = `translate3d(0, ${c.top - above}px, 0)`;
      const toWorldY = (height) => bandH / 2 - (above - height);
      const gx = S.x + S.wiggle;
      const ground = groundAt(gx);
      rig.position.set(gx - W / 2, toWorldY((ground ?? 0) + S.lift), 0);
      rig.rotation.z = -S.tilt * dir;
      const sq = S.squash * S.impact;
      rig.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));

      // the shadow stays on the glass and thins out as it rises
      const sx = gx + hx + body.position.x - 0.25 * u * dir; // under the body
      const sg = groundAt(sx);
      const air = clamp(S.lift / (1.8 * h), 0, 1);
      shadow.visible = sg !== null;
      if (shadow.visible) {
        shadow.position.set(sx - W / 2, toWorldY(sg) - 0.04 * u, -0.6 * u);
        shadow.scale.set(2.4 * u * (1 - 0.4 * air), 0.42 * u * (1 - 0.3 * air), 1);
        shadow.material.opacity = 0.9 * (1 - air) * clamp((Math.min(sx - L, R - sx) + 0.5 * u) / (1.2 * u), 0, 1);
      }

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

    // ───────────── lifecycle ─────────────
    let done = false;
    let running = false;
    const run = (on) => {
      if (on === running || done) return;
      running = on;
      canvas.style.visibility = on ? 'visible' : 'hidden';
      if (on) {
        gsap.ticker.add(frame);
        tl.resume();
      } else {
        gsap.ticker.remove(frame);
        tl.pause();
      }
    };
    const cleanups = [];
    function finish() {
      if (done) return;
      done = true;
      gsap.ticker.remove(frame);
      tl.kill();
      cleanups.forEach((f) => f());
      mixer.stopAllAction();
      renderer.dispose();
      shadowTex.dispose();
      dotTex.dispose();
      pGeo.dispose();
      pMat.dispose();
      shadow.geometry.dispose();
      shadow.material.dispose();
      canvas.remove();
      gsap.set(anchor, { translate: '0 0px' });
      resolve();
    }
    // a rotated phone or resized window changes the stage: bow out gracefully
    const bail = () => {
      if (Math.abs(innerWidth - W) < 2) return;
      tl.kill();
      gsap.to(canvas, { opacity: 0, duration: 0.3, onComplete: finish });
    };
    addEventListener('resize', bail);
    cleanups.push(() => removeEventListener('resize', bail));

    const kit = {
      S, u, h, W, L, R, radius, landX, edgeX, G, airFor, fitRise, groundAt, ceilingAt, emit, land, takeoff, fade, bound, hop, enter,
      exit: { T: exitT, vx: exitVx, vy: exitVy, y: exitY }, dOff,
      /** the timeline the toolkit writes into; swap in a fresh one per beat */
      get tl() { return tl; },
      use(next) {
        tl.kill();
        tl = next;
        if (!running) tl.pause();
        return tl;
      },
      finish,
      cleanup: (f) => cleanups.push(f),
    };
    choreo(kit);

    frame(0, 16);
    if (manual) {
      // tests drive GSAP's clock themselves and render frame by frame
      canvas.style.visibility = 'visible';
      running = true;
      window.__roo = { duration: tl.duration(), start: () => tl.play(), render: (dt) => frame(0, dt * 1000), kit };
      return;
    }
    if (persistent) {
      // render only while the element is on screen
      const io = new IntersectionObserver((es) => run(es.some((e) => e.isIntersecting)), { rootMargin: '80px 0px' });
      io.observe(anchor);
      cleanups.push(() => io.disconnect());
    } else {
      run(true);
    }
  });
}

// ───────────────────────── 1 · the countdown visit ─────────────────────────

export function kangarooVisit(opts) {
  return edgeStage({ ...opts, anchor: opts.countdown }, (k) => {
    const { S, h, R, edgeX, landX, groundAt, fitRise, emit, bound, hop, fade, takeoff } = k;
    const tl = k.tl;
    tl.eventCallback('onComplete', k.finish);

    // 1 · the leap in; the landing soaks in, it settles and looks around
    let t = k.enter(0);
    fade('Idle_A', t, 0.22);
    tl.to(S, { look: 0.18, duration: 0.25, ease: 'power2.out' }, t);
    tl.to(S, { look: 0, duration: 0.4, ease: 'sine.inOut' }, t + 0.3);
    fade('Idle_B', t + 0.3, 0.3);
    tl.set(S.t, { Idle_B: 0.25 }, t + 0.3);
    t += 1.05;

    // 2 · bounding along the top of the countdown
    fade('Run', t, 0.12);
    tl.set(S.t, { Run: 0 }, t);
    tl.to(S, { squash: 0.9, duration: 0.1, ease: 'power2.in' }, t); // a little gather before the first push
    tl.to(S, { squash: 1, duration: 0.18, ease: 'power2.out' }, t + 0.12);
    t += 0.1;
    const span = edgeX - landX;
    const n = clamp(Math.round(span / (1.55 * h)), 3, 7);
    let x = landX;
    for (let i = 0; i < n; i++) {
      const nx = landX + (span * (i + 1)) / n;
      t = bound(t, x, nx, { rise: fitRise(x, nx, 0.12 * (nx - x)), energy: i === n - 1 ? 0.55 : 0.3, landT: i === n - 1 ? 0.08 : 0.06 });
      x = nx;
    }

    // 3 · whoa — the edge: momentum tips it over the drop, arms going, tail up
    fade('Idle_A', t, 0.12);
    tl.call(() => emit(R - 2, groundAt(R - 2) ?? 0, 5, { fall: true, life: 1.3 }), null, t + 0.12);
    tl.to(S, { arms: 1, tail: 0.75, look: 0.55, spine: 0.15, ears: -0.25, duration: 0.18, ease: 'power2.out' }, t);
    let wt = t;
    [0.62, 0.2, 0.5, 0.14, 0.4, 0.08, 0.3].forEach((a, i) => {
      const d = i === 0 ? 0.2 : 0.17 + i * 0.012;
      tl.to(S, { tilt: a, duration: d, ease: i === 0 ? 'power2.out' : 'sine.inOut' }, wt);
      wt += d;
    });
    tl.call(() => emit(R - 2, groundAt(R - 2) ?? 0, 3, { fall: true, life: 1.2 }), null, t + 0.7);
    t = wt;
    // …and it saves itself: pulls back, stands tall, ears straight up
    tl.to(S, { tilt: -0.16, arms: 0, tail: 0, look: -0.12, spine: -0.05, ears: -0.35, duration: 0.32, ease: 'power3.out' }, t);
    fade('Idle_D', t, 0.28);
    tl.set(S.t, { Idle_D: 0.35 }, t);
    t += 0.42;
    // a glance at the audience — did you see that?
    tl.to(S, { yaw: 0.85, cock: 0.32, duration: 0.24, ease: 'power2.out' }, t);
    tl.to(S, { yaw: 0, cock: 0, duration: 0.26, ease: 'power2.inOut' }, t + 0.7);
    tl.to(S, { tilt: 0, ears: 0, look: 0, duration: 0.4, ease: 'sine.inOut' }, t + 0.5);
    t += 0.96;

    // 4 · a few cautious hops back from the edge
    fade('Idle_C', t, 0.16);
    tl.set(S.t, { Idle_C: 0.8 }, t);
    t += 0.12;
    const back = 0.62 * h;
    let bx = edgeX;
    for (let i = 0; i < 3; i++) {
      t = hop(t, bx, -back);
      bx -= back;
    }

    // 5 · gathers itself — a wiggle, ears back — and goes for it
    fade('Run', t, 0.14);
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
    const { T, vx, vy, y } = k.exit;
    tl.fromTo(fo, { p: 0 }, {
      p: 1, duration: T, ease: 'none', immediateRender: false,
      onUpdate: () => {
        const tt = fo.p * T;
        S.x = edgeX + k.dOff + vx * tt;
        S.lift = y(vy, tt);
      },
    }, t);
    tl.fromTo(S.t, { Run: OFF }, { Run: 0.3, duration: T, ease: 'sine.inOut', immediateRender: false }, t);
    tl.to(S, { tail: 0.35, duration: T * 0.4 }, t);
    // (the timeline ends right as it clears the right edge)
  });
}

// ───────────────────────── 2 · living on the map frame ─────────────────────────

/**
 * A tourist on top of the map: arrives, is lost (looks around, studies the map,
 * scans the horizon), spots the pin and hops over to stand right above it — then
 * idles, and follows the pin whenever the location changes.
 */
export function kangarooWander(opts) {
  return edgeStage({ ...opts, persistent: true }, (k) => {
    const { S, h, L, R, radius, fitRise, fade, bound, hop } = k;
    const lo = L + radius + 0.6 * h;
    const hi = R - radius - 0.6 * h;
    const pinX = () => {
      const m = document.querySelector('.venue .marker.is-active');
      const r = m?.getBoundingClientRect();
      return r?.width ? clamp(r.left + r.width / 2, lo, hi) : null;
    };
    // beats are planned ahead: track where it will be and which way it faces
    const plan = { x: 0, face: 1 };
    const yawToViewer = () => 0.85 * plan.face;
    let pending = null;
    const beat = (build, then = rest) => {
      pending?.kill();
      plan.x = S.x;
      plan.face = S.face >= 0 ? 1 : -1;
      const tl = k.use(gsap.timeline());
      const end = build(tl);
      tl.to({}, { duration: 0.001 }, end); // pins the beat's length
      tl.eventCallback('onComplete', then);
      return tl;
    };
    /** turn to face the direction of travel, through the viewer */
    const turnTo = (tl, at, dir) => {
      if (plan.face === dir) return at;
      plan.face = dir;
      tl.to(S, { face: dir, duration: 0.34, ease: 'sine.inOut' }, at);
      return at + 0.34;
    };
    /** hop along the frame's top to stand above x */
    const travel = (tl, at, to) => {
      let t = at;
      const from = plan.x;
      if (Math.abs(to - from) < 0.4 * h) return t;
      plan.x = to;
      const dir = Math.sign(to - from);
      t = turnTo(tl, t, dir);
      fade('Run', t, 0.12);
      tl.set(S.t, { Run: 0 }, t);
      t += 0.08;
      const n = Math.max(1, Math.round(Math.abs(to - from) / (1.5 * h)));
      let x = from;
      for (let i = 0; i < n; i++) {
        const nx = from + ((to - from) * (i + 1)) / n;
        t = bound(t, x, nx, { rise: fitRise(x, nx, 0.12 * Math.abs(nx - x)), energy: 0.3, landT: 0.06 });
        x = nx;
      }
      fade('Idle_A', t, 0.16);
      return t + 0.18;
    };
    /** spots the pin below: looks down, ears up — aha — a happy hop, a nod to you */
    const found = (tl, at) => {
      let t = at;
      tl.to(S, { look: 0.75, cock: 0.3, spine: 0.12, duration: 0.35, ease: 'power2.out' }, t);
      t += 0.75;
      tl.to(S, { look: 0, cock: 0, spine: 0, ears: -0.45, duration: 0.2, ease: 'back.out(2)' }, t);
      fade('Idle_C', t + 0.05, 0.1);
      tl.set(S.t, { Idle_C: 0.8 }, t + 0.05);
      t = hop(t + 0.1, plan.x, 0, 0.3);
      fade('Idle_A', t, 0.2);
      tl.to(S, { yaw: yawToViewer(), duration: 0.25, ease: 'power2.out' }, t);
      tl.to(S, { look: 0.3, duration: 0.14, yoyo: true, repeat: 1, ease: 'sine.inOut' }, t + 0.3); // a nod: this way
      tl.to(S, { yaw: 0, ears: 0, duration: 0.3, ease: 'power2.inOut' }, t + 0.9);
      return t + 1.25;
    };
    /** a lost little tourist: looks around, studies the map, scans the horizon */
    const lost = (tl, at) => {
      let t = at;
      fade('Idle_B', t, 0.25);
      tl.set(S.t, { Idle_B: 0.2 }, t);
      tl.to(S, { cock: 0.35, duration: 0.3, ease: 'power2.out' }, t + 0.5);
      tl.to(S, { cock: -0.2, duration: 0.35, ease: 'sine.inOut' }, t + 1.1);
      t += 1.7;
      fade('Idle_A', t, 0.25);
      tl.to(S, { look: 0.7, cock: 0.25, spine: 0.1, duration: 0.4, ease: 'power2.out' }, t); // what does this map say…
      tl.to(S, { cock: -0.25, duration: 0.45, ease: 'sine.inOut' }, t + 0.6);
      t += 1.25;
      tl.to(S, { look: 0, cock: 0, spine: 0, duration: 0.3, ease: 'power2.inOut' }, t);
      fade('Idle_D', t, 0.3);
      tl.set(S.t, { Idle_D: 0.3 }, t);
      tl.to(S, { yaw: -0.6, duration: 0.55, ease: 'sine.inOut' }, t + 0.35); // scanning the horizon
      tl.to(S, { yaw: 0.6, duration: 0.8, ease: 'sine.inOut' }, t + 0.95);
      tl.to(S, { yaw: 0, duration: 0.4, ease: 'sine.inOut' }, t + 1.8);
      t += 2.2;
      fade('Idle_A', t, 0.3);
      return t + 0.3;
    };
    const goToPin = () => beat((tl) => {
      const x = pinX() ?? (lo + hi) / 2;
      let t = travel(tl, 0, x);
      t = turnTo(tl, t, x >= (lo + hi) / 2 ? -1 : 1); // face back across the map
      return found(tl, t);
    });
    // idle life: little beats with rests in between
    const idleBeats = [
      (tl) => { fade('Idle_B', 0, 0.25); tl.set(S.t, { Idle_B: 0 }, 0); fade('Idle_A', 2.1, 0.3); return 2.4; },
      (tl) => {
        tl.to(S, { look: 0.65, cock: 0.3, duration: 0.4, ease: 'power2.out' }, 0);
        tl.to(S, { look: 0, cock: 0, duration: 0.4, ease: 'power2.inOut' }, 1.4);
        return 1.8;
      },
      (tl) => {
        fade('Idle_D', 0, 0.3);
        tl.set(S.t, { Idle_D: 0.3 }, 0);
        tl.to(S, { yaw: yawToViewer(), cock: 0.25, duration: 0.3, ease: 'power2.out' }, 0.6); // checks on you
        tl.to(S, { yaw: 0, cock: 0, duration: 0.35, ease: 'power2.inOut' }, 1.5);
        fade('Idle_A', 2.0, 0.3);
        return 2.3;
      },
      (tl) => {
        const x = clamp(plan.x + (Math.random() < 0.5 ? -1 : 1) * 0.5 * h, lo, hi);
        fade('Idle_C', 0, 0.1);
        tl.set(S.t, { Idle_C: 0.8 }, 0);
        const t = hop(0.05, plan.x, x - plan.x);
        fade('Idle_A', t, 0.2);
        return t + 0.2;
      },
    ];
    function rest() {
      const tl = k.use(gsap.timeline());
      tl.to({}, { duration: 2.5 + Math.random() * 3 });
      tl.eventCallback('onComplete', () => beat(idleBeats[(Math.random() * idleBeats.length) | 0]));
    }

    // the opening: arrives, is lost, spots the pin and goes to it
    const tl = k.tl;
    let t = k.enter(0);
    plan.x = k.landX;
    fade('Idle_A', t, 0.22);
    t += 0.3;
    t = lost(tl, t);
    tl.to({}, { duration: 0.001 }, t);
    tl.eventCallback('onComplete', goToPin);

    // a new location: it watches the map fly, then hops over to the new pin
    const onSwitch = () => {
      pending?.kill();
      pending = gsap.delayedCall(1.4, () => {
        pending = null;
        goToPin();
      });
    };
    const switcher = document.querySelector('.map__switch');
    const map = document.getElementById('map');
    const onClick = (e) => { if (e.target.closest('[data-loc], .marker')) onSwitch(); };
    switcher?.addEventListener('click', onClick);
    map?.addEventListener('click', onClick);
    document.addEventListener('ausmc:location', onSwitch);
    k.cleanup(() => {
      pending?.kill();
      switcher?.removeEventListener('click', onClick);
      map?.removeEventListener('click', onClick);
      document.removeEventListener('ausmc:location', onSwitch);
    });
  });
}

// ───────────────────────── 3 · the peek ─────────────────────────

const LINE = [
  // [word, when it's spoken (s)] — matched to the recorded line
  ['Psst,', 0.02], ['see', 0.8], ['that', 0.98], ['bell', 1.16], ['🔔?', 1.36],
  ['Tap', 2.14], ['it', 2.36], ['and', 2.5], ['I’ll', 2.72], ['remind', 2.98], ['you', 3.38],
  ['before', 3.62], ['your', 4.02], ['session', 4.24], ['starts!', 4.78],
];
const SPEECH = [[0, 0.53], [0.79, 1.73], [2.12, 5.6]]; // when the voice is talking

/**
 * Leans in from the left edge of the screen with a speech bubble, points out
 * `bell`, and says the line. `speak()` starts the voice and returns a handle
 * with level() for lip sync (or null without sound).
 */
export function kangarooPeek({ gltf, bell, speak, ringBell }) {
  return new Promise((resolve) => {
    const W = innerWidth;
    const H = innerHeight;
    const mobile = W < 720;
    const cw = mobile ? 190 : 250;
    const ch = mobile ? 230 : 290;
    const b0 = bell.getBoundingClientRect();
    const atTop = b0.top + b0.height / 2 > H * 0.55; // keep clear of the bell it's pointing at
    const canvas = document.createElement('canvas');
    canvas.className = 'roo roo--peek';
    canvas.setAttribute('aria-hidden', 'true');
    Object.assign(canvas.style, {
      position: 'fixed', left: '0', width: `${cw}px`, height: `${ch}px`, pointerEvents: 'none', zIndex: '46',
      ...(atTop ? { top: `${mobile ? 86 : 96}px` } : { bottom: `${mobile ? 18 : 26}px` }),
    });
    document.body.appendChild(canvas);
    let renderer;
    try {
      renderer = makeRenderer(canvas);
    } catch {
      canvas.remove();
      resolve();
      return;
    }
    renderer.setSize(cw, ch, false);
    const scene = new THREE.Scene();
    const cam = pixelCamera(cw, ch, 26);
    addLights(scene);

    // big and close: only the head and shoulders lean into the frame
    const u = ch * 0.62;
    const K = makeKangaroo(gltf, u);
    const { S, B } = K;
    S.w = { Idle_A: 0, Idle_B: 0, Idle_C: 0, Idle_D: 1, Run: 0 };
    S.t.Idle_D = 0.9; // standing tall
    const rig = new THREE.Group();
    rig.add(K.model);
    scene.add(rig);
    K.model.rotation.set(0, Math.PI / 2 - 0.78, 0); // turned well toward you
    // the head is pinned a little right of the canvas centre, upper half; the
    // body sways around it, out of frame below
    const target = new THREE.Vector3(cw * 0.12, ch * 0.08, 0);
    const hw = new THREE.Vector3();
    const P = { x: -0.95 * cw, lean: 0 }; // slides in from beyond the edge

    // the speech bubble, next to the head; words light up as they're spoken
    const bubble = document.createElement('div');
    bubble.className = `roo-bubble${atTop ? ' is-top' : ''}`;
    bubble.setAttribute('role', 'status');
    bubble.innerHTML = `<p>${LINE.map(([w]) => `<span>${w}</span>`).join(' ')}</p>`;
    document.body.appendChild(bubble);
    const words = [...bubble.querySelectorAll('span')];
    const bx = cw * 0.5 + target.x + 0.34 * u; // just right of his face
    Object.assign(bubble.style, {
      left: `${Math.round(bx)}px`,
      maxWidth: `${Math.round(Math.min(mobile ? 250 : 300, W - bx - 14))}px`,
      ...(atTop ? { top: `${Math.round((mobile ? 86 : 96) + ch * 0.5 - target.y - 0.32 * u)}px` } : { bottom: `${Math.round((mobile ? 18 : 26) + ch * 0.5 + target.y + 0.1 * u)}px` }),
    });

    let voice = null;
    let clock = 0;
    let lastT = performance.now();
    const frame = () => {
      const now = performance.now();
      const dt = Math.min(0.05, (now - lastT) / 1000);
      lastT = now;
      clock += dt;
      // lip sync from the voice's loudness (or a soft flap in time with the line)
      const at = voice ? voice.elapsed() : clock - talkFrom;
      let open = 0;
      if (voice) open = clamp((voice.level() - 0.012) * 7, 0, 0.42);
      else if (at > 0 && SPEECH.some(([a, b]) => at > a && at < b)) open = 0.12 + 0.12 * Math.sin(at * 26) * Math.sin(at * 9.3);
      S.jaw += (open - S.jaw) * Math.min(1, dt * 30);
      K.pose(dt, u);
      rig.position.set(0, 0, 0);
      rig.rotation.z = -P.lean;
      rig.updateMatrixWorld(true);
      B.head.getWorldPosition(hw);
      rig.position.set(target.x + P.x - hw.x, target.y - hw.y, 0);
      renderer.render(scene, cam);
    };

    const tl = gsap.timeline({ onComplete: finish });
    const talkFrom = 0.75;
    // in: slides from the edge and leans in, a little overshoot — psst
    tl.to(P, { x: 0, duration: 0.7, ease: spring({ bounce: 0.3 }) }, 0);
    tl.to(P, { lean: 0.22, duration: 0.6, ease: 'power2.out' }, 0.1);
    tl.to(S, { yaw: 0.7, cock: 0.3, ears: -0.4, duration: 0.4, ease: 'power2.out' }, 0.35); // looks at you
    tl.fromTo(bubble, { opacity: 0, scale: 0.4, rotate: -8 }, { opacity: 1, scale: 1, rotate: -2, duration: 0.55, ease: spring({ bounce: 0.45 }) }, 0.5);
    tl.call(() => { voice = speak?.() || null; }, null, talkFrom);
    LINE.forEach(([, when], i) => tl.to(words[i], { opacity: 1, duration: 0.12 }, talkFrom + when));
    // "see that bell?" — turns toward it; the bell rings
    tl.to(S, { yaw: -0.35, cock: -0.1, look: -0.1, duration: 0.35, ease: 'power2.inOut' }, talkFrom + 0.75);
    tl.call(() => ringBell?.(bell), null, talkFrom + 1.1);
    // "tap it and I'll remind you" — back to you, a nod
    tl.to(S, { yaw: 0.7, cock: 0.22, look: 0, duration: 0.35, ease: 'power2.inOut' }, talkFrom + 2.05);
    tl.to(S, { look: 0.28, duration: 0.16, yoyo: true, repeat: 1, ease: 'sine.inOut' }, talkFrom + 3.0);
    tl.call(() => ringBell?.(bell), null, talkFrom + 2.2);
    tl.to(S, { ears: 0.2, duration: 0.3 }, talkFrom + 5.2);
    // out
    const outAt = talkFrom + 6.4;
    tl.to(bubble, { opacity: 0, scale: 0.7, y: 8, duration: 0.3, ease: 'power2.in' }, outAt);
    tl.to(P, { lean: 0, duration: 0.3 }, outAt + 0.1);
    tl.to(P, { x: -0.95 * cw, duration: 0.5, ease: 'power2.in' }, outAt + 0.15);

    // tapped the bell (or scrolled well away): wraps up early
    const y0 = scrollY;
    const early = () => {
      if (tl.time() > outAt) return;
      tl.seek(outAt);
    };
    const onScroll = () => { if (Math.abs(scrollY - y0) > H * 0.6) early(); };
    bell.addEventListener('click', early);
    addEventListener('scroll', onScroll, { passive: true });

    let done = false;
    function finish() {
      if (done) return;
      done = true;
      gsap.ticker.remove(frame);
      bell.removeEventListener('click', early);
      removeEventListener('scroll', onScroll);
      voice?.stop();
      K.mixer.stopAllAction();
      renderer.dispose();
      canvas.remove();
      bubble.remove();
      resolve();
    }
    frame();
    gsap.ticker.add(frame);
  });
}
