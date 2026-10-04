// Small, accurate inline SVG flags (emoji flags don't render on Windows).
const star7 = (cx, cy, r, ri = r * 0.45) => {
  let d = '';
  for (let i = 0; i < 14; i++) {
    const a = (Math.PI / 7) * i - Math.PI / 2;
    const rr = i % 2 ? ri : r;
    d += `${i ? 'L' : 'M'}${(cx + rr * Math.cos(a)).toFixed(2)},${(cy + rr * Math.sin(a)).toFixed(2)}`;
  }
  return `<path d="${d}Z"/>`;
};
const star5 = (cx, cy, r, ri = r * 0.4) => {
  let d = '';
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const rr = i % 2 ? ri : r;
    d += `${i ? 'L' : 'M'}${(cx + rr * Math.cos(a)).toFixed(2)},${(cy + rr * Math.sin(a)).toFixed(2)}`;
  }
  return `<path d="${d}Z"/>`;
};

const AU = `<svg viewBox="0 0 60 30" preserveAspectRatio="none">
  <rect width="60" height="30" fill="#012169"/>
  <svg x="0" y="0" width="30" height="15" viewBox="0 0 30 15">
    <path d="M0,0 L30,15 M30,0 L0,15" stroke="#fff" stroke-width="3"/>
    <path d="M0,0 L30,15 M30,0 L0,15" stroke="#E4002B" stroke-width="1.2"/>
    <path d="M15,0 V15 M0,7.5 H30" stroke="#fff" stroke-width="5"/>
    <path d="M15,0 V15 M0,7.5 H30" stroke="#E4002B" stroke-width="3"/>
  </svg>
  <g fill="#fff">
    ${star7(15, 22.5, 4.2)}
    ${star7(45, 25, 2.1)}
    ${star7(37.5, 13.1, 2.1)}
    ${star7(45, 5, 2.1)}
    ${star7(53.3, 11.1, 2.1)}
    ${star5(48.1, 16.25, 1.25)}
  </g>
</svg>`;

const DK = `<svg viewBox="0 0 37 28" preserveAspectRatio="none"><rect width="37" height="28" fill="#C8102E"/><path d="M12 0h4v28h-4zM0 12h37v4H0z" fill="#fff"/></svg>`;
const JP = `<svg viewBox="0 0 30 20" preserveAspectRatio="none"><rect width="30" height="20" fill="#fff"/><circle cx="15" cy="10" r="6" fill="#BC002D"/></svg>`;
const RO = `<svg viewBox="0 0 3 2" preserveAspectRatio="none"><rect width="1" height="2" fill="#002B7F"/><rect x="1" width="1" height="2" fill="#FCD116"/><rect x="2" width="1" height="2" fill="#CE1126"/></svg>`;

const FLAGS = { AU, DK, JP, RO };
const NAMES = { AU: 'Australia', DK: 'Denmark', JP: 'Japan', RO: 'Romania' };

export const flag = (code) =>
  `<span class="flag" role="img" aria-label="${NAMES[code] || code}" title="${NAMES[code] || code}">${FLAGS[code] || ''}</span>`;
