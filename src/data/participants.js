// AusMC 2026 competitors, round by round, as published on the official
// round sheets. Times are Sydney local time; `remind` is the schedule entry
// (and calendar file) for that round. Entries: [number, name, flags, note?].

export const CATEGORIES = {
  freestyle: 'Freestyle',
  remedial: 'Remedial',
  wellness: 'Wellness',
  facial: 'Facial',
  sports: 'Sports',
  thai: 'Thai',
  student: 'Student',
};

export const COUNTRIES = {
  au: 'Australia', nz: 'New Zealand', us: 'United States', cn: 'China', jp: 'Japan', vn: 'Vietnam',
  tw: 'Taiwan', my: 'Malaysia', th: 'Thailand', ph: 'Philippines', fr: 'France', hu: 'Hungary',
  fj: 'Fiji', sg: 'Singapore',
};

export const ROUNDS = [
  {
    id: 'sat-1', day: 'day-2', date: '2026-10-10', n: 1, start: '13:15', end: '14:15', remind: 'day-2-b0-s4',
    groups: [
      ['facial', [
        [16, 'Chiehchen Ma', ['tw', 'jp']],
        [50, 'Vanna Nguyen', ['vn', 'au']],
        [44, 'Ronil Linnit', ['au', 'my']],
        [63, 'Chonnikan Kaewsuwan', ['th', 'au']],
      ]],
      ['freestyle', [
        [14, 'Narumol Charudet', ['au', 'th']],
        [15, 'Rachel Desvarieux', ['nz', 'fr']],
        [20, 'Yuriko Shirosaki', ['jp', 'tw']],
        [26, 'Enriqueta Amante', ['au', 'ph']],
        [73, 'Chi Fei Chiu', ['tw']],
      ]],
      ['remedial', [
        [12, 'Yi Hsuan Hung', ['tw']],
        [13, 'Meng-Siang (Monica) Li', ['au', 'tw']],
        [17, 'Erika Ribeiro', ['au', 'fr']],
        [23, 'Jude Borromeo', ['au', 'ph']],
        [33, 'Sebastian Curatore', ['au']],
      ]],
      ['wellness', [
        [24, 'Szu Pin Wu', ['au', 'tw']],
        [25, 'Yuka Kuldin', ['au', 'jp']],
        [27, 'Joe Pan', ['tw', 'nz']],
        [28, 'Maho Nakaide', ['jp']],
        [51, 'Lynny Yu', ['au']],
        [76, 'Pimjai Thepdet Haigh', ['au', 'th']],
      ]],
    ],
  },
  {
    id: 'sat-2', day: 'day-2', date: '2026-10-10', n: 2, start: '14:30', end: '15:30', remind: 'day-2-b0-s5',
    groups: [
      ['remedial', [
        [32, 'Chieh-ning (Janie) Wang', ['au', 'tw']],
        [34, 'Hui Yuan Darcy', ['au', 'tw']],
        [47, 'Yi-Min Yang', ['au', 'tw']],
        [56, 'Amanda Fisher', ['au']],
        [62, 'Ben Vaughan', ['au']],
      ]],
      ['wellness', [
        [44, 'Ronil Linnit', ['au', 'my']],
        [35, 'Napatsorn Oor Na Chiangmai', ['au', 'th']],
        [38, 'Nian Liu', ['cn']],
        [42, 'Michelle Lewis', ['au']],
        [43, 'Le Tieu Boi', ['au', 'vn']],
        [71, 'YenJung (Rose) Shen', ['au', 'tw']],
        [29, 'Masato Sonobe', ['jp']],
      ]],
      ['freestyle', [
        [30, 'Zoltán Kódor', ['hu']],
        [39, 'Chiharu Hitocoma', ['jp']],
        [41, 'Bùi Thị Kim Phụng', ['vn']],
        [22, 'Mayumi Komine', ['jp']],
      ]],
      ['facial', [
        [31, 'Thanh Ha Tran', ['au']],
        [37, 'Hang Bui', ['au']],
        [54, 'Ting An Wei', ['tw']],
        [77, 'Primmy Tran', ['sg', 'vn']],
      ]],
    ],
  },
  {
    id: 'sat-3', day: 'day-2', date: '2026-10-10', n: 3, start: '15:45', end: '16:45', remind: 'day-2-b0-s6',
    groups: [
      ['freestyle', [
        [49, 'Al Poliarco', ['us']],
        [55, 'Ho Yu Chieh', ['tw']],
        [62, 'Ben Vaughan', ['au']],
        [19, 'Peter Duggan', ['au']],
        [70, 'Nana Tonseenon', ['au', 'th']],
      ]],
      ['remedial', [
        [14, 'Narumol Charudet', ['au']],
        [52, 'Kanokdol Kositvanich', ['au', 'th']],
        [57, 'Rina Nakayama', ['au', 'jp']],
        [65, 'Olive Emily Daysey Kumar', ['au', 'fj']],
        [72, 'Keylie Teakle', ['nz']],
        [24, 'Szu Pin Wu', ['au', 'tw']],
        [64, 'Duy Nguyen', ['au', 'vn']],
      ]],
      ['sports', [
        [45, 'Chun Ni', ['cn', 'us']],
        [58, 'Masakazu Ashida', ['jp', 'au']],
        [36, 'Shuang Zhang', ['nz', 'cn']],
        [73, 'Chi Fei Chiu', ['tw']],
      ]],
      ['thai', [
        [61, 'Phattraporn Wichatham', ['au', 'th']],
        [21, 'Ying Williams', ['au', 'th']],
        [66, 'Danunat Rungruengboriboon', ['au', 'th']],
        [76, 'Pimjai Thepdet Haigh', ['au', 'th']],
      ]],
    ],
  },
  {
    id: 'sun-1', day: 'day-3', date: '2026-10-11', n: 1, start: '09:30', end: '10:30', remind: 'day-3-b0-s1',
    groups: [
      ['sports', [
        [56, 'Amanda Fisher', ['au']],
        [12, 'Yi Hsuan Hung', ['tw']],
        [14, 'Narumol Charudet', ['au', 'th']],
        [23, 'Jude Borromeo', ['au', 'ph']],
        [30, 'Zoltán Kódor', ['hu']],
      ]],
      ['freestyle', [
        [44, 'Ronil Linnit', ['au', 'my']],
        [46, 'Hui-Ju Chiang', ['au', 'tw']],
        [21, 'Ying Williams', ['au', 'th']],
        [43, 'Le Tieu Boi', ['au', 'vn']],
        [24, 'Szu Pin Wu', ['au', 'tw']],
        [76, 'Pimjai Thepdet Haigh', ['au', 'th']],
      ]],
      ['thai', [
        [45, 'Chun Ni', ['us']],
        [71, 'YenJung (Rose) Shen', ['au', 'tw']],
        [41, 'Bùi Thị Kim Phụng', ['vn']],
        [64, 'Duy Nguyen', ['au', 'vn']],
        [59, 'Thanthika Day', ['au', 'th']],
      ]],
      ['wellness', [
        [40, 'Bernard Bugarin', ['au', 'ph']],
        [13, 'Meng-Siang (Monica) Li', ['au', 'tw']],
        [20, 'Yuriko Shirosaki', ['jp', 'tw']],
        [36, 'Shuang Zhang', ['nz', 'cn']],
        [69, 'Thi Ngoc Mai Lan', ['au', 'vn']],
        [70, 'Nana Tonseenon', ['au', 'th']],
        [72, 'Keylie Teakle', ['nz']],
      ]],
    ],
  },
  {
    id: 'sun-2', day: 'day-3', date: '2026-10-11', n: 2, start: '10:45', end: '11:45', remind: 'day-3-b0-s2',
    groups: [
      ['freestyle', [
        [49, 'Al Poliarco', ['us'], 'Eastern Freestyle'],
        [45, 'Chun Ni', ['cn', 'us']],
        [57, 'Rina Nakayama', ['au', 'jp']],
        [64, 'Duy Nguyen', ['au', 'vn']],
      ]],
      ['remedial', [
        [48, 'Hsin Yu Hsu', ['au', 'tw']],
        [44, 'Ronil Linnit', ['au', 'my']],
        [66, 'Danunat Rungruengboriboon', ['au', 'th']],
        [73, 'Chi Fei Chiu', ['tw']],
      ]],
      ['wellness', [
        [54, 'Ting An Wei', ['tw']],
        [55, 'Ho Yu Chieh', ['tw']],
        [26, 'Enriqueta Amante', ['au', 'ph']],
        [68, 'Samruay Sathupak', ['au', 'th']],
      ]],
      ['facial', [
        [17, 'Erika Ribeiro', ['au', 'fr']],
        [42, 'Michelle Lewis', ['au']],
        [62, 'Ben Vaughan', ['au']],
        [67, 'Tunyarut Phimakhet', ['au', 'th']],
      ]],
      ['student', [
        [53, 'Nu Hoang Thuc Tran', ['au', 'vn']],
        [60, 'Angkhana Uparawanna', ['au', 'th']],
        [74, 'Prapaporn Phawandee', ['au', 'th']],
        [75, 'Bima Anugrah', ['au', 'th']],
      ]],
    ],
  },
];

/** Every competitor once, with all of their appearances and every flag they're listed under */
export const COMPETITORS = (() => {
  const byNum = new Map();
  for (const r of ROUNDS) {
    for (const [cat, list] of r.groups) {
      for (const [num, name, flags, note] of list) {
        let p = byNum.get(num);
        if (!p) byNum.set(num, (p = { num, name, flags: [], apps: [] }));
        flags.forEach((f) => p.flags.includes(f) || p.flags.push(f));
        p.apps.push({ round: r, cat, note });
      }
    }
  }
  return [...byNum.values()].sort((a, b) => a.name.localeCompare(b.name));
})();

export const NATIONS = (() => {
  const count = {};
  for (const p of COMPETITORS) p.flags.forEach((f) => (count[f] = (count[f] || 0) + 1));
  return Object.entries(count).sort((a, b) => b[1] - a[1]).map(([code, n]) => ({ code, n }));
})();
