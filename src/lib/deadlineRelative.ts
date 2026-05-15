export type DeadlineRelativeStatus = 'past' | 'today' | 'future';

/**
 * Compares a calendar due date (YYYY-MM-DD) to a reference day in local time.
 * Uses noon UTC-offset-stable parsing and midnight-normalized days, aligned with
 * MilestoneTimeline overdue checks.
 */
export function deadlineStatusRelativeToToday(
  dueDateYyyyMmDd: string,
  referenceDate: Date = new Date()
): DeadlineRelativeStatus {
  const trimmed = dueDateYyyyMmDd.trim();
  if (!trimmed) return 'future';

  const due = new Date(`${trimmed}T12:00:00`);
  const today = new Date(referenceDate);
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);

  if (due < today) return 'past';
  if (due > today) return 'future';
  return 'today';
}
