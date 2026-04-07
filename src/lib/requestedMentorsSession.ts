const SESSION_KEY = 'techsync_requested_mentor_ids';

export function loadRequestedMentorIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id): id is string => typeof id === 'string'));
  } catch {
    return new Set();
  }
}

export function addRequestedMentorId(
  previous: Set<string>,
  mentorId: string
): Set<string> {
  const next = new Set(previous).add(mentorId);
  sessionStorage.setItem(SESSION_KEY, JSON.stringify([...next]));
  return next;
}
