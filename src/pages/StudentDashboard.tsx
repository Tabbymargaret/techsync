import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Mail, Search, Settings, Trophy, X } from 'lucide-react';
import confetti from 'canvas-confetti';
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

type MilestoneRow = Database['public']['Tables']['milestones']['Row'];

const STORAGE_KEY = 'techsync_user';
const CELEBRATE_MATCH_KEY = 'celebrate_match';

type CurrentMentorship = {
  pairingId: string;
  mentorId: string;
  status: 'Pending' | 'Active' | 'Declined';
  mentorName: string;
  mentorEmail: string;
};

function normalizePairingStatus(raw: string): 'Pending' | 'Active' | 'Declined' {
  const s = raw.trim().toLowerCase();
  if (s === 'accepted' || s === 'active') return 'Active';
  if (s === 'declined') return 'Declined';
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
  const [hasActiveMentorship, setHasActiveMentorship] = useState(false);
  const [mentors, setMentors] = useState<MentorWithScore[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [actionError, setActionError] = useState('');
  const [requestedMentorIds, setRequestedMentorIds] = useState<Set<string>>(() => new Set());
  const [isCancellingMentorship, setIsCancellingMentorship] = useState(false);
  const [isClearingDeclined, setIsClearingDeclined] = useState(false);
  const [showCelebrateModal, setShowCelebrateModal] = useState(false);
  const [milestones, setMilestones] = useState<MilestoneRow[]>([]);
  const [updatingMilestoneId, setUpdatingMilestoneId] = useState<string | null>(null);

  const handleMentorRequestSuccess = useCallback((mentorId: string) => {
    setRequestedMentorIds((prev) => new Set(prev).add(mentorId));
    setHasActiveMentorship(true);
  }, []);

  const loadMentorsAndStudent = useCallback(async () => {
      setFetchError('');
      setActionError('');
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
        .select('pairing_id, mentor_id, status, created_at')
        .eq('student_id', student.user_id)
        .in('status', ['Pending', 'Accepted', 'Active', 'Declined'])
        .order('created_at', { ascending: false })
        .limit(1);

      const pairing = pairingRows?.[0] ?? null;
      let mentorship: CurrentMentorship | null = null;

      if (pairing) {
        const pid = pairing.pairing_id;
        const mid = pairing.mentor_id;
        const pst = pairing.status;
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

      if (mentorship?.status === 'Active') {
        try {
          if (!sessionStorage.getItem(`celebrate_shown_${mentorship.pairingId}`)) {
            localStorage.setItem(CELEBRATE_MATCH_KEY, 'true');
          }
        } catch {
          /* private mode */
        }
      }

      let milestoneRows: MilestoneRow[] = [];
      if (mentorship?.status === 'Active') {
        const { data: ms } = await supabase
          .from('milestones')
          .select('*')
          .eq('pairing_id', mentorship.pairingId)
          .order('created_at', { ascending: true });
        milestoneRows = (ms ?? []) as MilestoneRow[];
        milestoneRows = milestoneRows.map((m) => ({
          ...m,
          is_completed: Boolean(m.is_completed),
        }));
      }
      setMilestones(milestoneRows);

      setCurrentMentorship(mentorship);
      if (mentorship && (mentorship.status === 'Pending' || mentorship.status === 'Active')) {
        setRequestedMentorIds(new Set([mentorship.mentorId]));
      } else {
        setRequestedMentorIds(new Set());
      }

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
  }, [navigate]);

  useEffect(() => {
    void loadMentorsAndStudent();
  }, [loadMentorsAndStudent]);

  useEffect(() => {
    if (!currentMentorship || currentMentorship.status !== 'Active') return;
    try {
      if (localStorage.getItem(CELEBRATE_MATCH_KEY) !== 'true') return;
      localStorage.removeItem(CELEBRATE_MATCH_KEY);
      sessionStorage.setItem(`celebrate_shown_${currentMentorship.pairingId}`, '1');
      setShowCelebrateModal(true);
    } catch {
      /* ignore */
    }
  }, [currentMentorship]);

  useEffect(() => {
    if (!showCelebrateModal) return;
    const t = window.setTimeout(() => {
      void confetti({
        particleCount: 140,
        spread: 78,
        origin: { y: 0.55 },
      });
      void confetti({
        particleCount: 60,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.65 },
      });
      void confetti({
        particleCount: 60,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.65 },
      });
    }, 100);
    return () => window.clearTimeout(t);
  }, [showCelebrateModal]);

  const topMatches = useMemo(() => {
    return mentors
      .filter((mentor) => mentor.matchScore >= 50)
      .sort((a, b) => b.matchScore - a.matchScore);
  }, [mentors]);

  const mentorshipSlotLocked =
    (currentMentorship?.status === 'Pending' || currentMentorship?.status === 'Active') ||
    requestedMentorIds.size > 0;

  const handleMarkMilestoneComplete = useCallback(async (milestoneId: string) => {
    if (!currentMentorship || currentMentorship.status !== 'Active') return;
    const pairingId = currentMentorship.pairingId;
    setUpdatingMilestoneId(milestoneId);
    setActionError('');
    setMilestones((prev) =>
      prev.map((x) => (x.milestone_id === milestoneId ? { ...x, is_completed: true } : x))
    );
    const { error } = await supabase
      .from('milestones')
      .update({ is_completed: true } as never)
      .eq('milestone_id', milestoneId);
    if (error) {
      setActionError(error.message);
      const { data } = await supabase
        .from('milestones')
        .select('*')
        .eq('pairing_id', pairingId)
        .order('created_at', { ascending: true });
      setMilestones(
        ((data ?? []) as MilestoneRow[]).map((m) => ({
          ...m,
          is_completed: Boolean(m.is_completed),
        }))
      );
    }
    setUpdatingMilestoneId(null);
  }, [currentMentorship]);

  const milestoneProgressPercent = useMemo(() => {
    if (milestones.length === 0) return 0;
    const done = milestones.filter((m) => m.is_completed).length;
    return Math.round((done / milestones.length) * 100);
  }, [milestones]);

  async function handleResetAndTryAgain() {
    if (!currentMentorship || currentMentorship.status !== 'Declined') return;
    setIsClearingDeclined(true);
    setActionError('');
    const { error } = await supabase
      .from('mentorship_pairing')
      .delete()
      .eq('pairing_id', currentMentorship.pairingId);
    setIsClearingDeclined(false);
    if (error) {
      setActionError(error.message);
      return;
    }
    setCurrentMentorship(null);
    setRequestedMentorIds(new Set());
    setMilestones([]);
    await loadMentorsAndStudent();
  }

  async function handleCancelMentorship() {
    if (!currentMentorship || currentMentorship.status === 'Declined') return;
    setIsCancellingMentorship(true);
    setActionError('');
    const { error } = await supabase
      .from('mentorship_pairing')
      .update({ status: 'Cancelled' } as never)
      .eq('pairing_id', currentMentorship.pairingId);

    setIsCancellingMentorship(false);

    if (error) {
      setActionError(error.message);
      return;
    }

    setCurrentMentorship(null);
    setHasActiveMentorship(false);
    setRequestedMentorIds(new Set());
    setMilestones([]);
    await loadMentorsAndStudent();
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
            {actionError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-400">
                {actionError}
              </div>
            )}

            {currentMentorship &&
              (currentMentorship.status === 'Pending' || currentMentorship.status === 'Active') && (
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
                    {currentMentorship.status === 'Active' && currentMentorship.mentorEmail && (
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

                {currentMentorship.status === 'Active' && (
                  <div className="mt-6 border-t border-slate-200 pt-6 dark:border-slate-600">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Your roadmap</h3>
                    {milestones.length === 0 ? (
                      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                        Your mentor hasn&apos;t added milestones yet. Check back soon.
                      </p>
                    ) : (
                      <>
                        <div className="mt-3">
                          <div className="mb-1 flex justify-between text-xs font-medium text-slate-600 dark:text-slate-400">
                            <span>Progress</span>
                            <span>
                              {milestones.filter((m) => m.is_completed).length} / {milestones.length}{' '}
                              completed
                            </span>
                          </div>
                          <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                            <div
                              className="h-full rounded-full bg-blue-600 transition-all duration-300 dark:bg-blue-500"
                              style={{ width: `${milestoneProgressPercent}%` }}
                            />
                          </div>
                        </div>
                        <ul className="mt-4 space-y-3">
                          {milestones.map((m) => (
                            <li key={m.milestone_id} className="flex items-start gap-3">
                              <input
                                type="checkbox"
                                id={`milestone-${m.milestone_id}`}
                                checked={m.is_completed}
                                disabled={
                                  m.is_completed || updatingMilestoneId === m.milestone_id
                                }
                                onChange={() => void handleMarkMilestoneComplete(m.milestone_id)}
                                className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:bg-gray-900 dark:focus:ring-offset-gray-800"
                              />
                              <label
                                htmlFor={`milestone-${m.milestone_id}`}
                                className={`flex-1 text-sm leading-snug ${
                                  m.is_completed
                                    ? 'text-slate-500 line-through dark:text-slate-400'
                                    : 'font-medium text-slate-800 dark:text-slate-200'
                                }`}
                              >
                                {m.title}
                              </label>
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {currentMentorship?.status === 'Declined' && (
              <div
                role="alert"
                className="rounded-2xl border border-amber-300 bg-amber-50 p-5 shadow-sm dark:border-amber-700/80 dark:bg-amber-950/40 sm:p-6"
              >
                <h2 className="text-base font-semibold text-amber-950 dark:text-amber-100">
                  Request Declined
                </h2>
                <p className="mt-2 text-sm text-amber-900/90 dark:text-amber-200/90">
                  Your request was not accepted at this time. Reset below to clear this outcome and
                  send new requests to other mentors.
                </p>
                {currentMentorship.mentorName ? (
                  <p className="mt-2 text-xs font-medium text-amber-800/80 dark:text-amber-300/80">
                    Previous request: {currentMentorship.mentorName}
                  </p>
                ) : null}
                <button
                  type="button"
                  onClick={() => void handleResetAndTryAgain()}
                  disabled={isClearingDeclined}
                  className="mt-5 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
                >
                  {isClearingDeclined ? 'Resetting…' : 'Reset & Try Again'}
                </button>
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

        {showCelebrateModal && currentMentorship?.status === 'Active' && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4 backdrop-blur-[2px]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="celebrate-title"
          >
            <div className="relative w-full max-w-md rounded-2xl border border-emerald-200 bg-white p-8 shadow-2xl dark:border-emerald-800/50 dark:bg-gray-800">
              <button
                type="button"
                onClick={() => setShowCelebrateModal(false)}
                className="absolute right-4 top-4 rounded-lg p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                aria-label="Close"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-amber-200 to-amber-400 shadow-inner dark:from-amber-600 dark:to-amber-800">
                <Trophy className="h-8 w-8 text-amber-900 dark:text-amber-100" aria-hidden />
              </div>
              <h3
                id="celebrate-title"
                className="mt-5 text-center text-2xl font-bold tracking-tight text-slate-900 dark:text-white"
              >
                Congratulations!
              </h3>
              <p className="mt-3 text-center text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                {currentMentorship.mentorName} accepted your request — your mentorship is now{' '}
                <span className="font-semibold text-emerald-700 dark:text-emerald-400">active</span>.
              </p>
              <button
                type="button"
                onClick={() => setShowCelebrateModal(false)}
                className="mt-8 w-full rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-600/25 transition hover:bg-emerald-500 dark:shadow-emerald-900/40"
              >
                Continue to dashboard
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
