import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/NavBar.tsx';
import { supabase } from '../lib/supabase';
import type { Database } from '../types/database.types';
import type { PostgrestError } from '@supabase/supabase-js';

type StoredUser = {
  user_id?: string;
};

type UserRow = Database['public']['Tables']['users']['Row'];

const STORAGE_KEY = 'techsync_user';
const SKILLS = [
  'React',
  'Node.js',
  'TypeScript',
  'Python',
  'UI/UX',
  'PostgreSQL',
  'Supabase',
  'DevOps',
] as const;

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

  const toastClassName = useMemo(
    () =>
      toast?.type === 'success'
        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'
        : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400',
    [toast]
  );

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

      setUserId(parsed.user_id);

      const { data, error: queryError } = await supabase
        .from('users')
        .select('email, role, tech_stack')
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

      const typedData = data as Pick<UserRow, 'email' | 'role' | 'tech_stack'>;
      setEmail(typedData.email);
      setRole(typedData.role);
      setSelectedSkills(typedData.tech_stack ?? []);
      setIsPageLoading(false);
    }

    void loadProfile();
  }, [navigate]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 2500);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  function toggleSkill(skill: string) {
    setSelectedSkills((prev) =>
      prev.includes(skill) ? prev.filter((item) => item !== skill) : [...prev, skill]
    );
  }

  async function handleSaveProfile() {
    if (!userId) return;
    setError('');
    setIsSaving(true);

    // Primary key column is user_id (not id) — must match localStorage techsync_user.user_id
    const { error: updateError } = await supabase
      .from('users')
      // @ts-ignore - Supabase generated typings can infer never for updates in this setup
      .update({ tech_stack: selectedSkills })
      .eq('user_id', userId);

    setIsSaving(false);

    if (updateError) {
      console.error('Supabase Update Error:', updateError);
      setToast({ type: 'error', message: formatSupabaseError(updateError) });
      return;
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
                Select all technologies that match your strengths and interests.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                {SKILLS.map((skill) => {
                  const isSelected = selectedSkills.includes(skill);
                  return (
                    <button
                      key={skill}
                      type="button"
                      onClick={() => toggleSkill(skill)}
                      className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                        isSelected
                          ? 'border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900'
                          : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400 dark:border-slate-600 dark:bg-gray-800 dark:text-slate-300 dark:hover:border-slate-500'
                      }`}
                    >
                      {skill}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-10">
              <button
                type="button"
                onClick={handleSaveProfile}
                disabled={isSaving}
                className="rounded-lg bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:pointer-events-none disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
              >
                {isSaving ? 'Saving...' : 'Save Profile'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
