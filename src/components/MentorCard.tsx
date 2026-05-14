import { useCallback, useEffect, useMemo, useState } from 'react';
import emailjs from '@emailjs/browser';
import { Check, Flame, UserPlus } from 'lucide-react';
import MentorWeeklyAvailability from './MentorWeeklyAvailability.tsx';
import { calculateMatchScore, getMentorDisplayName } from '../lib/mentors';
import { supabase } from '../lib/supabase';
import type { Json } from '../types/database.types';

export type MentorCardData = {
  user_id: string;
  full_name: string | null;
  email?: string | null;
  tech_stack: string[] | null;
  matchScore: number;
  weekly_availability?: Json | null;
};

type MentorCardProps = {
  mentor: MentorCardData;
  /** Student profile tech stack — used to compute match % (denominator = normalized student skill count). */
  studentTechStack: string[] | null;
  /** Logged-in user `user_id` from `localStorage` `techsync_user` (see docs/CONTEXT.md). */
  studentId: string;
  /** `techsync_user.role` — used to block mentor-to-mentor requests. */
  viewerRole: string;
  hasRequested: boolean;
  onRequestSuccess: (mentorId: string) => void;
  /**
   * When true, the student already has a Pending or Active pairing and cannot send another request.
   * Do not set for Declined-only (after reset / delete the row, requests work again).
   */
  requestsGloballyDisabled?: boolean;
};

const TOAST_MS = 3500;

export async function insertMentorshipRequest(
  studentId: string,
  mentorId: string
): Promise<{ error: Error | null }> {
  try {
    if (!studentId.trim()) {
      return { error: new Error('You must be logged in to send a request.') };
    }
    if (studentId.trim() === mentorId.trim()) {
      return { error: new Error('You cannot send a mentorship request to yourself.') };
    }
    const payload = {
      student_id: studentId,
      mentor_id: mentorId,
      status: 'Pending',
    };
    const { error } = await supabase.from('mentorship_pairing').insert(payload as never);
    if (error) {
      return { error: new Error(error.message) };
    }
    return { error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Request failed.';
    return { error: new Error(message) };
  }
}

export default function MentorCard({
  mentor,
  studentTechStack,
  studentId,
  viewerRole,
  hasRequested,
  onRequestSuccess,
  requestsGloballyDisabled = false,
}: MentorCardProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );

  const isViewerMentor = viewerRole.trim().toLowerCase() === 'mentor';

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), TOAST_MS);
    return () => window.clearTimeout(t);
  }, [toast]);

  const matchScoreDisplay = useMemo(
    () => calculateMatchScore(studentTechStack ?? [], mentor.tech_stack ?? []),
    [studentTechStack, mentor.tech_stack]
  );

  const handleSendRequest = useCallback(async () => {
    if (studentId.trim() === mentor.user_id.trim()) return;
    if (isViewerMentor) return;
    if (hasRequested || isSubmitting || requestsGloballyDisabled) return;
    setIsSubmitting(true);
    try {
      const { error } = await insertMentorshipRequest(studentId, mentor.user_id);
      if (error) {
        console.error('Mentorship request failed:', error);
        setToast({ type: 'error', message: error.message });
        return;
      }
      setToast({ type: 'success', message: 'Mentorship request sent!' });
      onRequestSuccess(mentor.user_id);
      try {
        await emailjs.send(
          'service_lsio4nt',
          'template_kljm4sa',
          {
            to_email: (mentor.email ?? '').trim(),
            student_name: 'A Student',
          },
          {
            publicKey: 'DTJVb3Gg5evA10t3Z'
          }
        );
      } catch (emailErr) {
        console.error('EmailJS mentor notification failed:', emailErr);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Request failed.';
      console.error('Mentorship request failed:', err);
      setToast({ type: 'error', message });
    } finally {
      setIsSubmitting(false);
    }
  }, [
    hasRequested,
    isSubmitting,
    isViewerMentor,
    requestsGloballyDisabled,
    mentor.email,
    mentor.user_id,
    onRequestSuccess,
    studentId,
  ]);

  const requested = hasRequested;
  const slotBlocksOtherMentors = requestsGloballyDisabled && !hasRequested;
  const disabled = requested || isSubmitting || requestsGloballyDisabled;

  return (
    <div className="flex min-h-[240px] flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-300 hover:scale-[1.02] hover:shadow-xl dark:border-slate-700 dark:bg-gray-800">
      {toast && (
        <div
          className={`mb-3 rounded-lg px-3 py-2 text-xs font-medium ${
            toast.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200'
              : 'bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-200'
          }`}
          role="status"
        >
          {toast.message}
        </div>
      )}
      <div className="mb-4 flex items-start justify-between gap-2">
        <p className="break-words text-sm font-medium text-slate-900 dark:text-white">
          {getMentorDisplayName(mentor)}
        </p>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">
          <Flame className="h-3.5 w-3.5 text-amber-800 dark:text-amber-200" aria-hidden />
          {matchScoreDisplay}% Match
        </span>
      </div>
      <div className="flex flex-1 flex-wrap content-start gap-2">
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
      <div className="mt-4">
        <MentorWeeklyAvailability value={mentor.weekly_availability ?? null} />
      </div>
      {isViewerMentor ? (
        <p className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-center text-xs font-medium text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300">
          View Profile Only
        </p>
      ) : (
        <button
          type="button"
          onClick={handleSendRequest}
          disabled={disabled}
          className={`mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 ${
            requested || slotBlocksOtherMentors
              ? 'cursor-not-allowed bg-slate-300 text-slate-600 opacity-75 dark:bg-slate-600 dark:text-slate-300'
              : 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500 hover:cursor-pointer disabled:cursor-not-allowed disabled:opacity-70 dark:bg-blue-600 dark:text-white dark:hover:bg-blue-500 dark:focus:ring-blue-400'
          }`}
        >
          {requested ? (
            <>
              <Check className="h-4 w-4 shrink-0" aria-hidden />
              Request Sent
            </>
          ) : slotBlocksOtherMentors ? (
            <>One mentorship at a time</>
          ) : (
            <>
              <UserPlus className="h-4 w-4 shrink-0" aria-hidden />
              {isSubmitting ? 'Sending…' : 'Request Mentorship'}
            </>
          )}
        </button>
      )}
    </div>
  );
}
