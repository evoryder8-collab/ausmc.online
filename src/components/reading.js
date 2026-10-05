// Notices when someone is actually reading the schedule: they've settled on
// one spot inside it for a while (no flings, hardly any travel) but are still
// there and active (tiny scrolls, touches). Fires once.

export function watchReading(onRead, { hold = 4000 } = {}) {
  const schedule = document.getElementById('schedule');
  if (!schedule) return () => {};
  const samples = []; // [time, scrollY]
  let lastInput = 0;
  const input = () => (lastInput = performance.now());
  const events = ['pointerdown', 'touchstart', 'wheel', 'keydown'];
  events.forEach((e) => addEventListener(e, input, { passive: true }));

  const stop = () => {
    clearInterval(timer);
    events.forEach((e) => removeEventListener(e, input));
  };
  const timer = setInterval(() => {
    const now = performance.now();
    const r = schedule.getBoundingClientRect();
    const inside = r.top < innerHeight * 0.3 && r.bottom > innerHeight * 0.7;
    if (document.hidden || !inside) {
      samples.length = 0; // reading starts over somewhere else
      return;
    }
    samples.push([now, scrollY]);
    while (samples.length && now - samples[0][0] > hold + 250) samples.shift();
    if (now - samples[0][0] < hold) return;
    let min = Infinity;
    let max = -Infinity;
    let step = 0;
    let moved = false;
    for (let i = 0; i < samples.length; i++) {
      const y = samples[i][1];
      min = Math.min(min, y);
      max = Math.max(max, y);
      if (i) {
        const d = Math.abs(y - samples[i - 1][1]);
        step = Math.max(step, d);
        if (d >= 1) moved = true;
      }
    }
    const settled = max - min < innerHeight * 0.3 && step < innerHeight * 0.1; // slow, barely moving
    const active = moved || now - lastInput < hold; // …but there and engaged
    if (settled && active) {
      stop();
      onRead();
    }
  }, 250);
  return stop;
}
