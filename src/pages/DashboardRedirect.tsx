import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { dashboardPathFromStoredUser } from '../lib/dashboardPath';
import { supabase } from '../lib/supabase';

/**
 * Redirects `/dashboard` using `techsync_user`, or to `/login` when data is missing or invalid.
 */
export default function DashboardRedirect() {
  const navigate = useNavigate();

  useEffect(() => {
    async function run() {
      const path = dashboardPathFromStoredUser();
      if (path === '/login') {
        localStorage.removeItem('techsync_user');
        await supabase.auth.signOut();
      }
      navigate(path, { replace: true });
    }
    void run();
  }, [navigate]);

  return (
    <div className="flex min-h-[50vh] items-center justify-center px-4">
      <p className="text-slate-600 dark:text-slate-400">Redirecting…</p>
    </div>
  );
}
