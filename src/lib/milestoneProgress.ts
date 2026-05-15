/**
 * Progress bar percentage for milestone lists (e.g. MentorshipDetails roadmap).
 * Rounds to the nearest whole percent; safe when counts are inconsistent.
 */
export function calculateMilestoneProgressPercent(
  completedCount: number,
  totalCount: number
): number {
  if (totalCount <= 0) return 0;
  const clamped = Math.max(0, Math.min(completedCount, totalCount));
  return Math.round((clamped / totalCount) * 100);
}
