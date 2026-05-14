import type { Json } from '../types/database.types';

export type Weekday =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

export type WeeklyAvailabilitySlot = {
  day: Weekday;
  /** 24h "HH:mm" */
  start: string;
  end: string;
};

const WEEKDAYS: Weekday[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

const DAY_SET = new Set<string>(WEEKDAYS);

export const WEEKDAY_OPTIONS: { value: Weekday; label: string }[] = WEEKDAYS.map((d) => ({
  value: d,
  label: d.charAt(0).toUpperCase() + d.slice(1),
}));

export function dayOrderIndex(day: Weekday): number {
  return WEEKDAYS.indexOf(day);
}

function parseHm(t: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

/** Normalize DB JSON into validated slots (drops invalid rows). */
export function parseWeeklyAvailability(raw: Json | null | undefined): WeeklyAvailabilitySlot[] {
  if (raw == null) return [];
  if (!Array.isArray(raw)) return [];
  const out: WeeklyAvailabilitySlot[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const day = typeof o.day === 'string' ? o.day.trim().toLowerCase() : '';
    const start = typeof o.start === 'string' ? o.start.trim() : '';
    const end = typeof o.end === 'string' ? o.end.trim() : '';
    if (!DAY_SET.has(day)) continue;
    const sm = parseHm(start);
    const em = parseHm(end);
    if (sm == null || em == null || em <= sm) continue;
    out.push({ day: day as Weekday, start, end });
  }
  return out;
}

export function sortWeeklySlots(slots: WeeklyAvailabilitySlot[]): WeeklyAvailabilitySlot[] {
  return [...slots].sort((a, b) => {
    const da = dayOrderIndex(a.day) - dayOrderIndex(b.day);
    if (da !== 0) return da;
    return parseHm(a.start)! - parseHm(b.start)!;
  });
}

export function formatTimeLabel(hhmm: string): string {
  const mins = parseHm(hhmm);
  if (mins == null) return hhmm;
  const d = new Date();
  d.setHours(Math.floor(mins / 60), mins % 60, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function formatSlotLine(slot: WeeklyAvailabilitySlot): string {
  const day =
    slot.day.charAt(0).toUpperCase() + slot.day.slice(1);
  return `${day} · ${formatTimeLabel(slot.start)} – ${formatTimeLabel(slot.end)}`;
}

export function slotsToJson(slots: WeeklyAvailabilitySlot[]): Json {
  return sortWeeklySlots(slots) as unknown as Json;
}
