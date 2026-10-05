// Forgiving people search: any word order, accents and punctuation ignored,
// numbers with or without their zeros, countries by name, code or demonym.
// Short words match the start of a word; longer ones may match anywhere.

const ALIASES = {
  au: 'australia australian aus',
  nz: 'new zealand nz kiwi',
  us: 'united states usa us america american',
  cn: 'china chinese prc',
  jp: 'japan japanese',
  vn: 'vietnam viet nam vietnamese',
  tw: 'taiwan taiwanese chinese taipei roc',
  my: 'malaysia malaysian',
  th: 'thailand thai',
  ph: 'philippines philippine filipino pilipinas',
  fr: 'france french',
  hu: 'hungary hungarian',
  fj: 'fiji fijian',
  sg: 'singapore singaporean',
};

/** lower-case, accents off, any punctuation becomes a space */
export const norm = (s) => String(s)
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[đĐ]/g, 'd')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

export const tokens = (q) => norm(q).split(' ').filter(Boolean);

/** the searchable words for a competitor, optionally limited to some categories */
export function personWords(p, categories, catNames) {
  const num = String(p.num);
  return ` ${norm(`${p.name} ${num.padStart(3, '0')} ${num} ${p.flags.map((f) => ALIASES[f] || f).join(' ')} ${categories.map((c) => catNames[c]).join(' ')}`)} `;
}

/** every query word must be found; short ones only at the start of a word */
export function matches(words, toks) {
  return toks.every((t) => (t.length < 3 ? words.includes(` ${t}`) : words.includes(t)));
}
