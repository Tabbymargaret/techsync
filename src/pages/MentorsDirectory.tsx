import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import MentorCard from '../components/MentorCard.tsx';
import Navbar from '../components/NavBar.tsx';
import { calculateMatchScore } from '../lib/mentors';
import { supabase } from '../lib/supabase';
import { dashboardPathFromStoredUser } from '../lib/dashboardPath';
import type { Database } from '../types/database.types';

type UserRow = Database['public']['Tables']['users']['Row'];

type MentorRow = Pick<UserRow, 'user_id' | 'full_name' | 'email' | 'tech_stack'>;

type MentorWithScore = MentorRow & { matchScore: number };

type StoredUser = {
  user_id?: string;
};

const STORAGE_KEY = 'techsync_user';

export default function MentorsDirectory() {
  const navigate = useNavigate();
  const [mentors, setMentors] = useState<MentorWithScore[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [studentUserId, setStudentUserId] = useState('');
  const [requestedMentorIds, setRequestedMentorIds] = useState<Set<string>>(() => new Set());
  const [hasActiveMentorship, setHasActiveMentorship] = useState(false);

  const handleMentorRequestSuccess = useCallback((mentorId: string) => {
    setRequestedMentorIds((prev) => new Set(prev).add(mentorId));
    setHasActiveMentorship(true);
  }, []);

  function handleLogout() {
    localStorage.removeItem(STORAGE_KEY);
    navigate('/login', { replace: true });
  }

  useEffect(() => {
    async function load() {
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

      const studentId = parsed.user_id;
      setStudentUserId(studentId);

      const { data: requestRows } = await supabase
        .from('mentorship_pairing')
        .select('mentor_id, status')
        .eq('student_id', studentId);

      const existingIds = new Set<string>();
      let foundActive = false;
      for (const row of requestRows ?? []) {
        const r = row as { mentor_id?: string; status?: string };
        const status = typeof r.status === 'string' ? r.status.trim().toLowerCase() : '';
        if (status === 'pending' || status === 'accepted') {
          foundActive = true;
          if (typeof r.mentor_id === 'string') existingIds.add(r.mentor_id);
        }
      }
      setRequestedMentorIds(existingIds);
      setHasActiveMentorship(foundActive);

      const { data: studentRow, error: studentError } = await supabase
        .from('users')
        .select('tech_stack')
        .eq('user_id', studentId)
        .single();

      const studentStack =
        !studentError && studentRow
          ? ((studentRow as Pick<UserRow, 'tech_stack'>).tech_stack ?? [])
          : [];

      const { data: mentorRows, error: mentorsError } = await supabase
        .from('users')
        .select('user_id, full_name, email, tech_stack')
        .eq('role', 'Mentor');

      if (mentorsError) {
        setFetchError(mentorsError.message);
        setIsLoading(false);
        return;
      }

      const raw = (mentorRows ?? []) as MentorRow[];
      const withScores: MentorWithScore[] = raw.map((mentor) => ({
        ...mentor,
        matchScore: calculateMatchScore(studentStack, mentor.tech_stack ?? []),
      }));

      withScores.sort((a, b) => b.matchScore - a.matchScore);
      setMentors(withScores);
      setIsLoading(false);
    }

    void load();
  }, [navigate]);

  const backToDashboardPath = dashboardPathFromStoredUser();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-900">
      <Navbar onLogout={handleLogout} />
      <div className="px-4 pt-24 pb-12">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
                Mentors Directory
              </h1>
              <p className="mt-2 text-slate-600 dark:text-slate-400">
                All mentors on TechSync. With corresponding match scores to your profile tech stack.
              </p>
            </div>
            <Link
              to={backToDashboardPath}
              className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-gray-800 dark:text-white dark:hover:bg-slate-700"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Back to Dashboard
            </Link>
          </div>

          {isLoading ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center dark:border-slate-700 dark:bg-gray-800">
              <p className="text-slate-600 dark:text-slate-400">Loading mentors…</p>
            </div>
          ) : fetchError ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-400">
              {fetchError}
            </div>
          ) : mentors.length === 0 ? (
            <p className="text-center text-slate-600 dark:text-slate-400">No mentors available yet.</p>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {mentors.map((mentor) => (
                <MentorCard
                  key={mentor.user_id}
                  mentor={mentor}
                  studentId={studentUserId}
                  hasRequested={requestedMentorIds.has(mentor.user_id)}
                  onRequestSuccess={handleMentorRequestSuccess}
                  requestsGloballyDisabled={hasActiveMentorship}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
