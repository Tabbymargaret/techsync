import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Flame, Search } from 'lucide-react';
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

export default function StudentDashboard() {
  const navigate = useNavigate();
  const [currentStudent, setCurrentStudent] = useState<CurrentStudent | null>(null);
  const [mentors, setMentors] = useState<MentorWithScore[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');

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

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center dark:border-slate-700 dark:bg-gray-800">
        <p className="text-slate-600 dark:text-slate-400">Loading mentors…</p>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-400">
        {fetchError}
      </div>
    );
  }

  return (
    <section className="space-y-6">
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
        <Link
          to="/mentors"
          className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-blue-600 transition hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
        >
          Browse All Mentors
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>

      {mentors.length === 0 ? (
        <p className="text-center text-slate-600 dark:text-slate-400">No mentors available yet.</p>
      ) : topMatches.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center dark:border-slate-700 dark:bg-gray-800">
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
            <div
              key={mentor.user_id}
              className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-gray-800"
            >
              <div className="mb-4 flex items-start justify-between gap-2">
                <p className="break-words text-sm font-medium text-slate-900 dark:text-white">
                  {getMentorDisplayName(mentor)}
                </p>
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">
                  <Flame className="h-3.5 w-3.5 text-amber-800 dark:text-amber-200" aria-hidden />
                  {mentor.matchScore}% Match
                </span>
              </div>
              <div className="mt-auto flex flex-wrap gap-2">
                {(mentor.tech_stack ?? []).length === 0 ? (
                  <span className="text-xs text-slate-500 dark:text-slate-400">No stack listed</span>
                ) : (
                  mentor.tech_stack!.map((skill) => (
                    <span
                      key={skill}
                      className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-200"
                    >
                      {skill}
                    </span>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
