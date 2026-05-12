import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Mail, Search, Settings } from 'lucide-react';
import Navbar from '../components/NavBar.tsx';
import MentorCard from '../components/MentorCard.tsx';
import { calculateMatchScore } from '../lib/mentors';
import { dashboardPathForRole } from '../lib/dashboardPath.ts';
import { supabase } from '../lib/supabase';
import type { Database } from '../types/database.types';

type UserRow = Database['public']['Tables']['users']['Row'];

type CurrentStudent = Pick<UserRow, 'user_id' | 'full_name' | 'email' | 'role' | 'tech_stack'>;

type MentorWithScore = Pick<UserRow, 'user_id' | 'full_name' | 'email' | 'tech_stack'> & {
  matchScore: number;
};

const STORAGE_KEY = 'techsync_user';

type CurrentMentorship = {
  pairingId: string;
  mentorId: string;
  status: 'Pending' | 'Accepted';
  mentorName: string;
  mentorEmail: string;
};

function normalizePairingStatus(raw: string): 'Pending' | 'Accepted' {
  const s = raw.trim().toLowerCase();
  if (s === 'accepted' || s === 'active') return 'Accepted';
  return 'Pending';
}

function firstNameFromFullName(fullName: string | null | undefined): string {
  const trimmed = (fullName ?? '').trim();
  if (!trimmed) return 'Student';
  return trimmed.split(/\s+/)[0] ?? 'Student';
}

export default function StudentDashboard() {
  const navigate = useNavigate();
  const [currentStudent, setCurrentStudent] = useState<CurrentStudent | null>(null);
  const [currentMentorship, setCurrentMentorship] = useState<CurrentMentorship | null>(null);
  const [mentors, setMentors] = useState<MentorWithScore[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [requestedMentorIds, setRequestedMentorIds] = useState<Set<string>>(() => new Set());
  const [isCancellingMentorship, setIsCancellingMentorship] = useState(false);

  const handleMentorRequestSuccess = useCallback((mentorId: string) => {
    setRequestedMentorIds((prev) => new Set(prev).add(mentorId));
  }, []);

  useEffect(() => {
    async function loadMentorsAndStudent() {
      setFetchError('');
      setIsLoading(true);

      const { data: authData, error: authError } = await supabase.auth.getUser();

      if (authError || !authData.user) {
        localStorage.removeItem(STORAGE_KEY);
        setIsLoading(false);
        navigate('/login', { replace: true });
        return;
      }

      const authId = authData.user.id;

      const { data: userRow, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('user_id', authId)
        .maybeSingle();

      if (userError || !userRow) {
        localStorage.removeItem(STORAGE_KEY);
        setIsLoading(false);
        navigate('/login', { replace: true });
        return;
      }

      const row = userRow as UserRow;
      const roleNorm = (row.role ?? '').trim().toLowerCase();
      if (roleNorm !== 'student') {
        setIsLoading(false);
        navigate(dashboardPathForRole(row.role ?? ''), { replace: true });
        return;
      }

      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(row));
      } catch {
        /* ignore quota / private mode */
      }

      const student: CurrentStudent = {
        user_id: row.user_id,
        full_name: row.full_name,
        email: row.email,
        role: row.role,
        tech_stack: row.tech_stack,
      };
      setCurrentStudent(student);

      const { data: pairingRows } = await supabase
        .from('mentorship_pairing')
        .select('pairing_id, mentor_id, status')
        .eq('student_id', student.user_id)
        .in('status', ['Pending', 'Accepted', 'Active'])
        .order('created_at', { ascending: false })
        .limit(1);

      const pairing = pairingRows?.[0] ?? null;
      let mentorship: CurrentMentorship | null = null;

      if (pairing) {
        const pid = (pairing as { pairing_id?: string }).pairing_id;
        const mid = (pairing as { mentor_id?: string }).mentor_id;
        const pst = (pairing as { status?: string }).status;
        if (typeof pid === 'string' && typeof mid === 'string' && typeof pst === 'string') {
          const { data: mentorUser } = await supabase
            .from('users')
            .select('user_id, full_name, email')
            .eq('user_id', mid)
            .maybeSingle();

          const mu = mentorUser as Pick<UserRow, 'user_id' | 'full_name' | 'email'> | null;
          mentorship = {
            pairingId: pid,
            mentorId: mid,
            status: normalizePairingStatus(pst),
            mentorName: mu?.full_name?.trim() || 'Mentor',
            mentorEmail: mu?.email ?? '',
          };
        }
      }

      setCurrentMentorship(mentorship);
      setRequestedMentorIds(mentorship ? new Set([mentorship.mentorId]) : new Set());

      const { data: mentorRows, error: mentorsError } = await supabase
        .from('users')
        .select('user_id, full_name, email, tech_stack')
        .or('role.eq.mentor,role.eq.Mentor')
        .neq('user_id', student.user_id);

      if (mentorsError) {
        setFetchError(mentorsError.message);
        setIsLoading(false);
        return;
      }

      const studentStack = student.tech_stack ?? [];
      const rawMentors = (mentorRows ?? []) as Pick<
        UserRow,
        'user_id' | 'full_name' | 'email' | 'tech_stack'
      >[];

      const withScores: MentorWithScore[] = rawMentors.map((mentor) => ({
        ...mentor,
        matchScore: calculateMatchScore(studentStack, mentor.tech_stack ?? []),
      }));

      withScores.sort((a, b) => b.matchScore - a.matchScore);
      setMentors(withScores);
      setIsLoading(false);
    }

    void loadMentorsAndStudent();
  }, [navigate]);

  const topMatches = useMemo(() => {
    return mentors
      .filter((mentor) => mentor.matchScore >= 50)
      .sort((a, b) => b.matchScore - a.matchScore);
  }, [mentors]);

  const mentorshipSlotLocked = currentMentorship !== null;

  async function handleCancelMentorship() {
    if (!currentMentorship) return;
    setIsCancellingMentorship(true);
    setFetchError('');
    const { error } = await supabase
      .from('mentorship_pairing')
      .update({ status: 'Cancelled' } as never)
      .eq('pairing_id', currentMentorship.pairingId);

    setIsCancellingMentorship(false);

    if (error) {
      setFetchError(error.message);
      return;
    }

    setCurrentMentorship(null);
    setRequestedMentorIds(new Set());
  }

  async function handleLogout() {
    localStorage.removeItem(STORAGE_KEY);
    await supabase.auth.signOut();
    navigate('/login', { replace: true });
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-900">
      <Navbar onLogout={handleLogout} />
      <main className="mx-auto max-w-7xl px-4 pt-24 pb-12">
        {isLoading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-700 dark:bg-gray-800">
            <div className="mx-auto max-w-md space-y-3 text-center">
              <div
                className="mx-auto h-7 w-44 max-w-[70%] animate-pulse rounded-lg bg-slate-200 dark:bg-slate-700"
                aria-hidden
              />
              <div
                className="mx-auto h-4 w-full max-w-sm animate-pulse rounded bg-slate-200 dark:bg-slate-700"
                aria-hidden
              />
              <p className="pt-4 text-sm text-slate-600 dark:text-slate-400">Loading your dashboard…</p>
            </div>
          </div>
        ) : fetchError ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 shadow-sm dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-400">
            {fetchError}
          </div>
        ) : (
          <section className="space-y-6">
            <div className="space-y-1">
              <p className="text-lg font-medium text-slate-700 dark:text-slate-200 sm:text-xl">
                Hi {firstNameFromFullName(currentStudent?.full_name)},
              </p>
            </div>
            {fetchError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-400">
                {fetchError}
              </div>
            )}

            {currentMentorship && (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-gray-800 sm:p-8">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Current Mentorship
                </h2>
                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-base font-medium text-slate-900 dark:text-white">
                        Mentor: {currentMentorship.mentorName}
                      </p>
                      {currentMentorship.status === 'Pending' ? (
                        <span className="inline-flex rounded-full bg-slate-200 px-3 py-1 text-xs font-medium text-slate-700 dark:bg-slate-600 dark:text-slate-200">
                          Waiting for Response…
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
                          Active
                        </span>
                      )}
                    </div>
                    {currentMentorship.status === 'Accepted' && currentMentorship.mentorEmail && (
                      <p className="flex flex-wrap items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                        <Mail className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-500" aria-hidden />
                        <a
                          href={`mailto:${currentMentorship.mentorEmail}`}
                          className="font-medium text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
                        >
                          {currentMentorship.mentorEmail}
                        </a>
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleCancelMentorship()}
                    disabled={isCancellingMentorship}
                    className="shrink-0 rounded-lg border border-red-300 bg-transparent px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/40"
                  >
                    {isCancellingMentorship ? 'Cancelling…' : 'Cancel Mentorship'}
                  </button>
                </div>
              </div>
            )}

            <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
              <div className="min-w-0 flex-1">
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                  Recommended Mentors
                </h2>
                {currentStudent && (currentStudent.tech_stack?.length ?? 0) === 0 && (
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                    Add skills in your profile to get match scores.
                  </p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3 sm:justify-end">
                <Link
                  to="/profile"
                  className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
                >
                  <Settings className="h-4 w-4 shrink-0" aria-hidden />
                  Edit Profile
                </Link>
                <Link
                  to="/mentors"
                  className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-blue-600 transition hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  Browse All Mentors
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </div>
            </div>

            {mentors.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center shadow-sm dark:border-slate-700 dark:bg-gray-800">
                <p className="text-slate-600 dark:text-slate-400">No mentors available yet.</p>
              </div>
            ) : topMatches.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center shadow-sm dark:border-slate-700 dark:bg-gray-800">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-700">
                  <Search className="h-6 w-6 text-slate-600 dark:text-slate-300" aria-hidden />
                </div>
                <p className="mt-4 text-sm font-medium text-slate-900 dark:text-white">
                  No high-percentage matches found for your current stack.
                </p>
              </div>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {topMatches.map((mentor) => (
                  <MentorCard
                    key={mentor.user_id}
                    mentor={mentor}
                    studentId={currentStudent?.user_id ?? ''}
                    viewerRole={currentStudent?.role ?? ''}
                    hasRequested={requestedMentorIds.has(mentor.user_id)}
                    onRequestSuccess={handleMentorRequestSuccess}
                    requestsGloballyDisabled={mentorshipSlotLocked}
                  />
                ))}
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
