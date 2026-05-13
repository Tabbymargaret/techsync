import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Plus, X } from 'lucide-react';
import Navbar from '../components/NavBar.tsx';
import { supabase } from '../lib/supabase';
import type { Database } from '../types/database.types';

type UserRow = Database['public']['Tables']['users']['Row'];
type MilestoneRow = Database['public']['Tables']['milestones']['Row'];

const STORAGE_KEY = 'techsync_user';

/** YYYY-MM-DD in local time (avoids UTC drift from `toISOString`). */
function toDateInputLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

type DisplayStatus = 'completed' | 'in_progress' | 'pending' | 'overdue';

function isActivePairingStatus(status: string): boolean {
  const s = status.trim().toLowerCase();
  return s === 'active' || s === 'accepted';
}

function getMilestoneDisplayStatus(m: MilestoneRow): DisplayStatus {
  if (m.is_completed) return 'completed';
  const due = new Date(`${m.due_date}T12:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  if (due < today) return 'overdue';
  const ps = (m.progress_status ?? '').trim().toLowerCase().replace(/_/g, ' ');
  if (ps === 'in progress') return 'in_progress';
  return 'pending';
}

function statusLabel(s: DisplayStatus): string {
  switch (s) {
    case 'completed':
      return 'Completed';
    case 'in_progress':
      return 'In Progress';
    case 'overdue':
      return 'Overdue';
    default:
      return 'Pending';
  }
}

function statusStyles(s: DisplayStatus): { dot: string; badge: string } {
  switch (s) {
    case 'completed':
      return {
        dot: 'bg-emerald-500',
        badge: 'bg-emerald-500/15 text-emerald-400 ring-emerald-500/30',
      };
    case 'in_progress':
      return {
        dot: 'bg-sky-500',
        badge: 'bg-sky-500/15 text-sky-300 ring-sky-500/30',
      };
    case 'overdue':
      return {
        dot: 'bg-red-500',
        badge: 'bg-red-500/15 text-red-400 ring-red-500/30',
      };
    default:
      return {
        dot: 'bg-zinc-500',
        badge: 'bg-zinc-600/50 text-zinc-300 ring-zinc-500/25',
      };
  }
}

export default function MilestoneTimeline() {
  const { pairingId } = useParams<{ pairingId: string }>();
  const navigate = useNavigate();
  const [studentName, setStudentName] = useState('');
  const [pairingEndDate, setPairingEndDate] = useState<string | null>(null);
  const [milestones, setMilestones] = useState<MilestoneRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [savingDueId, setSavingDueId] = useState<string | null>(null);

  const minDueDateToday = toDateInputLocal(new Date());

  const loadPage = useCallback(async () => {
    if (!pairingId) {
      setError('Missing pairing in URL.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    const { data: authData, error: authError } = await supabase.auth.getUser();
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

    if (userError || !userRow) {
      localStorage.removeItem(STORAGE_KEY);
      navigate('/login', { replace: true });
      return;
    }

    const row = userRow as UserRow;
    if ((row.role ?? '').trim().toLowerCase() !== 'mentor') {
      navigate('/student-dashboard', { replace: true });
      return;
    }

    const { data: pairingRow, error: pairErr } = await supabase
      .from('mentorship_pairing')
      .select('pairing_id, student_id, mentor_id, status, end_date')
      .eq('pairing_id', pairingId)
      .maybeSingle();

    if (pairErr || !pairingRow) {
      setError(pairErr?.message ?? 'Pairing not found.');
      setLoading(false);
      return;
    }

    const pr = pairingRow as {
      pairing_id: string;
      student_id: string;
      mentor_id: string;
      status: string;
      end_date: string;
    };

    if (pr.mentor_id !== authId) {
      setError('You do not have access to this pairing.');
      setLoading(false);
      return;
    }

    if (!isActivePairingStatus(pr.status)) {
      setError('This mentorship is not active.');
      setLoading(false);
      return;
    }

    setPairingEndDate(pr.end_date ?? null);

    const { data: studentUser } = await supabase
      .from('users')
      .select('full_name')
      .eq('user_id', pr.student_id)
      .maybeSingle();

    const su = studentUser as { full_name: string | null } | null;
    setStudentName(su?.full_name?.trim() || pr.student_id);

    const { data: ms, error: msErr } = await supabase
      .from('milestones')
      .select('*')
      .eq('pairing_id', pairingId)
      .order('created_at', { ascending: true });

    if (msErr) {
      setError(msErr.message);
    } else {
      setMilestones(
        ((ms ?? []) as MilestoneRow[]).map((m) => ({
          ...m,
          is_completed: Boolean(m.is_completed),
        }))
      );
    }

    setLoading(false);
  }, [navigate, pairingId]);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  const completedCount = useMemo(
    () => milestones.filter((m) => m.is_completed).length,
    [milestones]
  );
  const totalCount = milestones.length;
  const progressPercent = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);

  const daysRemainingLifecycle = useMemo(() => {
    if (!pairingEndDate) return null;
    const end = new Date(`${pairingEndDate}T12:00:00`);
    const now = new Date();
    const diff = end.getTime() - now.getTime();
    return Math.ceil(diff / 86400000);
  }, [pairingEndDate]);

  const openNewModal = useCallback(() => {
    setNewTitle('');
    setNewDescription('');
    const today = toDateInputLocal(new Date());
    const d = new Date();
    d.setMonth(d.getMonth() + 3);
    let def = toDateInputLocal(d);
    if (def < today) def = today;
    setNewDueDate(def);
    setModalOpen(true);
  }, []);

  const handleDueDateChange = useCallback(async (milestoneId: string, value: string) => {
    const todayStr = toDateInputLocal(new Date());
    if (!value || value < todayStr) {
      setError('Due date cannot be in the past.');
      return;
    }
    setSavingDueId(milestoneId);
    setError('');
    try {
      const { error: upErr } = await supabase
        .from('milestones')
        .update({ due_date: value } as never)
        .eq('milestone_id', milestoneId);
      if (upErr) {
        setError(upErr.message);
        return;
      }
      setMilestones((prev) =>
        prev.map((m) => (m.milestone_id === milestoneId ? { ...m, due_date: value } : m))
      );
    } finally {
      setSavingDueId(null);
    }
  }, []);

  const handleCreateMilestone = useCallback(async () => {
    const title = newTitle.trim();
    if (!pairingId || !title || !newDueDate) return;

    if (newDueDate < toDateInputLocal(new Date())) {
      setError('Due date cannot be in the past.');
      return;
    }

    setSaving(true);
    setError('');
    const payload: Database['public']['Tables']['milestones']['Insert'] = {
      pairing_id: pairingId,
      title,
      description: newDescription.trim() || null,
      due_date: newDueDate,
      progress_status: 'Not Started',
      is_completed: false,
    };

    try {
      const { data, error: insErr } = await supabase
        .from('milestones')
        .insert(payload as never)
        .select()
        .single();

      if (insErr) {
        setError(insErr.message);
        return;
      }

      const row = data as MilestoneRow;
      setMilestones((prev) => [...prev, { ...row, is_completed: Boolean(row.is_completed) }]);
      setModalOpen(false);
      setNewTitle('');
      setNewDescription('');
    } finally {
      setSaving(false);
    }
  }, [newDescription, newDueDate, newTitle, pairingId]);

  async function handleLogout() {
    localStorage.removeItem(STORAGE_KEY);
    await supabase.auth.signOut();
    navigate('/login', { replace: true });
  }

  return (
    <div className="min-h-screen bg-slate-950 text-zinc-100">
      <Navbar onLogout={handleLogout} />
      <main className="px-4 pt-24 pb-16">
        <div className="mx-auto max-w-3xl space-y-8">
          <Link
            to="/mentor-dashboard"
            className="inline-flex items-center gap-2 text-sm font-medium text-zinc-400 transition hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back to inbox
          </Link>

          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-950/40 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900/40 py-20">
              <Loader2 className="h-10 w-10 animate-spin text-zinc-500" aria-hidden />
              <p className="mt-4 text-sm text-zinc-400">Loading milestones…</p>
            </div>
          ) : (
            <>
              <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 space-y-1">
                  <h1 className="text-3xl font-bold tracking-tight text-white">Milestone Timeline</h1>
                  <p className="text-sm text-zinc-400">
                    Pairing {pairingId ?? '—'} · {studentName} · {completedCount} of {totalCount}{' '}
                    complete
                  </p>
                </div>
                <button
                  type="button"
                  onClick={openNewModal}
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-zinc-200"
                >
                  <Plus className="h-4 w-4" aria-hidden />
                  New milestone
                </button>
              </header>

              <section className="space-y-3">
                <div className="h-3 w-full overflow-hidden rounded-full bg-zinc-800">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-sky-600 to-sky-400 transition-[width] duration-500"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <div className="flex flex-col gap-2 text-sm text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
                  <p>
                    {progressPercent}% complete
                    {daysRemainingLifecycle !== null && (
                      <>
                        {' '}
                        ·{' '}
                        {daysRemainingLifecycle >= 0
                          ? `${daysRemainingLifecycle} days remaining in lifecycle`
                          : 'Lifecycle period has ended'}
                      </>
                    )}
                  </p>
                  <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs sm:text-sm">
                    <li className="inline-flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
                      Completed
                    </li>
                    <li className="inline-flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-sky-500" aria-hidden />
                      In Progress
                    </li>
                    <li className="inline-flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-zinc-500" aria-hidden />
                      Pending
                    </li>
                    <li className="inline-flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-red-500" aria-hidden />
                      Overdue
                    </li>
                  </ul>
                </div>
              </section>

              <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/50 p-6 shadow-xl shadow-black/20">
                {milestones.length === 0 ? (
                  <p className="text-center text-sm text-zinc-500">
                    No milestones yet. Add one to start the roadmap.
                  </p>
                ) : (
                  <ul className="relative space-y-0">
                    {milestones.map((m, index) => {
                      const disp = getMilestoneDisplayStatus(m);
                      const st = statusStyles(disp);
                      const isLast = index === milestones.length - 1;
                      return (
                        <li key={m.milestone_id} className="relative flex gap-4 pb-10 last:pb-0">
                          {!isLast && (
                            <div
                              className="absolute left-[7px] top-4 bottom-0 w-px bg-zinc-700"
                              aria-hidden
                            />
                          )}
                          <div className="relative z-[1] flex h-4 w-4 shrink-0 items-center justify-center pt-1">
                            <span className={`h-3.5 w-3.5 rounded-full ${st.dot}`} aria-hidden />
                          </div>
                          <div className="min-w-0 flex-1 pt-0.5">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                              <div className="min-w-0 space-y-1">
                                <p className="font-semibold text-white">{m.title}</p>
                                {m.description ? (
                                  <p className="text-sm text-zinc-400">{m.description}</p>
                                ) : null}
                                <div className="mt-2">
                                  <label
                                    htmlFor={`due-${m.milestone_id}`}
                                    className="mb-1 block text-xs font-medium text-zinc-500"
                                  >
                                    Due date
                                  </label>
                                  <input
                                    id={`due-${m.milestone_id}`}
                                    type="date"
                                    min={minDueDateToday}
                                    value={m.due_date ? String(m.due_date).slice(0, 10) : ''}
                                    disabled={savingDueId === m.milestone_id}
                                    onChange={(e) => void handleDueDateChange(m.milestone_id, e.target.value)}
                                    className="max-w-[11.5rem] cursor-pointer rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-white [color-scheme:dark] focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600 disabled:cursor-not-allowed disabled:opacity-50"
                                  />
                                </div>
                              </div>
                              <span
                                className={`shrink-0 self-start rounded-full px-3 py-1 text-xs font-semibold ring-1 ${st.badge}`}
                              >
                                {statusLabel(disp)}
                              </span>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
      </main>

      {modalOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-milestone-title"
        >
          <div className="relative w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="absolute right-4 top-4 rounded-lg p-1 text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
            <h2 id="new-milestone-title" className="text-lg font-semibold text-white">
              New milestone
            </h2>
            <p className="mt-1 text-sm text-zinc-400">Add a title, optional description, and due date.</p>

            <div className="mt-6 space-y-4">
              <div>
                <label htmlFor="ms-title" className="block text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Title
                </label>
                <input
                  id="ms-title"
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Update and review CV"
                  className="mt-1.5 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600"
                />
              </div>
              <div>
                <label htmlFor="ms-desc" className="block text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Description
                </label>
                <textarea
                  id="ms-desc"
                  rows={3}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="What should the student focus on?"
                  className="mt-1.5 w-full resize-none rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600"
                />
              </div>
              <div>
                <label htmlFor="ms-due" className="block text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Due date
                </label>
                <input
                  id="ms-due"
                  type="date"
                  min={minDueDateToday}
                  value={newDueDate}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (!v) {
                      setNewDueDate('');
                      return;
                    }
                    setNewDueDate(v < minDueDateToday ? minDueDateToday : v);
                  }}
                  className="mt-1.5 w-full cursor-pointer rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white [color-scheme:dark] focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600"
                />
              </div>
            </div>

            <div className="mt-8 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-xl border border-zinc-600 px-4 py-2.5 text-sm font-semibold text-zinc-300 transition hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving || !newTitle.trim() || !newDueDate}
                onClick={() => void handleCreateMilestone()}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                Save milestone
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
