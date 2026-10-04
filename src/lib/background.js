// Living flag-silk backdrop: domain-warped noise in the Australian flag's
// navy, red and white, rendered at reduced resolution (it is all soft light,
// so upscaling is invisible) and throttled to ~30fps to keep glass panels cheap.

const VERT = `
attribute vec2 p;
void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;

const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform vec2 uMouse;
uniform float uScroll;
uniform float uLevel;
uniform float uRed;
uniform float uPulse;

vec3 mod289(vec3 x){ return x - floor(x * (1.0/289.0)) * 289.0; }
vec2 mod289(vec2 x){ return x - floor(x * (1.0/289.0)) * 289.0; }
vec3 permute(vec3 x){ return mod289(((x*34.0)+1.0)*x); }
float snoise(vec2 v){
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod289(i);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
  m = m*m; m = m*m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}
float fbm(vec2 p){
  float f = 0.0, a = 0.5;
  for (int i = 0; i < 3; i++){ f += a * snoise(p); p = p * 1.9 + vec2(1.7, 9.2); a *= 0.45; }
  return f;
}

void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / min(uRes.x, uRes.y);
  float t = uTime * 0.045;
  p.y += uScroll * 0.55;

  vec2 q = vec2(fbm(p * 0.42 + vec2(0.0, t)), fbm(p * 0.42 + vec2(5.2, -t * 0.8)));
  vec2 r = vec2(fbm(p * 0.6 + 1.4 * q + vec2(1.7, 9.2) + t * 0.5), fbm(p * 0.6 + 1.4 * q + vec2(8.3, 2.8) - t * 0.4));
  float f = fbm(p * 0.5 + 1.15 * r);

  vec3 deep  = vec3(0.000, 0.012, 0.050);
  vec3 navy  = vec3(0.004, 0.062, 0.225);
  vec3 royal = vec3(0.035, 0.150, 0.480);
  vec3 red   = vec3(0.894, 0.000, 0.169);
  vec3 ice   = vec3(0.860, 0.910, 1.000);

  vec3 col = mix(deep, navy, smoothstep(-0.6, 0.3, f));
  col = mix(col, royal, smoothstep(0.1, 0.8, f + 0.3 * q.y) * 0.55);
  col *= mix(0.7, 1.05, smoothstep(-0.9, 0.6, p.y + 0.3 * q.x)); // darker toward the bottom

  // red silk ribbon: slim flowing bands with a soft glow (red stays an accent)
  float w = (p.x * 0.85 + p.y * 0.5) * 2.6 + r.x * 2.6 + t * 1.6;
  float band = sin(w);
  float mask = smoothstep(0.05, 0.55, q.y + 0.1) * smoothstep(-0.2, 0.35, f);
  float ribbon = smoothstep(0.9, 0.995, band) * mask;
  col = mix(col, red * 0.92, ribbon * 0.72 * uRed);
  col += red * pow(max(band, 0.0), 12.0) * 0.2 * uRed * mask;

  // white silk sheen riding along the folds
  float band2 = sin((p.y * 1.1 - p.x * 0.4) * 1.9 + r.y * 2.6 - t * 1.3);
  float sheen = pow(smoothstep(0.86, 1.0, band2), 2.0) * smoothstep(-0.05, 0.6, f + 0.35);
  col += ice * sheen * 0.22;

  // pointer light + intro pulse
  vec2 m = uMouse;
  float md = length(p - m);
  col += vec3(0.30, 0.42, 0.95) * exp(-md * md * 3.0) * 0.14;
  col += vec3(0.55, 0.65, 1.0) * exp(-dot(p, p) * 2.2) * uPulse * 0.35;

  // vignette
  vec2 vv = uv - 0.5;
  col *= 1.0 - dot(vv, vv) * 1.15;

  col *= uLevel;
  // dither to kill banding
  float n = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233)) + uTime) * 43758.5453);
  col += (n - 0.5) / 180.0;
  gl_FragColor = vec4(col, 1.0);
}`;

export function createBackground(canvas, { reduced = false } = {}) {
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, depth: false, stencil: false, powerPreference: 'high-performance', preserveDrawingBuffer: false });
  const api = { level: 0.0, red: 1, pulse: 0, scroll: 0, setLevel() {}, ok: !!gl };
  if (!gl) {
    document.documentElement.classList.add('no-webgl');
    return api;
  }

  const sh = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  };
  let prog;
  try {
    prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  } catch (e) {
    console.warn('[bg] shader failed', e);
    document.documentElement.classList.add('no-webgl');
    api.ok = false;
    return api;
  }
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const U = {};
  for (const n of ['uRes', 'uTime', 'uMouse', 'uScroll', 'uLevel', 'uRed', 'uPulse']) U[n] = gl.getUniformLocation(prog, n);

  const SCALE = 0.42;
  const resize = () => {
    const w = Math.max(2, Math.round(innerWidth * SCALE));
    const h = Math.max(2, Math.round(innerHeight * SCALE));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
  };
  resize();
  addEventListener('resize', resize);

  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  addEventListener('pointermove', (e) => {
    const m = Math.min(innerWidth, innerHeight);
    mouse.tx = (e.clientX - innerWidth / 2) / m;
    mouse.ty = -(e.clientY - innerHeight / 2) / m;
  }, { passive: true });

  let last = 0;
  const t0 = performance.now();
  const frameGap = 1000 / 30;
  const draw = (now) => {
    raf = requestAnimationFrame(draw);
    if (now - last < frameGap) return;
    last = now;
    mouse.x += (mouse.tx - mouse.x) * 0.06;
    mouse.y += (mouse.ty - mouse.y) * 0.06;
    const time = reduced ? 20 : (now - t0) / 1000 + 20;
    gl.uniform2f(U.uRes, canvas.width, canvas.height);
    gl.uniform1f(U.uTime, time);
    gl.uniform2f(U.uMouse, mouse.x, mouse.y);
    gl.uniform1f(U.uScroll, api.scroll);
    gl.uniform1f(U.uLevel, api.level);
    gl.uniform1f(U.uRed, api.red);
    gl.uniform1f(U.uPulse, api.pulse);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
  let raf = requestAnimationFrame(draw);
  document.addEventListener('visibilitychange', () => {
    cancelAnimationFrame(raf);
    if (!document.hidden) raf = requestAnimationFrame(draw);
  });
  return api;
}
