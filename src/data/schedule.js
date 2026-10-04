// Official AusMC 2026 schedule. All times are Sydney local time.
// Sydney is on daylight time (AEDT, UTC+11) from 4 October 2026.

export const EVENT = {
  title: 'AusMC 2026',
  name: 'Australian Massage Championship',
  timeZone: 'Australia/Sydney',
  offset: '+11:00',
  tzLabel: 'AEDT · UTC+11',
  start: { date: '2026-10-09', time: '09:00' },
  end: { date: '2026-10-11', time: '23:00' },
};

export const LOCATIONS = {
  venue: {
    id: 'venue',
    name: 'Cockatoo Island',
    role: 'Championship Venue',
    when: 'Fri 9 – Sun 11 October 2026',
    address: 'Cockatoo Island, Sydney Harbour NSW',
    blurb: 'UNESCO World Heritage-listed island in the heart of Sydney Harbour.',
    lngLat: [151.1722, -33.8476],
    query: 'Cockatoo Island, Sydney NSW',
    travelmode: 'transit',
  },
  dinner: {
    id: 'dinner',
    name: 'Cheers Sports Bar & Grill',
    role: 'Championship Dinner Party',
    when: 'Sunday 11 October · 6:00 PM',
    address: '561 George St, Sydney NSW 2000',
    blurb: 'Celebrate the 2026 champions in the heart of the Sydney CBD.',
    lngLat: [151.20596, -33.87664],
    query: 'Cheers Sports Bar & Grill, 561 George St, Sydney NSW 2000',
  },
};

export const DAYS = [
  {
    id: 'day-1',
    n: 1,
    date: '2026-10-09',
    weekday: 'Friday',
    short: 'Fri 9 Oct',
    longDate: '9 October 2026',
    tags: ['Masterclasses', 'Oceania Championship · Live Online'],
    blocks: [
      {
        type: 'masterclass',
        title: 'Morning Masterclasses',
        start: '09:00',
        end: '13:00',
        sessions: [
          { presenter: 'Jeppe Tengbjerg', country: 'DK', role: 'Founder of IMA | International Teacher', title: 'Therapeutic Freestyle Massage' },
          { presenter: 'Junko Ikuna', country: 'JP', role: 'Master Trainer from Japan', title: 'Japanese Seitai, Shiatsu & Swedish Massage Flow' },
          { presenter: 'Emmanuelle Ishibashin', country: 'AU', role: 'Overall Winner – Australian Massage Championship 2025', title: 'Somatic Facial Massage' },
        ],
      },
      {
        type: 'masterclass',
        title: 'Afternoon Masterclasses',
        start: '13:00',
        end: '17:00',
        sessions: [
          { presenter: 'Daiki Wakabayashi', country: 'JP', role: 'NAORU Method Instructor | Japan', title: 'Joint Mobilization & Functional Recovery' },
          { presenter: 'Radu Gligor', country: 'RO', role: 'Deep Stretch Specialist | Romania', title: 'Deep Stretch Fusion: Massage & Joint Mobilization' },
          { presenter: 'Tracey Windmill', country: 'AU', role: 'Best Australian Massage Therapist 2025', title: 'Sarga Silks: Fluid Techniques for Myofascial and Structural Release' },
        ],
      },
      {
        type: 'online',
        title: 'Oceania Massage Championship',
        tag: 'Live Online',
        start: '14:00',
        end: '17:00',
        sessions: [
          { title: 'Testing & Preparation', start: '14:00', end: '14:30' },
          { title: 'Round 1', start: '14:30', end: '15:30' },
          { title: 'Break', start: '15:30', end: '16:00', kind: 'break' },
          { title: 'Round 2', start: '16:00', end: '17:00' },
        ],
      },
    ],
  },
  {
    id: 'day-2',
    n: 2,
    date: '2026-10-10',
    weekday: 'Saturday',
    short: 'Sat 10 Oct',
    longDate: '10 October 2026',
    tags: ['Opening Ceremony', 'Competition Rounds 1–3'],
    blocks: [
      {
        type: 'program',
        title: 'Championship Schedule',
        sessions: [
          { start: '09:00', title: 'Registration Opens', desc: 'Participant, judge, and guest registration. (All participants must attend.)', kind: 'registration' },
          { start: '10:30', title: 'Official Opening Ceremony', desc: 'Welcome to all participants, judges, sponsors, special guests, and spectators.', kind: 'ceremony' },
          { start: '12:00', title: 'Pre-Competition Q&A', desc: 'Frequently asked questions before the competition.', kind: 'qa' },
          { start: '12:30', end: '13:15', title: 'Lunch Break', meta: '45 minutes', kind: 'break' },
          { start: '13:15', end: '14:15', title: 'Competition Round 1', kind: 'competition' },
          { start: '14:30', end: '15:30', title: 'Competition Round 2', kind: 'competition' },
          { start: '15:45', end: '16:45', title: 'Competition Round 3', kind: 'competition' },
        ],
      },
    ],
  },
  {
    id: 'day-3',
    n: 3,
    date: '2026-10-11',
    weekday: 'Sunday',
    short: 'Sun 11 Oct',
    longDate: '11 October 2026',
    tags: ['Final Round', 'Awards Ceremony', 'Dinner Party'],
    blocks: [
      {
        type: 'program',
        title: 'Championship Schedule',
        sessions: [
          { start: '09:00', end: '09:30', title: 'Morning Briefing', desc: 'Welcome back and meeting with all participants, judges, and officials at the main stage.', kind: 'briefing' },
          { start: '09:30', end: '10:30', title: 'Competition Round 1', kind: 'competition' },
          { start: '10:45', end: '11:45', title: 'Competition Round 2', kind: 'competition' },
          { start: '12:00', end: '12:30', title: 'Lunch Break', meta: '30 minutes', kind: 'break' },
          { start: '12:30', end: '13:00', title: 'Final Round', desc: '20-minute demonstration by the first-place winner of each category.', kind: 'final' },
          { start: '13:00', end: '13:30', title: 'Judges’ & Competitors’ Voting', kind: 'voting' },
          { start: '13:30', end: '14:30', title: 'Judges’ Demonstration', desc: 'Watch our judges showcase their skills and techniques.', kind: 'demo' },
          { start: '14:30', end: '16:30', title: 'Awards Ceremony', desc: 'Presentation of awards to sponsors, judges, category winners, and special award recipients, including the Overall Australian Massage Championship 2026 Champion.', kind: 'awards' },
          { start: '16:30', end: '18:00', title: 'Get Changed', kind: 'change', openEnded: true },
          { start: '18:00', end: '23:00', title: 'Championship Dinner Party', desc: 'Cheers Sports Bar & Grill', address: '561 George St, Sydney NSW 2000', location: 'dinner', kind: 'dinner', openEnded: true },
        ],
      },
    ],
  },
];
