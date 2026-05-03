const STORAGE_KEY = 'techsync_user';

/** Resolved app route after auth or reading stored user (includes login when data is invalid). */
export type AuthRoute = '/mentor-dashboard' | '/student-dashboard' | '/login';

/** @deprecated Use `AuthRoute` */
export type DashboardPath = AuthRoute;

/**
 * Role-based home for Mentor vs Student (case-insensitive).
 * Returns `/login` when `role` is missing, blank, or not exactly mentor/student.
 */
export function dashboardPathForRole(role: string): AuthRoute {
  const normalized = role.trim().toLowerCase();
  if (normalized === 'mentor') {
    return '/mentor-dashboard';
  }
  if (normalized === 'student') {
    return '/student-dashboard';
  }
  return '/login';
}

/**
 * Reads `techsync_user` from localStorage and returns the matching dashboard route.
 * Returns `/login` when storage is unavailable, missing, corrupted, or role is invalid.
 */
export function dashboardPathFromStoredUser(): AuthRoute {
  const role = getStoredUserRole();
  return role ? dashboardPathForRole(role) : '/login';
}

/**
 * Reads the current user's role from `techsync_user` in localStorage.
 * Returns `'mentor'` or `'student'` when valid, otherwise `null`.
 */
export function getStoredUserRole(): 'mentor' | 'student' | null {
  if (typeof localStorage === 'undefined') {
    return null;
  }
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }
  try {
    const user = JSON.parse(raw) as { role?: string };
    const normalized =
      typeof user?.role === 'string' ? user.role.trim().toLowerCase() : '';
    if (normalized === 'mentor' || normalized === 'student') {
      return normalized;
    }
    return null;
  } catch {
    return null;
  }
}
