import {
  ClipboardCheck, Sparkles, MessageCircleQuestionMark, UtensilsCrossed, Timer, Crown, Vote,
  HandHeart, Trophy, Shirt, PartyPopper, Megaphone, Radio, MapPin, CalendarDays, Navigation,
  Ship, Clapperboard, Coffee, ArrowDown, ArrowUp, ArrowUpRight, Clock, Car, Accessibility,
  Play, Film, Wine,
} from 'lucide-static';

const set = {
  registration: ClipboardCheck,
  ceremony: Sparkles,
  qa: MessageCircleQuestionMark,
  break: Coffee,
  lunch: UtensilsCrossed,
  competition: Timer,
  final: Crown,
  voting: Vote,
  demo: HandHeart,
  awards: Trophy,
  change: Shirt,
  dinner: Wine,
  party: PartyPopper,
  briefing: Megaphone,
  live: Radio,
  pin: MapPin,
  calendar: CalendarDays,
  nav: Navigation,
  ferry: Ship,
  film: Clapperboard,
  movie: Film,
  coffee: Coffee,
  down: ArrowDown,
  up: ArrowUp,
  external: ArrowUpRight,
  clock: Clock,
  car: Car,
  access: Accessibility,
  play: Play,
};

const instagram = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="0.6" fill="currentColor"/></svg>';

export function icon(name, cls = '') {
  const svg = name === 'instagram' ? instagram : set[name];
  if (!svg) return '';
  return svg.replace('<svg', `<svg aria-hidden="true" focusable="false" class="i ${cls}"`);
}

/** Replace every [data-icon] placeholder's leading slot with its SVG */
export function hydrateIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach((el) => {
    if (el.dataset.iconDone) return;
    el.insertAdjacentHTML('afterbegin', icon(el.dataset.icon));
    el.dataset.iconDone = '1';
  });
}
