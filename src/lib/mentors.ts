import type { Database } from '../types/database.types';

type UserRow = Database['public']['Tables']['users']['Row'];

const MENTOR_FALLBACK_NAME = 'TechSync Mentor';

export function getMentorDisplayName(mentor: Pick<UserRow, 'full_name'>): string {
  const trimmed = mentor.full_name?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : MENTOR_FALLBACK_NAME;
}

function normalizeSkillTokens(stack: string[]): string[] {
  return stack.map((s) => s.trim().toLowerCase()).filter((s) => s.length > 0);
}

export function calculateMatchScore(
  studentStack: string[],
  mentorStack: string[]
): number {
  const mentorSkills = normalizeSkillTokens(mentorStack);
  const studentSkills = normalizeSkillTokens(studentStack);

  if (studentSkills.length === 0) return 0;

  const matches = studentSkills.filter((skill) => mentorSkills.includes(skill));
  const score = Math.round((matches.length / studentSkills.length) * 100);

  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console -- intentional dev-only match verification
    console.log('Student Skills:', studentSkills);
    // eslint-disable-next-line no-console -- intentional dev-only match verification
    console.log('Mentor Skills:', mentorSkills);
    // eslint-disable-next-line no-console -- intentional dev-only match verification
    console.log('Matches:', matches);
    // eslint-disable-next-line no-console -- intentional dev-only match verification
    console.log(`Final Score: ${score}%`);
  }

  return score;
}
