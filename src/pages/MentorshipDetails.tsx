import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  ExternalLink,
  Link2,
  Loader2,
  Video,
} from 'lucide-react';
import Navbar from '../components/NavBar.tsx';
import MentorWeeklyAvailability from '../components/MentorWeeklyAvailability.tsx';
import { dashboardPathForRole, dashboardPathFromStoredUser } from '../lib/dashboardPath';
import { isValidMeetingLink, normalizeMeetingLinkInput } from '../lib/meetingLink';
import { supabase } from '../lib/supabase';
import type { Database } from '../types/database.types';

type UserRow = Database['public']['Tables']['users']['Row'];
type MilestoneRow = Database['public']['Tables']['milestones']['Row'];
type PairingUpdate = Database['public']['Tables']['mentorship_pairing']['Update'];

const STORAGE_KEY = 'techsync_user';

function normPairingStatus(raw: string): 'active' | 'pending' | 'declined' | 'other' {
  const s = raw.trim().toLowerCase();
  if (s === 'active' || s === 'accepted') return 'active';
  if (s === 'pending') return 'pending';
  if (s === 'declined') return 'declined';
  return 'other';
}

function milestoneStudentSummary(m: MilestoneRow): string {
  const st = (m.progress_status ?? '').trim().toLowerCase().replace(/_/g, ' ');
  if (st === 'completed') return 'Completed';
  if (st.includes('needs review')) return 'Needs mentor review';
  if (st.includes('in progress')) return 'In progress';
  return 'Pending';
}

function milestoneDone(m: MilestoneRow): boolean {
  return (m.progress_status ?? '').trim().toLowerCase().replace(/_/g, ' ') === 'completed';
}

export default function MentorshipDetails() {
  const { pairingId: pairingIdParam } = useParams<{ pairingId: string }>();
  const navigate = useNavigate();
  const pairingId = pairingIdParam?.trim() ?? '';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewerRole, setViewerRole] = useState<'mentor' | 'student' | null>(null);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [pairingStatus, setPairingStatus] = useState('');
  const [counterpartName, setCounterpartName] = useState('');
  const [counterpartEmail, setCounterpartEmail] = useState('');
  const [mentorWeeklyAvailability, setMentorWeeklyAvailability] = useState<
    Database['public']['Tables']['users']['Row']['weekly_availability']
  >(null);
  const [meetingLink, setMeetingLink] = useState<string | null>(null);
  const [scheduledTime, setScheduledTime] = useState<string | null>(null);
  const [milestones, setMilestones] = useState<MilestoneRow[]>([]);

  const [syncDraft, setSyncDraft] = useState('');
  const [syncSaving, setSyncSaving] = useState(false);
  const [syncToast, setSyncToast] = useState<'saved' | null>(null);

  const loadPage = useCallback(async () => {
    if (!pairingId) {
      setError('Invalid mentorship link.');
      setLoading(false);
      return;
    }

    setError('');
    setLoading(true);

    const { data: authData, error: authErr } = await supabase.auth.getUser();
    if (authErr || !authData.user) {
      navigate('/login', { replace: true });
      return;
    }

    const authId = authData.user.id;

    const { data: userRow, error: userErr } = await supabase
      .from('users')
      .select('user_id, role, full_name, email')
      .eq('user_id', authId)
      .maybeSingle();

    if (userErr || !userRow) {
      navigate('/login', { replace: true });
      return;
    }

    const row = userRow as Pick<UserRow, 'user_id' | 'role' | 'full_name' | 'email'>;
    const roleNorm = (row.role ?? '').trim().toLowerCase();
    if (roleNorm !== 'mentor' && roleNorm !== 'student') {
      navigate(dashboardPathForRole(row.role ?? ''), { replace: true });
      return;
    }

    setViewerRole(roleNorm as 'mentor' | 'student');
    setViewerId(authId);

    const { data: pairingRow, error: pErr } = await supabase
      .from('mentorship_pairing')
      .select('pairing_id, student_id, mentor_id, status, meeting_link, scheduled_time')
      .eq('pairing_id', pairingId)
      .maybeSingle();

    if (pErr || !pairingRow) {
      setError(pErr?.message ?? 'Mentorship not found.');
      setLoading(false);
      return;
    }

    const pr = pairingRow as {
      pairing_id: string;
      student_id: string;
      mentor_id: string;
      status: string;
      meeting_link: string | null;
      scheduled_time: string | null;
    };

    if (pr.student_id !== authId && pr.mentor_id !== authId) {
      setError('You do not have access to this mentorship.');
      setLoading(false);
      return;
    }

    setPairingStatus(pr.status ?? '');
    const ml =
      typeof pr.meeting_link === 'string' && pr.meeting_link.trim() ? pr.meeting_link.trim() : null;
    setMeetingLink(ml);
    setSyncDraft(ml ?? '');
    const st =
      typeof pr.scheduled_time === 'string' && pr.scheduled_time.trim()
        ? pr.scheduled_time.trim()
        : null;
    setScheduledTime(st);

    const counterpartUserId = roleNorm === 'student' ? pr.mentor_id : pr.student_id;
    const { data: counterpart } = await supabase
      .from('users')
      .select('full_name, email, weekly_availability')
      .eq('user_id', counterpartUserId)
      .maybeSingle();

    const cu = counterpart as Pick<UserRow, 'full_name' | 'email' | 'weekly_availability'> | null;
    setCounterpartName(cu?.full_name?.trim() || (roleNorm === 'student' ? 'Mentor' : 'Student'));
    setCounterpartEmail(typeof cu?.email === 'string' ? cu.email : '');
    setMentorWeeklyAvailability(
      roleNorm === 'student' ? (cu?.weekly_availability ?? null) : null
    );

    const stNorm = normPairingStatus(pr.status);
    if (stNorm === 'active') {
      const { data: ms } = await supabase
        .from('milestones')
        .select('*')
        .eq('pairing_id', pairingId)
        .order('created_at', { ascending: true });
      setMilestones(
        ((ms ?? []) as MilestoneRow[]).map((m) => ({
          ...m,
          evidence_url: m.evidence_url ?? null,
          feedback_text: m.feedback_text ?? null,
        }))
      );
    } else {
      setMilestones([]);
    }

    setLoading(false);
  }, [navigate, pairingId]);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  useEffect(() => {
    if (!pairingId || !viewerId) return;

    const channel = supabase
      .channel(`mentorship_pairing:${pairingId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'mentorship_pairing',
          filter: `pairing_id=eq.${pairingId}`,
        },
        (payload) => {
          const next = payload.new as {
            meeting_link?: string | null;
            scheduled_time?: string | null;
            status?: string;
          };
          if (typeof next.meeting_link === 'string') {
            const v = next.meeting_link.trim();
            setMeetingLink(v || null);
          } else if (next.meeting_link === null) {
            setMeetingLink(null);
          }
          if (typeof next.scheduled_time === 'string') {
            const v = next.scheduled_time.trim();
            setScheduledTime(v || null);
          } else if (next.scheduled_time === null) {
            setScheduledTime(null);
          }
          if (typeof next.status === 'string') setPairingStatus(next.status);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [pairingId, viewerId]);

  useEffect(() => {
    if (!syncToast) return;
    const t = window.setTimeout(() => setSyncToast(null), 2400);
    return () => window.clearTimeout(t);
  }, [syncToast]);

  const milestoneProgressPercent = useMemo(() => {
    if (milestones.length === 0) return 0;
    return Math.round((milestones.filter((m) => milestoneDone(m)).length / milestones.length) * 100);
  }, [milestones]);

  const syncLinkInvalid =
    syncDraft.trim() !== '' && !isValidMeetingLink(syncDraft);
  const canSaveMeetingLink =
    syncDraft.trim() === '' || isValidMeetingLink(syncDraft);

  async function handleSaveSyncLink() {
    if (!pairingId || viewerRole !== 'mentor') return;
    const trimmed = syncDraft.trim();
    if (trimmed && !isValidMeetingLink(trimmed)) return;
    const toStore = trimmed ? normalizeMeetingLinkInput(trimmed) : '';
    setSyncSaving(true);
    setError('');
    const patch: PairingUpdate = { meeting_link: toStore || null };
    const { error: updErr } = await supabase
      .from('mentorship_pairing')
      .update(patch as PairingUpdate as never)
      .eq('pairing_id', pairingId);

    setSyncSaving(false);

    if (updErr) {
      setError(updErr.message);
      return;
    }

    setMeetingLink(toStore || null);
    setSyncDraft(toStore);
    setSyncToast('saved');
  }

  function handleLogout() {
    localStorage.removeItem(STORAGE_KEY);
    void supabase.auth.signOut();
    navigate('/login', { replace: true });
  }

  const backHref =
    viewerRole === 'mentor' ? '/mentor-dashboard' : viewerRole === 'student' ? '/student-dashboard' : dashboardPathFromStoredUser();

  const statusNorm = normPairingStatus(pairingStatus);
  const joinUrl = meetingLink?.startsWith('http') ? meetingLink : meetingLink ? `https://${meetingLink}` : null;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-gray-900">
        <Navbar onLogout={handleLogout} />
        <main className="flex min-h-[60vh] items-center justify-center px-4 pt-24">
          <Loader2 className="h-10 w-10 animate-spin text-slate-500" aria-hidden />
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-gray-900">
        <Navbar onLogout={handleLogout} />
        <main className="mx-auto max-w-lg px-4 pt-24 pb-12">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
            {error}
          </div>
          <Link
            to={backHref}
            className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-blue-600 dark:text-sky-400"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back to dashboard
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-900">
      <Navbar onLogout={handleLogout} />
      <main className="mx-auto max-w-6xl px-4 pt-24 pb-14">
        <Link
          to={backHref}
          className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
        >
          <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
          Back to dashboard
        </Link>

        <header className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
            Mentorship hub
          </h1>
          <p className="mt-2 text-slate-600 dark:text-slate-400">
            {viewerRole === 'student' ? 'Mentor' : 'Student'}:{' '}
            <span className="font-semibold text-slate-900 dark:text-white">{counterpartName}</span>
            {counterpartEmail ? (
              <>
                {' '}
                ·{' '}
                <a
                  href={`mailto:${counterpartEmail}`}
                  className="font-medium text-blue-600 underline-offset-2 hover:underline dark:text-sky-400"
                >
                  {counterpartEmail}
                </a>
              </>
            ) : null}
          </p>
          <p className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-500">
            Status:{' '}
            <span className="normal-case text-slate-700 dark:text-slate-300">{pairingStatus}</span>
          </p>
        </header>

        <div className="grid gap-8 lg:grid-cols-2 lg:gap-10">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-gray-800 sm:p-8">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Milestone roadmap</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Track progress on milestones for this pairing.
            </p>

            {statusNorm !== 'active' ? (
              <p className="mt-6 text-sm text-slate-600 dark:text-slate-400">
                Roadmap unlocks when this mentorship is active.
              </p>
            ) : milestones.length === 0 ? (
              <p className="mt-6 text-sm text-slate-600 dark:text-slate-400">
                No milestones yet.{' '}
                {viewerRole === 'mentor'
                  ? 'Add them from the full timeline view.'
                  : 'Your mentor will add them soon.'}
              </p>
            ) : (
              <>
                <div className="mt-6">
                  <div className="mb-1 flex justify-between text-xs font-medium text-slate-600 dark:text-slate-400">
                    <span>Progress</span>
                    <span>
                      {milestones.filter((m) => milestoneDone(m)).length} / {milestones.length}{' '}
                      completed
                    </span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                    <div
                      className="h-full rounded-full bg-blue-600 transition-all dark:bg-blue-500"
                      style={{ width: `${milestoneProgressPercent}%` }}
                    />
                  </div>
                </div>
                <ul className="mt-4 space-y-3">
                  {milestones.map((m) => (
                    <li
                      key={m.milestone_id}
                      className="flex items-start justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 dark:border-slate-700 dark:bg-slate-900/40"
                    >
                      <p
                        className={`min-w-0 text-sm leading-snug ${
                          milestoneDone(m)
                            ? 'font-medium text-slate-500 line-through dark:text-slate-400'
                            : 'font-medium text-slate-800 dark:text-slate-200'
                        }`}
                      >
                        {m.title}
                      </p>
                      <span className="shrink-0 text-xs font-semibold text-slate-600 dark:text-slate-400">
                        {milestoneStudentSummary(m)}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {statusNorm === 'active' && (
              <Link
                to={`/milestones/${pairingId}`}
                className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-blue-600 underline-offset-2 hover:underline dark:text-sky-400"
              >
                Open full milestone timeline
                <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              </Link>
            )}
          </section>

          <section className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-gray-800 sm:p-8">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-slate-600 dark:text-slate-400" aria-hidden />
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Meeting hub</h2>
              </div>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                Scheduling context and live session link for this mentorship.
              </p>

              {viewerRole === 'student' && (
                <div className="mt-5">
                  <MentorWeeklyAvailability value={mentorWeeklyAvailability ?? null} />
                </div>
              )}

              {scheduledTime && (
                <p className="mt-4 text-sm text-slate-700 dark:text-slate-300">
                  <span className="font-medium">Next / planned time: </span>
                  {new Date(scheduledTime).toLocaleString(undefined, {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </p>
              )}

              {viewerRole === 'mentor' && (
                <div className="mt-6 rounded-xl border border-violet-200 bg-violet-50/90 px-4 py-4 dark:border-violet-900/50 dark:bg-violet-950/30">
                  <div className="flex items-center gap-2 text-violet-900 dark:text-violet-200">
                    <Link2 className="h-4 w-4 shrink-0" aria-hidden />
                    <h3 className="text-sm font-semibold">Live sync setup</h3>
                  </div>
                  <p className="mt-2 text-xs text-violet-800/90 dark:text-violet-300/90">
                    Paste a Google Meet, Zoom, Microsoft Teams, or Webex link. Students see it
                    immediately when they open this hub.{' '}
                    <span className="font-medium">https://</span> is added automatically if you omit
                    it.
                  </p>
                  <label
                    className="mt-3 block text-xs font-medium text-violet-900 dark:text-violet-200"
                    htmlFor="mentorship-live-sync-url"
                  >
                    Google Meet / Zoom / Teams / Webex link
                    <input
                      id="mentorship-live-sync-url"
                      type="url"
                      inputMode="url"
                      autoComplete="url"
                      value={syncDraft}
                      onChange={(e) => setSyncDraft(e.target.value)}
                      placeholder="https://meet.google.com/... or https://zoom.us/..."
                      aria-invalid={syncLinkInvalid}
                      aria-describedby={
                        syncLinkInvalid ? 'mentorship-live-sync-url-error' : undefined
                      }
                      className={`mt-1.5 w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 dark:bg-gray-900 dark:text-white ${
                        syncLinkInvalid
                          ? 'border-red-500 focus:border-red-500 focus:ring-red-500/30 dark:border-red-500'
                          : 'border-violet-200 focus:border-violet-500 focus:ring-violet-500/30 dark:border-violet-800'
                      }`}
                    />
                  </label>
                  {syncLinkInvalid && (
                    <p
                      id="mentorship-live-sync-url-error"
                      className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400"
                      role="alert"
                    >
                      Please enter a valid meeting URL
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => void handleSaveSyncLink()}
                    disabled={syncSaving || !canSaveMeetingLink}
                    className="mt-3 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {syncSaving ? 'Saving…' : 'Save link'}
                  </button>
                  {syncToast === 'saved' && (
                    <p className="mt-2 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                      Link saved. Your mentee will see the updated join button.
                    </p>
                  )}
                </div>
              )}

              {viewerRole === 'student' && joinUrl && (
                <div className="mt-6 rounded-2xl border-2 border-emerald-300/80 bg-gradient-to-b from-emerald-50 to-white p-6 shadow-md dark:border-emerald-800/60 dark:from-emerald-950/40 dark:to-gray-900/80">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="relative flex h-3 w-3 shrink-0">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                      <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-emerald-400/50" />
                    </span>
                    <span className="text-xs font-bold uppercase tracking-wide text-emerald-800 dark:text-emerald-300">
                      Online — live sync available
                    </span>
                  </div>
                  <a
                    href={joinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-5 flex w-full animate-pulse items-center justify-center gap-2 rounded-xl bg-emerald-600 py-4 text-center text-base font-bold text-white shadow-lg shadow-emerald-600/25 transition hover:bg-emerald-500 hover:shadow-emerald-600/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 dark:shadow-emerald-900/40 sm:text-lg"
                  >
                    <Video className="h-5 w-5 shrink-0" aria-hidden />
                    Join live sync session
                    <ExternalLink className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                  </a>
                  <p className="mt-3 text-center text-xs text-slate-600 dark:text-slate-400">
                    Opens your mentor&apos;s meeting link in a new tab.
                  </p>
                </div>
              )}

              {viewerRole === 'student' && !joinUrl && (
                <p className="mt-6 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-600 dark:bg-slate-900/50 dark:text-slate-400">
                  Your mentor hasn&apos;t posted a live link yet. Check back after they save one in the
                  hub, or reach out by email.
                </p>
              )}

              {viewerRole === 'mentor' && meetingLink && (
                <p className="mt-4 flex flex-wrap items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                  <span>Current link:</span>
                  <a
                    href={joinUrl ?? '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="break-all font-medium text-blue-600 underline-offset-2 hover:underline dark:text-sky-400"
                  >
                    {meetingLink}
                  </a>
                </p>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
