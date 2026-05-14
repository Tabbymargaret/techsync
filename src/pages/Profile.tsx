import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import Navbar from '../components/NavBar.tsx';
import { dashboardPathForRole, dashboardPathFromStoredUser } from '../lib/dashboardPath';
import { supabase } from '../lib/supabase';
import {
  parseWeeklyAvailability,
  sortWeeklySlots,
  slotsToJson,
  WEEKDAY_OPTIONS,
} from '../lib/weeklyAvailability';
import type { WeeklyAvailabilitySlot, Weekday } from '../lib/weeklyAvailability';
import type { Database, Json } from '../types/database.types';
import type { PostgrestError } from '@supabase/supabase-js';

type StoredUser = {
  user_id?: string;
};

type UserRow = Database['public']['Tables']['users']['Row'];

const STORAGE_KEY = 'techsync_user';

/** Fixed catalog only — no free-text skills. */
const STANDARD_SKILLS = [
  'React',
  'Node.js',
  'TypeScript',
  'Python',
  'Java',
  'UI/UX',
  'SQL',
  'AWS',
  'PostgreSQL',
  'MongoDB',
  'Docker',
  'Kubernetes',
  'GraphQL',
  'Next.js',
  'Tailwind CSS',
  'Git',
  'Linux',
  'Vue.js',
  'Spring Boot',
] as const;

const SKILL_SET = new Set<string>(STANDARD_SKILLS);

/** Prefer DB `tech_stack`; if empty, fall back to `techsync_user` in localStorage. Catalog order preserved. */
function normalizeSkillsFromSources(
  dbStack: string[] | null | undefined,
  storedStack: string[] | null | undefined
): string[] {
  const picked = new Set<string>();
  for (const s of dbStack ?? []) {
    if (typeof s === 'string' && SKILL_SET.has(s)) picked.add(s);
  }
  if (picked.size === 0) {
    for (const s of storedStack ?? []) {
      if (typeof s === 'string' && SKILL_SET.has(s)) picked.add(s);
    }
  }
  return STANDARD_SKILLS.filter((s) => picked.has(s));
}

function formatSupabaseError(error: PostgrestError): string {
  const parts = [error.message, error.details, error.hint].filter(
    (part): part is string => Boolean(part && part.trim())
  );
  return parts.length > 0 ? parts.join(' — ') : 'Update failed.';
}

export default function Profile() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('');
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [availabilitySlots, setAvailabilitySlots] = useState<WeeklyAvailabilitySlot[]>([]);

  const toastClassName = useMemo(
    () =>
      toast?.type === 'success'
        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'
        : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400',
    [toast]
  );

  const dashboardBackPath = useMemo(() => {
    if (role.trim()) {
      return dashboardPathForRole(role);
    }
    return dashboardPathFromStoredUser();
  }, [role]);

  const isMentor = useMemo(() => role.trim().toLowerCase() === 'mentor', [role]);

  const dashboardBackLabel =
    dashboardBackPath === '/login' ? 'Back to sign in' : 'Back to dashboard';

  useEffect(() => {
    async function loadProfile() {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        navigate('/login', { replace: true });
        return;
      }

      let parsed: StoredUser;
      try {
        parsed = JSON.parse(stored) as StoredUser;
      } catch {
        navigate('/login', { replace: true });
        return;
      }

      if (!parsed.user_id) {
        navigate('/login', { replace: true });
        return;
      }

      let storedTechStack: string[] | null = null;
      try {
        const full = JSON.parse(stored) as { tech_stack?: string[] | null };
        if (Array.isArray(full.tech_stack)) {
          storedTechStack = full.tech_stack;
        }
      } catch {
        /* ignore malformed stored user */
      }

      setUserId(parsed.user_id);

      const { data, error: queryError } = await supabase
        .from('users')
        .select('email, role, tech_stack, weekly_availability')
        .eq('user_id', parsed.user_id)
        .single();

      if (queryError || !data) {
        if (queryError) {
          console.error('Supabase Select Error:', queryError);
          setError(formatSupabaseError(queryError));
        } else {
          setError('Profile not found.');
        }
        setIsPageLoading(false);
        return;
      }

      const typedData = data as Pick<UserRow, 'email' | 'role' | 'tech_stack' | 'weekly_availability'>;
      setEmail(typedData.email);
      setRole(typedData.role);
      setSelectedSkills(normalizeSkillsFromSources(typedData.tech_stack, storedTechStack));
      if ((typedData.role ?? '').trim().toLowerCase() === 'mentor') {
        setAvailabilitySlots(
          sortWeeklySlots(parseWeeklyAvailability(typedData.weekly_availability ?? null))
        );
      } else {
        setAvailabilitySlots([]);
      }
      setIsPageLoading(false);
    }

    void loadProfile();
  }, [navigate]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 2500);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  function addAvailabilityRow() {
    setAvailabilitySlots((prev) => [
      ...prev,
      { day: 'monday' as Weekday, start: '09:00', end: '12:00' },
    ]);
  }

  function removeAvailabilityRow(index: number) {
    setAvailabilitySlots((prev) => prev.filter((_, i) => i !== index));
  }

  function updateAvailabilitySlot(index: number, partial: Partial<WeeklyAvailabilitySlot>) {
    setAvailabilitySlots((prev) =>
      prev.map((slot, i) => (i === index ? { ...slot, ...partial } : slot))
    );
  }

  function toggleSkill(skill: (typeof STANDARD_SKILLS)[number]) {
    setSelectedSkills((prev) =>
      prev.includes(skill) ? prev.filter((item) => item !== skill) : [...prev, skill]
    );
  }

  async function handleSaveProfile() {
    if (!userId) return;
    setError('');
    setIsSaving(true);

    // Primary key column is user_id (not id) — must match localStorage techsync_user.user_id
    const patch: Database['public']['Tables']['users']['Update'] = {
      tech_stack: selectedSkills,
    };
    if (isMentor) {
      const validated = parseWeeklyAvailability(availabilitySlots as unknown as Json);
      patch.weekly_availability = slotsToJson(validated);
    }
    const { error: updateError } = await supabase
      .from('users')
      .update(patch as never)
      .eq('user_id', userId);

    setIsSaving(false);

    if (updateError) {
      console.error('Supabase Update Error:', updateError);
      setToast({ type: 'error', message: formatSupabaseError(updateError) });
      return;
    }

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const u = JSON.parse(raw) as Record<string, unknown>;
        u.tech_stack = selectedSkills;
        if (isMentor) {
          u.weekly_availability = patch.weekly_availability ?? null;
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
      }
    } catch {
      /* ignore */
    }

    setToast({ type: 'success', message: 'Profile updated successfully.' });
  }

  function handleLogout() {
    localStorage.removeItem(STORAGE_KEY);
    navigate('/login', { replace: true });
  }

  if (isPageLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-gray-900">
        <p className="text-slate-500 dark:text-slate-400">Loading profile...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-900">
      <Navbar onLogout={handleLogout} />
      <div className="px-4 pt-24 pb-12">
        <div className="mx-auto max-w-4xl">
          <Link
            to={dashboardBackPath}
            className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-700 transition hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
            {dashboardBackLabel}
          </Link>

          {toast && (
            <div className={`mb-6 rounded-lg px-4 py-3 text-sm ${toastClassName}`}>{toast.message}</div>
          )}

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-gray-800 sm:p-8">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Profile</h1>
            <p className="mt-2 text-slate-600 dark:text-slate-400">
              Manage your account details and preferred tech stack.
            </p>

            {error && (
              <div className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
                {error}
              </div>
            )}

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-gray-700/40">
                <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Email</p>
                <p className="mt-2 text-sm font-medium text-slate-900 dark:text-white">{email}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-gray-700/40">
                <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Role</p>
                <p className="mt-2 text-sm font-medium text-slate-900 dark:text-white">{role}</p>
              </div>
            </div>

            <div className="mt-8">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Tech Stack</h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                Tap to select skills from the list below — no custom entries, so your profile stays
                consistent.
              </p>
              <div className="mt-4 flex flex-wrap gap-2 sm:gap-3">
                {STANDARD_SKILLS.map((skill) => {
                  const isSelected = selectedSkills.includes(skill);
                  return (
                    <button
                      key={skill}
                      type="button"
                      onClick={() => toggleSkill(skill)}
                      className={`rounded-full px-4 py-2 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 dark:focus:ring-offset-gray-800 ${
                        isSelected
                          ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                          : 'border border-slate-300 bg-transparent text-slate-700 hover:border-slate-400 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:border-slate-500 dark:hover:bg-slate-800/50'
                      }`}
                    >
                      {skill}
                    </button>
                  );
                })}
              </div>

              {isMentor && (
                <div className="mt-10 border-t border-slate-200 pt-8 dark:border-slate-700">
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                    Weekly availability
                  </h2>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                    Add time windows so students know when to suggest meetings (your local time).
                    Rows with end before start are ignored when you save.
                  </p>
                  <div className="mt-4 space-y-3">
                    {availabilitySlots.length === 0 ? (
                      <p className="text-sm text-slate-500 dark:text-slate-400">No windows yet.</p>
                    ) : (
                      availabilitySlots.map((slot, index) => (
                        <div
                          key={`${slot.day}-${slot.start}-${slot.end}-${index}`}
                          className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-600 dark:bg-gray-700/30 sm:flex-row sm:flex-wrap sm:items-center"
                        >
                          <label className="flex min-w-[8rem] flex-1 flex-col gap-1 text-xs font-medium text-slate-600 dark:text-slate-400">
                            Day
                            <select
                              value={slot.day}
                              onChange={(e) =>
                                updateAvailabilitySlot(index, { day: e.target.value as Weekday })
                              }
                              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-gray-800 dark:text-white"
                            >
                              {WEEKDAY_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="flex min-w-[6rem] flex-1 flex-col gap-1 text-xs font-medium text-slate-600 dark:text-slate-400">
                            Start
                            <input
                              type="time"
                              value={slot.start}
                              onChange={(e) => updateAvailabilitySlot(index, { start: e.target.value })}
                              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-gray-800 dark:text-white"
                            />
                          </label>
                          <label className="flex min-w-[6rem] flex-1 flex-col gap-1 text-xs font-medium text-slate-600 dark:text-slate-400">
                            End
                            <input
                              type="time"
                              value={slot.end}
                              onChange={(e) => updateAvailabilitySlot(index, { end: e.target.value })}
                              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-gray-800 dark:text-white"
                            />
                          </label>
                          <button
                            type="button"
                            onClick={() => removeAvailabilityRow(index)}
                            className="inline-flex items-center justify-center gap-1 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50 dark:border-red-900/60 dark:text-red-400 dark:hover:bg-red-950/40 sm:mt-5 sm:self-end"
                            aria-label="Remove time window"
                          >
                            <Trash2 className="h-4 w-4" aria-hidden />
                            Remove
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={addAvailabilityRow}
                    className="mt-4 inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-gray-800 dark:text-slate-200 dark:hover:bg-slate-700/80"
                  >
                    <Plus className="h-4 w-4" aria-hidden />
                    Add time window
                  </button>
                </div>
              )}

              <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  onClick={handleSaveProfile}
                  disabled={isSaving}
                  className="rounded-lg bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:pointer-events-none disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
                >
                  {isSaving ? 'Saving…' : 'Save Profile'}
                </button>
                <Link
                  to={dashboardBackPath}
                  className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 transition hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
                  {dashboardBackLabel}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
