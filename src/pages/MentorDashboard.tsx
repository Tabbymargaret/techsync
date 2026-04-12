import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/NavBar.tsx';
import { supabase } from '../lib/supabase';
import type { Database } from '../types/database.types';

type MentorshipRequestRow = Database['public']['Tables']['mentorship_requests']['Row'];
type MentorshipRequestUpdate = Database['public']['Tables']['mentorship_requests']['Update'];

const STORAGE_KEY = 'techsync_user';

function firstNameFromFullName(fullName: string): string {
  const trimmed = fullName.trim();
  if (!trimmed) return 'Mentor';
  return trimmed.split(/\s+/)[0] ?? 'Mentor';
}

export default function MentorDashboard() {
  const navigate = useNavigate();
  const [mentorAuthId, setMentorAuthId] = useState<string | null>(null);
  /** `null` while resolving; then first name or "Mentor" if none */
  const [greetingName, setGreetingName] = useState<string | null>(null);
  const [requests, setRequests] = useState<MentorshipRequestRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;

    async function resolveSessionAndName() {
      setGreetingName(null);

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (cancelled) return;

      if (sessionError || !session?.user) {
        navigate('/login', { replace: true });
        return;
      }

      const user = session.user;
      setMentorAuthId(user.id);

      const meta = user.user_metadata ?? {};
      const fromMeta = [meta.full_name, meta.name, meta.display_name].find(
        (v): v is string => typeof v === 'string' && Boolean(v.trim())
      );

      if (fromMeta) {
        setGreetingName(firstNameFromFullName(fromMeta));
        return;
      }

      const { data: userRow, error: userError } = await supabase
        .from('users')
        .select('full_name')
        .eq('user_id', user.id)
        .maybeSingle();

      if (cancelled) return;

      if (userError) {
        setGreetingName('Mentor');
        return;
      }

      const row = userRow as Pick<
        Database['public']['Tables']['users']['Row'],
        'full_name'
      > | null;
      const full = row?.full_name;
      setGreetingName(typeof full === 'string' && full.trim() ? firstNameFromFullName(full) : 'Mentor');
    }

    void resolveSessionAndName();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  useEffect(() => {
    if (mentorAuthId === null) return;
    const mentorId: string = mentorAuthId;

    async function loadPendingRequests() {
      setIsLoading(true);
      setErrorMessage('');

      const { data, error } = await supabase
        .from('mentorship_requests')
        .select('request_id, student_id, mentor_id, status, created_at')
        .eq('status', 'Pending')
        .eq('mentor_id', mentorId)
        .order('created_at', { ascending: false });

      if (error) {
        setErrorMessage(error.message);
        setIsLoading(false);
        return;
      }

      setRequests((data ?? []) as MentorshipRequestRow[]);
      setIsLoading(false);
    }

    void loadPendingRequests();
  }, [mentorAuthId]);

  async function handleUpdateStatus(requestId: string, newStatus: 'Accepted' | 'Declined') {
    setUpdatingIds((prev) => {
      const next = new Set(prev);
      next.add(requestId);
      return next;
    });
    setErrorMessage('');

    const patch: MentorshipRequestUpdate = { status: newStatus };
    const { error } = await supabase
      .from('mentorship_requests')
      // Supabase client infers `.update()` as `never` for this table in strict project builds
      .update(patch as MentorshipRequestUpdate as never)
      .eq('request_id', requestId);

    if (error) {
      setErrorMessage(error.message);
      setUpdatingIds((prev) => {
        const next = new Set(prev);
        next.delete(requestId);
        return next;
      });
      return;
    }

    setRequests((prev) => prev.filter((request) => request.request_id !== requestId));
    setUpdatingIds((prev) => {
      const next = new Set(prev);
      next.delete(requestId);
      return next;
    });
  }

  async function handleLogout() {
    localStorage.removeItem(STORAGE_KEY);
    await supabase.auth.signOut();
    navigate('/login', { replace: true });
  }

  const content = useMemo(() => {
    if (isLoading) {
      return (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm dark:border-slate-700 dark:bg-gray-800">
          <p className="text-slate-600 dark:text-slate-400">Loading pending requests...</p>
        </div>
      );
    }

    if (requests.length === 0) {
      return (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm dark:border-slate-700 dark:bg-gray-800">
          <p className="text-slate-700 dark:text-slate-300">You have no pending requests.</p>
        </div>
      );
    }

    return (
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-gray-800">
        <ul className="divide-y divide-slate-200 dark:divide-slate-700">
          {requests.map((request) => {
            const createdDate = new Date(request.created_at);
            const formattedDate = Number.isNaN(createdDate.getTime())
              ? request.created_at
              : createdDate.toLocaleString();
            const isUpdating = updatingIds.has(request.request_id);

            return (
              <li
                key={request.request_id}
                className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    Student: {request.student_id}
                  </p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Requested on: {formattedDate}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={isUpdating}
                    onClick={() => void handleUpdateStatus(request.request_id, 'Accepted')}
                    className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    disabled={isUpdating}
                    onClick={() => void handleUpdateStatus(request.request_id, 'Declined')}
                    className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    Decline
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }, [isLoading, requests, updatingIds]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-900">
      <Navbar onLogout={handleLogout} />
      <main className="px-4 pt-24 pb-12">
        <section className="mx-auto max-w-5xl space-y-6">
          <div className="space-y-1">
            <p className="text-lg font-medium text-slate-700 dark:text-slate-200 sm:text-xl">
              Hi {greetingName === null ? 'Mentor' : greetingName},
            </p>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">
              Mentor Inbox
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Review and respond to pending mentorship requests.
            </p>
          </div>
          {errorMessage && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-400">
              {errorMessage}
            </div>
          )}
          {content}
        </section>
      </main>
    </div>
  );
}
