import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { Database } from '../types/database.types';

type UserRow = Database['public']['Tables']['users']['Row'];

type CurrentStudent = Pick<UserRow, 'user_id' | 'email' | 'role' | 'tech_stack'>;

type MentorWithScore = Pick<UserRow, 'user_id' | 'email' | 'tech_stack'> & {
  matchScore: number;
};

type StoredUser = {
  user_id?: string;
};

const STORAGE_KEY = 'techsync_user';

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
        .select('user_id,email,role,tech_stack')
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
        .select('user_id,email,tech_stack')
        .eq('role', 'Mentor');

      if (mentorsError) {
        setFetchError(mentorsError.message);
        setIsLoading(false);
        return;
      }

      const studentStack = student.tech_stack ?? [];
      const rawMentors = (mentorRows ?? []) as Pick<
        UserRow,
        'user_id' | 'email' | 'tech_stack'
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
      <div>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
          Mentors matched to your stack
        </h2>
        {currentStudent && (currentStudent.tech_stack?.length ?? 0) === 0 && (
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Add skills in your profile to get match scores.
          </p>
        )}
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {mentors.length === 0 ? (
          <p className="col-span-full text-center text-slate-600 dark:text-slate-400">
            No mentors available yet.
          </p>
        ) : (
          mentors.map((mentor) => (
            <div
              key={mentor.user_id}
              className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-gray-800"
            >
              <div className="mb-4 flex items-start justify-between gap-2">
                <p className="break-all text-sm font-medium text-slate-900 dark:text-white">
                  {mentor.email}
                </p>
                <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">
                  🔥 {mentor.matchScore}% Match
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
          ))
        )}
      </div>
    </section>
  );
}
