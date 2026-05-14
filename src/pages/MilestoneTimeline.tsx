import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Loader2, MessageSquare, Plus, X } from 'lucide-react';
import Navbar from '../components/NavBar.tsx';
import { dashboardPathForRole } from '../lib/dashboardPath.ts';
import { supabase } from '../lib/supabase';
import type { Database } from '../types/database.types';

type UserRow = Database['public']['Tables']['users']['Row'];
type MilestoneRow = Database['public']['Tables']['milestones']['Row'];

const STORAGE_KEY = 'techsync_user';

/** Exact value allowed by `milestones_progress_status_check` in Postgres. */
const PROGRESS_STATUS_NEEDS_REVIEW = 'Needs Review';

/** YYYY-MM-DD in local time (avoids UTC drift from `toISOString`). */
function toDateInputLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function normalizeEvidenceUrl(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  try {
    const withProto = t.includes('://') ? t : `https://${t}`;
    const u = new URL(withProto);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.toString();
  } catch {
    return null;
  }
}

function normStatus(raw: string | null | undefined): string {
  return (raw ?? '').trim().toLowerCase().replace(/_/g, ' ');
}

/** True when milestone is approved / done (from `progress_status`). */
function milestoneIsDone(m: MilestoneRow): boolean {
  return normStatus(m.progress_status) === 'completed';
}

type DisplayStatus = 'completed' | 'in_progress' | 'needs_review' | 'pending' | 'overdue';

function isActivePairingStatus(status: string): boolean {
  const s = status.trim().toLowerCase();
  return s === 'active' || s === 'accepted';
}

function getMilestoneDisplayStatus(m: MilestoneRow): DisplayStatus {
  const st = normStatus(m.progress_status);
  if (st === 'completed') return 'completed';
  if (st === 'needs review') return 'needs_review';
  if (st === 'in progress') return 'in_progress';
  const due = new Date(`${m.due_date}T12:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  if (due < today) return 'overdue';
  return 'pending';
}

function statusLabel(s: DisplayStatus): string {
  switch (s) {
    case 'completed':
      return 'Completed';
    case 'in_progress':
      return 'In Progress';
    case 'needs_review':
      return PROGRESS_STATUS_NEEDS_REVIEW;
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
    case 'needs_review':
      return {
        dot: 'bg-amber-500',
        badge: 'bg-amber-500/15 text-amber-300 ring-amber-400/30',
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
  const [viewerRole, setViewerRole] = useState<'mentor' | 'student' | null>(null);
  const [counterpartName, setCounterpartName] = useState('');
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
  const [approveBusyId, setApproveBusyId] = useState<string | null>(null);
  const [feedbackModalMilestoneId, setFeedbackModalMilestoneId] = useState<string | null>(null);
  const [feedbackDraft, setFeedbackDraft] = useState('');
  const [feedbackSending, setFeedbackSending] = useState(false);
  const [evidenceModalForId, setEvidenceModalForId] = useState<string | null>(null);
  const [evidenceUrlDraft, setEvidenceUrlDraft] = useState('');
  const [evidenceSaving, setEvidenceSaving] = useState(false);

  const minDueDateToday = toDateInputLocal(new Date());
  const isMentor = viewerRole === 'mentor';
  const isStudent = viewerRole === 'student';

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
    const roleNorm = (row.role ?? '').trim().toLowerCase();
    if (roleNorm !== 'mentor' && roleNorm !== 'student') {
      navigate(dashboardPathForRole(row.role ?? ''), { replace: true });
      return;
    }

    const vr: 'mentor' | 'student' = roleNorm === 'mentor' ? 'mentor' : 'student';
    setViewerRole(vr);

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

    if (vr === 'mentor' && pr.mentor_id !== authId) {
      setError('You do not have access to this pairing.');
      setLoading(false);
      return;
    }
    if (vr === 'student' && pr.student_id !== authId) {
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

    if (vr === 'mentor') {
      const { data: studentUser } = await supabase
        .from('users')
        .select('full_name')
        .eq('user_id', pr.student_id)
        .maybeSingle();
      const su = studentUser as { full_name: string | null } | null;
      setCounterpartName(su?.full_name?.trim() || pr.student_id);
    } else {
      const { data: mentorUser } = await supabase
        .from('users')
        .select('full_name')
        .eq('user_id', pr.mentor_id)
        .maybeSingle();
      const mu = mentorUser as { full_name: string | null } | null;
      setCounterpartName(mu?.full_name?.trim() || pr.mentor_id);
    }

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
          evidence_url: m.evidence_url ?? null,
          feedback_text: m.feedback_text ?? null,
        }))
      );
    }

    setLoading(false);
  }, [navigate, pairingId]);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  const completedCount = useMemo(
    () => milestones.filter((m) => milestoneIsDone(m)).length,
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
      progress_status: 'Pending',
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
      setMilestones((prev) => [
        ...prev,
        { ...row, evidence_url: row.evidence_url ?? null, feedback_text: row.feedback_text ?? null },
      ]);
      setModalOpen(false);
      setNewTitle('');
      setNewDescription('');
    } finally {
      setSaving(false);
    }
  }, [newDescription, newDueDate, newTitle, pairingId]);

  const openEvidenceModal = useCallback((m: MilestoneRow) => {
    setError('');
    setEvidenceModalForId(m.milestone_id);
    setEvidenceUrlDraft(m.evidence_url ?? '');
  }, []);

  const handleSaveEvidence = useCallback(async () => {
    if (!evidenceModalForId) return;
    const url = normalizeEvidenceUrl(evidenceUrlDraft);
    if (!url) {
      setError('Enter a valid URL (e.g. https://github.com/…).');
      return;
    }
    setEvidenceSaving(true);
    setError('');
    try {
      const updatePayload: Database['public']['Tables']['milestones']['Update'] = {
        evidence_url: url,
        progress_status: PROGRESS_STATUS_NEEDS_REVIEW,
        feedback_text: null,
      };
      const { data, error: upErr } = await supabase
        .from('milestones')
        .update(updatePayload as never)
        .eq('milestone_id', evidenceModalForId)
        .select()
        .single();

      if (upErr) {
        setError(upErr.message);
        return;
      }
      const row = data as MilestoneRow;
      setMilestones((prev) =>
        prev.map((m) =>
          m.milestone_id === evidenceModalForId
            ? {
                ...m,
                evidence_url: row.evidence_url ?? url,
                progress_status: PROGRESS_STATUS_NEEDS_REVIEW,
                feedback_text: null,
              }
            : m
        )
      );
      setEvidenceModalForId(null);
      setEvidenceUrlDraft('');
    } finally {
      setEvidenceSaving(false);
    }
  }, [evidenceModalForId, evidenceUrlDraft]);

  const handleApprove = useCallback(async (milestoneId: string) => {
    setApproveBusyId(milestoneId);
    setError('');
    try {
      const { error: upErr } = await supabase
        .from('milestones')
        .update({
          progress_status: 'Completed',
          feedback_text: null,
        } as never)
        .eq('milestone_id', milestoneId);

      if (upErr) {
        setError(upErr.message);
        return;
      }
      setMilestones((prev) =>
        prev.map((m) =>
          m.milestone_id === milestoneId
            ? { ...m, progress_status: 'Completed', feedback_text: null }
            : m
        )
      );
    } finally {
      setApproveBusyId(null);
    }
  }, []);

  const handleSendFeedback = useCallback(async () => {
    if (!feedbackModalMilestoneId) return;
    const text = feedbackDraft.trim();
    if (!text) {
      setError('Please enter feedback for the student.');
      return;
    }
    setFeedbackSending(true);
    setError('');
    try {
      const updatePayload: Database['public']['Tables']['milestones']['Update'] = {
        progress_status: 'In Progress',
        feedback_text: text,
        evidence_url: null,
      };
      const { data, error: upErr } = await supabase
        .from('milestones')
        .update(updatePayload as never)
        .eq('milestone_id', feedbackModalMilestoneId)
        .select()
        .single();

      if (upErr) {
        setError(upErr.message);
        return;
      }
      const row = data as MilestoneRow;
      setMilestones((prev) =>
        prev.map((m) =>
          m.milestone_id === feedbackModalMilestoneId
            ? {
                ...m,
                progress_status: 'In Progress',
                feedback_text: row.feedback_text ?? text,
                evidence_url: null,
              }
            : m
        )
      );
      setFeedbackModalMilestoneId(null);
      setFeedbackDraft('');
    } finally {
      setFeedbackSending(false);
    }
  }, [feedbackDraft, feedbackModalMilestoneId]);

  async function handleLogout() {
    localStorage.removeItem(STORAGE_KEY);
    await supabase.auth.signOut();
    navigate('/login', { replace: true });
  }

  const backHref = isMentor ? '/mentor-dashboard' : '/student-dashboard';
  const backLabel = isMentor ? 'Back to inbox' : 'Back to dashboard';

  const headerSubtitle =
    isMentor || !counterpartName
      ? `Pairing ${pairingId ?? '—'} · ${counterpartName || '…'} · ${completedCount} of ${totalCount} complete`
      : `Pairing ${pairingId ?? '—'} · Mentor: ${counterpartName} · ${completedCount} of ${totalCount} complete`;

  return (
    <div className="min-h-screen bg-slate-950 text-zinc-100">
      <Navbar onLogout={handleLogout} />
      <main className="px-4 pt-24 pb-16">
        <div className="mx-auto max-w-3xl space-y-8">
          <Link
            to={backHref}
            className="inline-flex items-center gap-2 text-sm font-medium text-zinc-400 transition hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            {backLabel}
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
                  <p className="text-sm text-zinc-400">{headerSubtitle}</p>
                </div>
                {isMentor && (
                  <button
                    type="button"
                    onClick={openNewModal}
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-zinc-200"
                  >
                    <Plus className="h-4 w-4" aria-hidden />
                    New milestone
                  </button>
                )}
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
                      <span className="h-2 w-2 rounded-full bg-amber-500" aria-hidden />
                      Needs Review
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
                    {isMentor
                      ? 'No milestones yet. Add one to start the roadmap.'
                      : 'Your mentor has not added milestones yet.'}
                  </p>
                ) : (
                  <ul className="relative space-y-0">
                    {milestones.map((m, index) => {
                      const disp = getMilestoneDisplayStatus(m);
                      const st = statusStyles(disp);
                      const isLast = index === milestones.length - 1;
                      const needsReview = normStatus(m.progress_status) === 'needs review';
                      const rowMentorBusy =
                        approveBusyId === m.milestone_id ||
                        (feedbackSending && feedbackModalMilestoneId === m.milestone_id);
                      const busyApprove = approveBusyId === m.milestone_id;
                      const showMentorNote =
                        isStudent &&
                        normStatus(m.progress_status) === 'in progress' &&
                        (m.feedback_text?.trim() ?? '') !== '';
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
                                {isMentor && (
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
                                )}
                                {isStudent && (
                                  <p className="mt-2 text-xs text-zinc-500">
                                    Due {m.due_date ? String(m.due_date).slice(0, 10) : '—'}
                                  </p>
                                )}
                                {showMentorNote ? (
                                  <div
                                    className="mt-3 flex gap-3 rounded-xl border border-amber-400/35 bg-amber-500/[0.12] px-3.5 py-3.5 shadow-sm ring-1 ring-amber-400/15"
                                    role="note"
                                  >
                                    <MessageSquare
                                      className="mt-0.5 h-5 w-5 shrink-0 text-amber-400"
                                      aria-hidden
                                    />
                                    <div className="min-w-0">
                                      <p className="text-xs font-semibold uppercase tracking-wide text-amber-200/95">
                                        Mentor&apos;s note
                                      </p>
                                      <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-amber-50">
                                        {m.feedback_text}
                                      </p>
                                    </div>
                                  </div>
                                ) : null}
                                {isStudent && !milestoneIsDone(m) && (
                                  <div className="mt-3">
                                    <button
                                      type="button"
                                      onClick={() => openEvidenceModal(m)}
                                      className="rounded-lg bg-amber-500/20 px-3 py-1.5 text-xs font-semibold text-amber-200 ring-1 ring-amber-500/40 transition hover:bg-amber-500/30"
                                    >
                                      Add evidence
                                    </button>
                                    {m.evidence_url ? (
                                      <p className="mt-2 truncate text-xs text-zinc-500">
                                        Submitted:{' '}
                                        <span className="text-zinc-400">{m.evidence_url}</span>
                                      </p>
                                    ) : null}
                                  </div>
                                )}
                                {isMentor && needsReview && (
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    <button
                                      type="button"
                                      disabled={!m.evidence_url || rowMentorBusy}
                                      onClick={() =>
                                        m.evidence_url &&
                                        window.open(m.evidence_url, '_blank', 'noopener,noreferrer')
                                      }
                                      className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-zinc-200 ring-1 ring-zinc-600 transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                      <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                                      Review work
                                    </button>
                                    <button
                                      type="button"
                                      disabled={rowMentorBusy}
                                      onClick={() => void handleApprove(m.milestone_id)}
                                      className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600/90 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                      {busyApprove ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                                      ) : null}
                                      Approve
                                    </button>
                                    <button
                                      type="button"
                                      disabled={rowMentorBusy}
                                      onClick={() => {
                                        setError('');
                                        setFeedbackModalMilestoneId(m.milestone_id);
                                        setFeedbackDraft('');
                                      }}
                                      className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-sky-500/50 bg-sky-500/10 px-3 py-1.5 text-xs font-semibold text-sky-300 transition hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                      Request changes
                                    </button>
                                  </div>
                                )}
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

      {modalOpen && isMentor && (
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

      {evidenceModalForId && isStudent && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="evidence-modal-title"
        >
          <div className="relative w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl">
            <button
              type="button"
              onClick={() => {
                setEvidenceModalForId(null);
                setEvidenceUrlDraft('');
              }}
              className="absolute right-4 top-4 rounded-lg p-1 text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
            <h2 id="evidence-modal-title" className="text-lg font-semibold text-white">
              Add evidence
            </h2>
            <p className="mt-1 text-sm text-zinc-400">
              Link to your work (CV, portfolio, GitHub PR, etc.). Your mentor will review it before marking
              the milestone complete.
            </p>
            <label htmlFor="evidence-url" className="mt-6 block text-xs font-medium uppercase tracking-wide text-zinc-500">
              Evidence URL
            </label>
            <input
              id="evidence-url"
              type="url"
              inputMode="url"
              value={evidenceUrlDraft}
              onChange={(e) => setEvidenceUrlDraft(e.target.value)}
              placeholder="https://…"
              className="mt-1.5 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
            <div className="mt-8 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  setEvidenceModalForId(null);
                  setEvidenceUrlDraft('');
                }}
                className="rounded-xl border border-zinc-600 px-4 py-2.5 text-sm font-semibold text-zinc-300 transition hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={evidenceSaving || !evidenceUrlDraft.trim()}
                onClick={() => void handleSaveEvidence()}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {evidenceSaving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                Submit for review
              </button>
            </div>
          </div>
        </div>
      )}

      {feedbackModalMilestoneId && isMentor && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="feedback-modal-title"
        >
          <div className="relative w-full max-w-lg rounded-2xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl">
            <button
              type="button"
              onClick={() => {
                setFeedbackModalMilestoneId(null);
                setFeedbackDraft('');
              }}
              className="absolute right-4 top-4 rounded-lg p-1 text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
            <h2 id="feedback-modal-title" className="text-lg font-semibold text-white">
              Request changes
            </h2>
            <p className="mt-1 text-sm text-zinc-400">
              Explain what the student should revise. They will see this as a mentor note and can submit new
              evidence. Their previous link will be cleared.
            </p>
            <label
              htmlFor="feedback-text"
              className="mt-6 block text-xs font-medium uppercase tracking-wide text-zinc-500"
            >
              Feedback for student
            </label>
            <textarea
              id="feedback-text"
              rows={5}
              value={feedbackDraft}
              onChange={(e) => setFeedbackDraft(e.target.value)}
              placeholder="e.g. Please fix the formatting on page 2 and re-upload the PDF."
              className="mt-1.5 w-full resize-y rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600"
            />
            <div className="mt-8 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  setFeedbackModalMilestoneId(null);
                  setFeedbackDraft('');
                }}
                className="rounded-xl border border-zinc-600 px-4 py-2.5 text-sm font-semibold text-zinc-300 transition hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={feedbackSending || !feedbackDraft.trim()}
                onClick={() => void handleSendFeedback()}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {feedbackSending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                Send feedback
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
