import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Navbar from '../components/NavBar.tsx';
import { supabase } from '../lib/supabase';
import type { Database } from '../types/database.types';
import { dashboardPathForRole } from '../lib/dashboardPath';

type UserRow = Database['public']['Tables']['users']['Row'];

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const trimmedEmail = email.trim();

      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });

      if (authError) {
        setError(authError.message || 'Invalid email or password');
        return;
      }

      if (!authData.session) {
        setError(
          'No active session. If email confirmation is required, check your inbox and try again.'
        );
        return;
      }

      const authUser = authData.user;

      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('user_id', authUser.id)
        .maybeSingle();

      if (profileError) {
        setError(profileError.message);
        await supabase.auth.signOut();
        return;
      }

      let roleForRoute: string;

      if (profile) {
        localStorage.setItem('techsync_user', JSON.stringify(profile));
        roleForRoute = (profile as UserRow).role;
      } else {
        const fallbackRole =
          typeof authUser.user_metadata?.role === 'string'
            ? authUser.user_metadata.role
            : 'Student';
        localStorage.setItem(
          'techsync_user',
          JSON.stringify({
            user_id: authUser.id,
            email: authUser.email ?? trimmedEmail,
            full_name:
              typeof authUser.user_metadata?.full_name === 'string'
                ? authUser.user_metadata.full_name
                : null,
            role: fallbackRole,
            tech_stack: null,
            password_hash: '',
            created_at: new Date().toISOString(),
          })
        );
        roleForRoute = fallbackRole;
      }

      const nextPath = dashboardPathForRole(roleForRoute);
      if (nextPath === '/login') {
        localStorage.removeItem('techsync_user');
        await supabase.auth.signOut();
      }
      navigate(nextPath, { replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Invalid email or password';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-900">
      <Navbar />
      <div className="px-4 pt-24 pb-12">
      <div className="mx-auto w-full max-w-md">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-700 dark:bg-gray-800">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Sign in
          </h1>
          <p className="mt-2 text-slate-600 dark:text-slate-400">
            Enter your credentials to access your account.
          </p>
          {error && (
            <div className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </div>
          )}
          <form onSubmit={handleLogin} className="mt-8 space-y-6">
            <div>
              <label
                htmlFor="login-email"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Email
              </label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="mt-2 block w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 placeholder-slate-400 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 dark:border-slate-600 dark:bg-gray-700 dark:text-white dark:placeholder-slate-500 dark:focus:border-slate-400 dark:focus:ring-slate-400"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label
                htmlFor="login-password"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Password
              </label>
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="mt-2 block w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 placeholder-slate-400 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 dark:border-slate-600 dark:bg-gray-700 dark:text-white dark:placeholder-slate-500 dark:focus:border-slate-400 dark:focus:ring-slate-400"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200 dark:focus:ring-white dark:focus:ring-offset-gray-800"
            >
              {isLoading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
          <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">
            Don&apos;t have an account?{' '}
            <Link
              to="/register"
              className="font-medium text-slate-900 underline transition hover:text-slate-700 dark:text-white dark:hover:text-slate-300"
            >
              Sign up
            </Link>
          </p>
        </div>
      </div>
      </div>
    </div>
  );
}
