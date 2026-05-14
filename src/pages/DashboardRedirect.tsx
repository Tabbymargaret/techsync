import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { dashboardPathForRole } from '../lib/dashboardPath';
import { ensureAppUserAndProfileFromSession } from '../lib/ensureSessionAndProfile';
import { supabase } from '../lib/supabase';

/**
 * OAuth returns here first; establishes session, syncs profile, then sends users to role home.
 * Otherwise behaves like a session-based gate (no valid session → login).
 */
export default function DashboardRedirect() {
  const navigate = useNavigate();

  useEffect(() => {
    async function run() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        localStorage.removeItem('techsync_user');
        navigate('/login', { replace: true });
        return;
      }

      const userRow = await ensureAppUserAndProfileFromSession();
      if (!userRow) {
        localStorage.removeItem('techsync_user');
        await supabase.auth.signOut();
        navigate('/login', { replace: true });
        return;
      }

      const next = dashboardPathForRole(userRow.role);
      if (next === '/login') {
        localStorage.removeItem('techsync_user');
        await supabase.auth.signOut();
        navigate('/login', { replace: true });
        return;
      }

      navigate(next, { replace: true });
    }
    void run();
  }, [navigate]);

  return (
    <div className="flex min-h-[50vh] items-center justify-center px-4">
      <p className="text-slate-600 dark:text-slate-400">Redirecting…</p>
    </div>
  );
}
