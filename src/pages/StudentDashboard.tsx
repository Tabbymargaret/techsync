import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Mail, Search, Settings } from 'lucide-react';
import Navbar from '../components/NavBar.tsx';
import MentorCard from '../components/MentorCard.tsx';
import { calculateMatchScore } from '../lib/mentors';
import { supabase } from '../lib/supabase';
import type { Database } from '../types/database.types';

type UserRow = Database['public']['Tables']['users']['Row'];

type CurrentStudent = Pick<UserRow, 'user_id' | 'full_name' | 'email' | 'role' | 'tech_stack'>;

type MentorWithScore = Pick<UserRow, 'user_id' | 'full_name' | 'email' | 'tech_stack'> & {
  matchScore: number;
};

type StoredUser = {
  user_id?: string;
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
  return raw.trim().toLowerCase() === 'accepted' ? 'Accepted' : 'Pending';
}

export default function StudentDashboard() {
  const navigate = useNavigate();
  const [currentStudent, setCurrentStudent] = useState<CurrentStudent | null>(null);
  const [currentMentorship, setCurrentMentorship] = useState<CurrentMentorship | null>(null);
  const [hasActiveMentorship, setHasActiveMentorship] = useState(false);
  const [mentors, setMentors] = useState<MentorWithScore[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [requestedMentorIds, setRequestedMentorIds] = useState<Set<string>>(() => new Set());
  const [isCancellingMentorship, setIsCancellingMentorship] = useState(false);

  const handleMentorRequestSuccess = useCallback((mentorId: string) => {
    setRequestedMentorIds((prev) => new Set(prev).add(mentorId));
    setHasActiveMentorship(true);
  }, []);

  useEffect(() => {
    async function loadMentorsAndStudent() {
      setFetchError('');
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

      const { data: studentRow, error: studentError } = await supabase
        .from('users')
        .select('user_id, full_name, email, role, tech_stack')
        .eq('user_id', parsed.user_id)
        .single();

      if (studentError || !studentRow) {
        setFetchError(studentError?.message ?? 'Could not load your profile.');
        setIsLoading(false);
        return;
      }

      const student = studentRow as CurrentStudent;
      setCurrentStudent(student);

      const { data: pairingRows } = await supabase
        .from('mentorship_pairing')
        .select('pairing_id, mentor_id, status, created_at')
        .eq('student_id', student.user_id)
        .order('created_at', { ascending: false });

      type PairingRow = {
        pairing_id?: string;
        mentor_id?: string;
        status?: string;
        created_at?: string;
      };

      const allPairings = (pairingRows ?? []) as PairingRow[];
      const activePairings = allPairings.filter((row) => {
        const status = typeof row.status === 'string' ? row.status.trim().toLowerCase() : '';
        return status === 'pending' || status === 'accepted';
      });

      if (activePairings.length > 0) {
        setHasActiveMentorship(true);
        const activeMentorIds = activePairings
          .map((row) => row.mentor_id)
          .filter((id): id is string => typeof id === 'string');
        setRequestedMentorIds(new Set(activeMentorIds));
      } else {
        setHasActiveMentorship(false);
        setRequestedMentorIds(new Set());
      }

      const pairing = activePairings[0] ?? null;
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

      setCurrentMentorship(mentorship);

      const { data: mentorRows, error: mentorsError } = await supabase
        .from('users')
        .select('user_id, full_name, email, tech_stack')
        .eq('role', 'Mentor');

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

  const mentorshipSlotLocked = hasActiveMentorship || currentMentorship !== null;

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
    setHasActiveMentorship(false);
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
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-700 dark:bg-gray-800">
            <p className="text-slate-600 dark:text-slate-400">Loading mentors…</p>
          </div>
        ) : fetchError ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 shadow-sm dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-400">
            {fetchError}
          </div>
        ) : (
          <section className="space-y-6">
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
