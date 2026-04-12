import { useCallback, useEffect, useState } from 'react';
import emailjs from '@emailjs/browser';
import { Check, Flame, UserPlus } from 'lucide-react';
import { getMentorDisplayName } from '../lib/mentors';
import { supabase } from '../lib/supabase';

export type MentorCardData = {
  user_id: string;
  full_name: string | null;
  email?: string | null;
  tech_stack: string[] | null;
  matchScore: number;
};

type MentorCardProps = {
  mentor: MentorCardData;
  /** Logged-in student `user_id` from `techsync_user` (not Supabase Auth). */
  studentId: string;
  hasRequested: boolean;
  onRequestSuccess: (mentorId: string) => void;
  /** When true, student already has a Pending/Accepted mentorship (one-at-a-time). */
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
  studentId,
  hasRequested,
  onRequestSuccess,
  requestsGloballyDisabled = false,
}: MentorCardProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), TOAST_MS);
    return () => window.clearTimeout(t);
  }, [toast]);

  const handleSendRequest = useCallback(async () => {
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
          {mentor.matchScore}% Match
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
    </div>
  );
}
