import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, Loader2, ListTodo, Settings, X } from 'lucide-react';
import Navbar from '../components/NavBar.tsx';
import { dashboardPathForRole } from '../lib/dashboardPath.ts';
import { supabase } from '../lib/supabase';
import type { Database } from '../types/database.types';

type UserRow = Database['public']['Tables']['users']['Row'];

type MentorshipPairingRow = Database['public']['Tables']['mentorship_pairing']['Row'];
type MentorshipPairingUpdate = Database['public']['Tables']['mentorship_pairing']['Update'];
type MilestoneRow = Database['public']['Tables']['milestones']['Row'];

type PairingListColumns = Pick<
  MentorshipPairingRow,
  'pairing_id' | 'student_id' | 'mentor_id' | 'status' | 'created_at'
>;

/** Inbox row with resolved student profile for display */
type PendingRequestWithStudent = PairingListColumns & {
  studentDisplayName: string;
  studentTechStack: string[];
};

/** Active pairing + student display + roadmap */
type ActiveMentee = {
  pairing_id: string;
  student_id: string;
  studentDisplayName: string;
  milestones: MilestoneRow[];
};

function isActivePairingStatus(status: string): boolean {
  const s = status.trim().toLowerCase();
  return s === 'active' || s === 'accepted';
}

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
    const stack = Array.isArray(student?.tech_stack) ? student.tech_stack : [];
    return {
      pairing_id: String(r.pairing_id ?? ''),
      student_id,
      mentor_id: String(r.mentor_id ?? ''),
      status: String(r.status ?? ''),
      created_at: String(r.created_at ?? ''),
      studentDisplayName: name || student_id,
      studentTechStack: stack,
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
    const stack = Array.isArray(u?.tech_stack) ? u.tech_stack : [];
    return {
      ...p,
      studentDisplayName: name || p.student_id,
      studentTechStack: stack,
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
  /** False until `users` row is verified for this session (avoid stale cached names). */
  const [isIdentityReady, setIsIdentityReady] = useState(false);
  const [greetingName, setGreetingName] = useState('Mentor');
  const [requests, setRequests] = useState<PendingRequestWithStudent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(() => new Set());
  const [toast, setToast] = useState<{ type: 'success'; message: string } | null>(null);
  const [activeMentees, setActiveMentees] = useState<ActiveMentee[]>([]);
  const [activeMenteesLoading, setActiveMenteesLoading] = useState(false);
  const [roadmapPairingId, setRoadmapPairingId] = useState<string | null>(null);
  const [newMilestoneTitle, setNewMilestoneTitle] = useState('');
  const [milestoneBusyPairingId, setMilestoneBusyPairingId] = useState<string | null>(null);
  const [deletingMilestoneId, setDeletingMilestoneId] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    let cancelled = false;

    async function verifySessionAndProfile() {
      setIsIdentityReady(false);
      setMentorAuthId(null);

      const { data: authData, error: authError } = await supabase.auth.getUser();

      if (cancelled) return;

      if (authError || !authData.user) {
        localStorage.removeItem(STORAGE_KEY);
        navigate('/login', { replace: true });
        return;
      }

      const authId = authData.user.id;

      const { data: userRow, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('user_id', authId)
        .maybeSingle();

      if (cancelled) return;

      if (userError || !userRow) {
        localStorage.removeItem(STORAGE_KEY);
        navigate('/login', { replace: true });
        return;
      }

      const row = userRow as UserRow;
      const roleNorm = (row.role ?? '').trim().toLowerCase();
      if (roleNorm !== 'mentor') {
        navigate(dashboardPathForRole(row.role ?? ''), { replace: true });
        return;
      }

      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(row));
      } catch {
        /* ignore quota / private mode */
      }

      const display =
        typeof row.full_name === 'string' && row.full_name.trim()
          ? firstNameFromFullName(row.full_name)
          : 'Mentor';
      setGreetingName(display);
      setMentorAuthId(authId);
      setIsIdentityReady(true);
    }

    void verifySessionAndProfile();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const loadPendingRequests = useCallback(async (opts?: { quiet?: boolean }) => {
    const mentorId = mentorAuthId;
    if (!mentorId) return;

    if (!opts?.quiet) {
      setIsLoading(true);
    }
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
        setErrorMessage(
          joinError ? `${joinError.message} (fallback: ${baseError.message})` : baseError.message
        );
        if (!opts?.quiet) {
          setIsLoading(false);
        }
        return;
      }

      list = await enrichPairingsWithUsers((baseRows ?? []) as PairingListColumns[]);
    }

    setRequests(list);
    if (!opts?.quiet) {
      setIsLoading(false);
    }
  }, [mentorAuthId]);

  const loadActiveMentees = useCallback(async (opts?: { quiet?: boolean }) => {
    const mentorId = mentorAuthId;
    if (!mentorId) {
      setActiveMentees([]);
      return;
    }

    if (!opts?.quiet) {
      setActiveMenteesLoading(true);
    }

    try {
      const { data: pairRows, error: pairErr } = await supabase
        .from('mentorship_pairing')
        .select('pairing_id, student_id, status')
        .eq('mentor_id', mentorId);

      if (pairErr) {
        console.error('active pairings:', pairErr);
        return;
      }

      const activePairings = (pairRows ?? []).filter((r) =>
        isActivePairingStatus(String((r as { status?: string }).status ?? ''))
      ) as { pairing_id: string; student_id: string }[];

      const pairingIds = activePairings.map((p) => String(p.pairing_id ?? '')).filter(Boolean);
      const studentIds = [
        ...new Set(activePairings.map((p) => String(p.student_id ?? '')).filter(Boolean)),
      ];

      const userById = new Map<string, string>();
      if (studentIds.length > 0) {
        const { data: userRows } = await supabase
          .from('users')
          .select('user_id, full_name')
          .in('user_id', studentIds);
        for (const u of userRows ?? []) {
          const row = u as { user_id: string; full_name: string | null };
          const name = row.full_name?.trim();
          userById.set(row.user_id, name || row.user_id);
        }
      }

      const milestonesByPairing = new Map<string, MilestoneRow[]>();
      if (pairingIds.length > 0) {
        const { data: ms, error: msErr } = await supabase
          .from('milestones')
          .select('*')
          .in('pairing_id', pairingIds)
          .order('created_at', { ascending: true });
        if (msErr) {
          console.error('milestones fetch:', msErr);
        } else {
          for (const m of (ms ?? []) as MilestoneRow[]) {
            const pid = String(m.pairing_id);
            const list = milestonesByPairing.get(pid) ?? [];
            list.push(m);
            milestonesByPairing.set(pid, list);
          }
        }
      }

      const list: ActiveMentee[] = activePairings.map((p) => {
        const pid = String(p.pairing_id);
        const sid = String(p.student_id);
        return {
          pairing_id: pid,
          student_id: sid,
          studentDisplayName: userById.get(sid) ?? sid,
          milestones: milestonesByPairing.get(pid) ?? [],
        };
      });

      setActiveMentees(list);
    } finally {
      if (!opts?.quiet) {
        setActiveMenteesLoading(false);
      }
    }
  }, [mentorAuthId]);

  useEffect(() => {
    void loadActiveMentees();
  }, [loadActiveMentees]);

  useEffect(() => {
    void loadPendingRequests();
  }, [loadPendingRequests]);

  const handleUpdateStatus = useCallback(
    async (pairingId: string, action: 'accept' | 'decline') => {
      setUpdatingIds((prev) => {
        const next = new Set(prev);
        next.add(pairingId);
        return next;
      });
      setErrorMessage('');

      try {
        if (action === 'accept') {
          const patch: MentorshipPairingUpdate = { status: 'Active' };
          const { error } = await supabase
            .from('mentorship_pairing')
            .update(patch as MentorshipPairingUpdate as never)
            .eq('pairing_id', pairingId);
          if (error) {
            console.error('mentorship_pairing update (accept) failed:', error);
            setErrorMessage(error.message);
            return;
          }
        } else {
          /** Persist declined requests (do not delete the row here). */
          const patch: MentorshipPairingUpdate = { status: 'Declined' };
          const { error } = await supabase
            .from('mentorship_pairing')
            .update(patch as MentorshipPairingUpdate as never)
            .eq('pairing_id', pairingId);
          if (error) {
            console.error('mentorship_pairing update (decline) failed:', error);
            setErrorMessage(error.message);
            return;
          }
        }

        setToast({
          type: 'success',
          message:
            action === 'accept'
              ? 'Mentorship request accepted. The student will see this as active.'
              : 'Request declined. The student will be notified on their dashboard.',
        });
        await loadPendingRequests({ quiet: true });
        if (action === 'accept') {
          await loadActiveMentees({ quiet: true });
        }
      } catch (err) {
        console.error('mentorship_pairing accept/decline failed:', err);
        const msg =
          err && typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string'
            ? (err as { message: string }).message
            : 'Something went wrong.';
        setErrorMessage(msg);
      } finally {
        setUpdatingIds((prev) => {
          const next = new Set(prev);
          next.delete(pairingId);
          return next;
        });
      }
    },
    [loadActiveMentees, loadPendingRequests]
  );

  const handleAddMilestone = useCallback(
    async (pairingId: string) => {
      const title = newMilestoneTitle.trim();
      if (!title) return;
      setMilestoneBusyPairingId(pairingId);
      setErrorMessage('');
      const due = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);
      const payload: Database['public']['Tables']['milestones']['Insert'] = {
        pairing_id: pairingId,
        title,
        description: null,
        due_date: due,
        progress_status: 'Not Started',
        is_completed: false,
      };
      try {
        const { data, error } = await supabase
          .from('milestones')
          .insert(payload as never)
          .select()
          .single();
        if (error) {
          setErrorMessage(error.message);
          return;
        }
        const row = data as MilestoneRow;
        setActiveMentees((prev) =>
          prev.map((m) =>
            m.pairing_id === pairingId ? { ...m, milestones: [...m.milestones, row] } : m
          )
        );
        setNewMilestoneTitle('');
      } finally {
        setMilestoneBusyPairingId(null);
      }
    },
    [newMilestoneTitle]
  );

  const handleDeleteMilestone = useCallback(async (pairingId: string, milestoneId: string) => {
    setDeletingMilestoneId(milestoneId);
    setErrorMessage('');
    try {
      const { error } = await supabase.from('milestones').delete().eq('milestone_id', milestoneId);
      if (error) {
        setErrorMessage(error.message);
        return;
      }
      setActiveMentees((prev) =>
        prev.map((m) =>
          m.pairing_id === pairingId
            ? { ...m, milestones: m.milestones.filter((x) => x.milestone_id !== milestoneId) }
            : m
        )
      );
    } finally {
      setDeletingMilestoneId(null);
    }
  }, []);

  async function handleLogout() {
    localStorage.removeItem(STORAGE_KEY);
    await supabase.auth.signOut();
    navigate('/login', { replace: true });
  }

  const content = useMemo(() => {
    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white py-14 shadow-sm dark:border-slate-700 dark:bg-gray-800">
          <Loader2 className="h-10 w-10 animate-spin text-slate-500 dark:text-slate-400" aria-hidden />
          <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">Loading pending requests…</p>
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
      <ul className="space-y-4">
        {requests.map((request) => {
          const createdDate = new Date(request.created_at);
          const formattedDate = Number.isNaN(createdDate.getTime())
            ? request.created_at
            : createdDate.toLocaleString();
          const isUpdating = updatingIds.has(request.pairing_id);

          return (
            <li
              key={request.pairing_id}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-gray-800"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1 space-y-3">
                  <div>
                    <p className="text-base font-semibold text-slate-900 dark:text-white">
                      {request.studentDisplayName}
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Requested on: {formattedDate}
                    </p>
                  </div>
                  {request.studentTechStack.length > 0 ? (
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Student tech stack
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {request.studentTechStack.map((skill) => (
                          <span
                            key={skill}
                            className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-200"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 dark:text-slate-400">No skills listed</p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
                  <button
                    type="button"
                    disabled={isUpdating}
                    onClick={() => void handleUpdateStatus(request.pairing_id, 'accept')}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 active:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-emerald-500"
                  >
                    {isUpdating ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    ) : (
                      <Check className="h-4 w-4 shrink-0" aria-hidden />
                    )}
                    Accept Request
                  </button>
                  <button
                    type="button"
                    disabled={isUpdating}
                    onClick={() => void handleUpdateStatus(request.pairing_id, 'decline')}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-300 bg-white px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-50 active:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-800 dark:bg-gray-800 dark:text-red-400 dark:hover:bg-red-950/40"
                  >
                    {isUpdating ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    ) : (
                      <X className="h-4 w-4 shrink-0" aria-hidden />
                    )}
                    Decline
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    );
  }, [handleUpdateStatus, isLoading, requests, updatingIds]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-900">
      <Navbar onLogout={handleLogout} />
      <main className="px-4 pt-24 pb-12">
        <section className="mx-auto max-w-5xl space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 space-y-1">
              <p className="text-lg font-medium text-slate-700 dark:text-slate-200 sm:text-xl">
                {isIdentityReady ? (
                  <>Hi {greetingName},</>
                ) : (
                  <span
                    className="inline-block h-7 w-40 max-w-[60%] animate-pulse rounded-lg bg-slate-200 dark:bg-slate-700"
                    aria-hidden
                  />
                )}
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

          {toast && (
            <div
              className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-900/25 dark:text-emerald-200"
              role="status"
            >
              {toast.message}
            </div>
          )}

          {errorMessage && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-400">
              {errorMessage}
            </div>
          )}

          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Pending Requests</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Students waiting for your response: Pending Status.
            </p>
            <div className="mt-4">{content}</div>
          </div>

          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
              <ListTodo className="h-5 w-5 shrink-0 text-slate-600 dark:text-slate-400" aria-hidden />
              Active Mentees
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Students with an active mentorship — set milestones for their roadmap.
            </p>
            <div className="mt-4">
              {!isIdentityReady || mentorAuthId === null ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white py-10 shadow-sm dark:border-slate-700 dark:bg-gray-800">
                  <Loader2 className="h-8 w-8 animate-spin text-slate-500 dark:text-slate-400" aria-hidden />
                </div>
              ) : activeMenteesLoading ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white py-14 shadow-sm dark:border-slate-700 dark:bg-gray-800">
                  <Loader2 className="h-10 w-10 animate-spin text-slate-500 dark:text-slate-400" aria-hidden />
                  <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">Loading active mentees…</p>
                </div>
              ) : activeMentees.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm dark:border-slate-700 dark:bg-gray-800">
                  <p className="text-slate-700 dark:text-slate-300">
                    No active mentees yet. Accept a pending request to start a roadmap.
                  </p>
                </div>
              ) : (
                <ul className="space-y-4">
                  {activeMentees.map((mentee) => {
                    const isRoadmapOpen = roadmapPairingId === mentee.pairing_id;
                    const isAdding = milestoneBusyPairingId === mentee.pairing_id;
                    return (
                      <li
                        key={mentee.pairing_id}
                        className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-gray-800"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <p className="text-base font-semibold text-slate-900 dark:text-white">
                              {mentee.studentDisplayName}
                            </p>
                            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                              {mentee.milestones.length} milestone
                              {mentee.milestones.length === 1 ? '' : 's'}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setNewMilestoneTitle('');
                              setRoadmapPairingId((openId) =>
                                openId === mentee.pairing_id ? null : mentee.pairing_id
                              );
                            }}
                            className="shrink-0 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-gray-800 dark:text-slate-200 dark:hover:bg-slate-700/50"
                          >
                            {isRoadmapOpen ? 'Close Roadmap' : 'Manage Roadmap'}
                          </button>
                        </div>

                        {mentee.milestones.length > 0 && (
                          <ul className="mt-4 space-y-2 border-t border-slate-100 pt-4 dark:border-slate-700/80">
                            {mentee.milestones.map((ms) => {
                              const isDeleting = deletingMilestoneId === ms.milestone_id;
                              return (
                                <li
                                  key={ms.milestone_id}
                                  className="flex flex-wrap items-center justify-between gap-2 text-sm"
                                >
                                  <span className="font-medium text-slate-800 dark:text-slate-200">
                                    {ms.title}
                                  </span>
                                  <button
                                    type="button"
                                    disabled={isDeleting}
                                    onClick={() => void handleDeleteMilestone(mentee.pairing_id, ms.milestone_id)}
                                    className="rounded-md border border-red-200 px-2.5 py-1 text-xs font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/30"
                                  >
                                    {isDeleting ? '…' : 'Delete'}
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        )}

                        {isRoadmapOpen && (
                          <div className="mt-4 space-y-3 rounded-lg border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-600 dark:bg-slate-800/50">
                            <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                              Add milestone
                            </p>
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                              <label htmlFor={`milestone-title-${mentee.pairing_id}`} className="sr-only">
                                Milestone title
                              </label>
                              <input
                                id={`milestone-title-${mentee.pairing_id}`}
                                type="text"
                                value={newMilestoneTitle}
                                onChange={(e) => setNewMilestoneTitle(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    void handleAddMilestone(mentee.pairing_id);
                                  }
                                }}
                                placeholder="Milestone Title"
                                className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-gray-900 dark:text-white dark:placeholder:text-slate-500"
                              />
                              <button
                                type="button"
                                disabled={isAdding || !newMilestoneTitle.trim()}
                                onClick={() => void handleAddMilestone(mentee.pairing_id)}
                                className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {isAdding ? (
                                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                                ) : null}
                                Add
                              </button>
                            </div>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}