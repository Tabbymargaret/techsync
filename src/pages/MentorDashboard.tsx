import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Settings } from 'lucide-react';
import Navbar from '../components/NavBar.tsx';
import { supabase } from '../lib/supabase';
import type { Database } from '../types/database.types';

type MentorshipPairingRow = Database['public']['Tables']['mentorship_pairing']['Row'];
type MentorshipPairingUpdate = Database['public']['Tables']['mentorship_pairing']['Update'];

type PairingListColumns = Pick<
  MentorshipPairingRow,
  'pairing_id' | 'student_id' | 'mentor_id' | 'status' | 'created_at'
>;

/** Inbox row with resolved student profile for display */
type PendingRequestWithStudent = PairingListColumns & {
  studentDisplayName: string;
  studentTechStack: string[];
};

const PAIRING_LIST_SELECT =
  'pairing_id, student_id, mentor_id, status, created_at' as const;

const STORAGE_KEY = 'techsync_user';

function parseEmbeddedStudent(raw: unknown): {
  full_name: string | null;
  tech_stack: string[] | null;
} | null {
  if (raw == null) return null;
  if (Array.isArray(raw)) {
    const first = raw[0];
    if (first && typeof first === 'object' && first !== null) {
      return first as { full_name: string | null; tech_stack: string[] | null };
    }
    return null;
  }
  if (typeof raw === 'object') {
    return raw as { full_name: string | null; tech_stack: string[] | null };
  }
  return null;
}

function mapJoinRowsToPending(rows: unknown[]): PendingRequestWithStudent[] {
  return rows.map((row) => {
    const r = row as Record<string, unknown>;
    const student = parseEmbeddedStudent(r.student);
    const student_id = String(r.student_id ?? '');
    const name = student?.full_name?.trim();
    const stack = student?.tech_stack;
    return {
      pairing_id: String(r.pairing_id ?? ''),
      student_id,
      mentor_id: String(r.mentor_id ?? ''),
      status: String(r.status ?? ''),
      created_at: String(r.created_at ?? ''),
      studentDisplayName: name || student_id,
      studentTechStack: Array.isArray(stack) ? stack : [],
    };
  });
}

async function enrichPairingsWithUsers(
  pairings: PairingListColumns[]
): Promise<PendingRequestWithStudent[]> {
  const ids = [...new Set(pairings.map((p) => p.student_id).filter(Boolean))];
  const userById = new Map<string, { full_name: string | null; tech_stack: string[] | null }>();

  if (ids.length > 0) {
    const { data: userRows } = await supabase
      .from('users')
      .select('user_id, full_name, tech_stack')
      .in('user_id', ids);

    for (const u of userRows ?? []) {
      const row = u as {
        user_id: string;
        full_name: string | null;
        tech_stack: string[] | null;
      };
      userById.set(row.user_id, { full_name: row.full_name, tech_stack: row.tech_stack });
    }
  }

  return pairings.map((p) => {
    const u = userById.get(p.student_id);
    const name = u?.full_name?.trim();
    return {
      ...p,
      studentDisplayName: name || p.student_id,
      studentTechStack: u?.tech_stack ?? [],
    };
  });
}

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
  const [requests, setRequests] = useState<PendingRequestWithStudent[]>([]);
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
    let cancelled = false;

    async function loadPendingRequests() {
      setIsLoading(true);
      setErrorMessage('');

      const joinSelect = `${PAIRING_LIST_SELECT}, student:users!student_id(full_name, tech_stack)`;

      const { data: joinData, error: joinError } = await supabase
        .from('mentorship_pairing')
        .select(joinSelect)
        .eq('status', 'Pending')
        .eq('mentor_id', mentorId)
        .order('created_at', { ascending: false });

      let list: PendingRequestWithStudent[] = [];

      if (!joinError && joinData != null) {
        list = mapJoinRowsToPending(joinData);
      } else {
        const { data: baseRows, error: baseError } = await supabase
          .from('mentorship_pairing')
          .select(PAIRING_LIST_SELECT)
          .eq('status', 'Pending')
          .eq('mentor_id', mentorId)
          .order('created_at', { ascending: false });

        if (baseError) {
          if (!cancelled) {
            setErrorMessage(
              joinError
                ? `${joinError.message} (fallback: ${baseError.message})`
                : baseError.message
            );
            setIsLoading(false);
          }
          return;
        }

        list = await enrichPairingsWithUsers((baseRows ?? []) as PairingListColumns[]);
      }

      if (cancelled) return;
      setRequests(list);
      setIsLoading(false);
    }

    void loadPendingRequests();
    return () => {
      cancelled = true;
    };
  }, [mentorAuthId]);

  async function handleUpdateStatus(pairingId: string, newStatus: 'Accepted' | 'Declined') {
    setUpdatingIds((prev) => {
      const next = new Set(prev);
      next.add(pairingId);
      return next;
    });
    setErrorMessage('');

    const patch: MentorshipPairingUpdate = { status: newStatus };
    const { error } = await supabase
      .from('mentorship_pairing')
      .update(patch as MentorshipPairingUpdate as never)
      .eq('pairing_id', pairingId);

    if (error) {
      setErrorMessage(error.message);
      setUpdatingIds((prev) => {
        const next = new Set(prev);
        next.delete(pairingId);
        return next;
      });
      return;
    }

    setRequests((prev) => prev.filter((request) => request.pairing_id !== pairingId));
    setUpdatingIds((prev) => {
      const next = new Set(prev);
      next.delete(pairingId);
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
            const isUpdating = updatingIds.has(request.pairing_id);

            return (
              <li
                key={request.pairing_id}
                className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1 space-y-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      {request.studentDisplayName}
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Requested on: {formattedDate}
                    </p>
                  </div>
                  {request.studentTechStack.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {request.studentTechStack.map((skill) => (
                        <span
                          key={skill}
                          className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-200"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 dark:text-slate-400">No skills listed</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={isUpdating}
                    onClick={() => void handleUpdateStatus(request.pairing_id, 'Accepted')}
                    className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    disabled={isUpdating}
                    onClick={() => void handleUpdateStatus(request.pairing_id, 'Declined')}
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
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 space-y-1">
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
            <Link
              to="/profile"
              className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
            >
              <Settings className="h-4 w-4 shrink-0 text-white dark:text-slate-900" aria-hidden />
              Edit Profile
            </Link>
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
