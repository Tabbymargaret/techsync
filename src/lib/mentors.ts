import type { Database } from '../types/database.types';

type UserRow = Database['public']['Tables']['users']['Row'];

const MENTOR_FALLBACK_NAME = 'TechSync Mentor';

export function getMentorDisplayName(mentor: Pick<UserRow, 'full_name'>): string {
  const trimmed = mentor.full_name?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : MENTOR_FALLBACK_NAME;
}

export function calculateMatchScore(
  studentStack: string[],
  mentorStack: string[]
): number {
  if (studentStack.length === 0) return 0;
  const mentorSet = new Set(mentorStack);
  const sharedCount = studentStack.filter((skill) => mentorSet.has(skill)).length;
  return Math.round((sharedCount / studentStack.length) * 100);
}
