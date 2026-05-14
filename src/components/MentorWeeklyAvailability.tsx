import { CalendarClock } from 'lucide-react';
import {
  formatSlotLine,
  parseWeeklyAvailability,
  sortWeeklySlots,
} from '../lib/weeklyAvailability';
import type { WeeklyAvailabilitySlot } from '../lib/weeklyAvailability';
import type { Json } from '../types/database.types';

type MentorWeeklyAvailabilityProps = {
  value: Json | null | undefined;
  className?: string;
};

function toSlots(value: Json | null | undefined): WeeklyAvailabilitySlot[] {
  return sortWeeklySlots(parseWeeklyAvailability(value));
}

/**
 * Student-facing summary of a mentor’s saved weekly windows.
 */
export default function MentorWeeklyAvailability({ value, className = '' }: MentorWeeklyAvailabilityProps) {
  const slots = toSlots(value);
  if (slots.length === 0) {
    return (
      <p className={`text-xs text-slate-500 dark:text-slate-400 ${className}`}>
        No weekly hours listed — message your mentor to find a time.
      </p>
    );
  }

  return (
    <div
      className={`rounded-xl border border-sky-200/80 bg-sky-50/90 px-3 py-3 dark:border-sky-800/60 dark:bg-sky-950/40 ${className}`}
    >
      <div className="flex gap-2.5">
        <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" aria-hidden />
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-sky-800 dark:text-sky-300">
            Weekly availability
          </p>
          <p className="mt-1 text-[11px] text-sky-900/80 dark:text-sky-200/80">
            Suggest meetings during these windows (mentor&apos;s local time).
          </p>
          <ul className="mt-2 space-y-1.5 text-sm font-medium text-slate-800 dark:text-slate-200">
            {slots.map((slot, i) => (
              <li key={`${slot.day}-${slot.start}-${slot.end}-${i}`} className="flex gap-2">
                <span className="text-sky-600 dark:text-sky-400" aria-hidden>
                  ·
                </span>
                <span>{formatSlotLine(slot)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
