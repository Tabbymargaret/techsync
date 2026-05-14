import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Navbar from '../components/NavBar.tsx';
import { supabase } from '../lib/supabase';
import type { Database } from '../types/database.types';
import { dashboardPathForRole } from '../lib/dashboardPath';

type UserRow = Database['public']['Tables']['users']['Row'];

function GoogleLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
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

  async function handleGoogleSignIn() {
    setError('');
    setOauthLoading(true);
    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin + '/dashboard',
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
            scopes: 'https://www.googleapis.com/auth/calendar.events',
          },
        },
      });
      if (oauthError) {
        setError(oauthError.message);
        setOauthLoading(false);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Google sign-in failed';
      setError(message);
      setOauthLoading(false);
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
              disabled={isLoading || oauthLoading}
              className="w-full rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200 dark:focus:ring-white dark:focus:ring-offset-gray-800"
            >
              {isLoading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <div className="relative my-8">
            <div
              className="absolute inset-0 flex items-center"
              aria-hidden
            >
              <div className="w-full border-t border-slate-200 dark:border-slate-600" />
            </div>
            <div className="relative flex justify-center text-xs font-medium uppercase tracking-wide">
              <span className="bg-white px-3 text-slate-500 dark:bg-gray-800 dark:text-slate-400">
                or
              </span>
            </div>
          </div>

          <button
            type="button"
            disabled={oauthLoading || isLoading}
            onClick={() => void handleGoogleSignIn()}
            className="flex w-full items-center justify-center gap-3 rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 dark:border-slate-600 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 dark:focus:ring-offset-gray-800"
          >
            {oauthLoading ? (
              <span className="text-slate-600">Redirecting…</span>
            ) : (
              <>
                <GoogleLogo className="h-5 w-5 shrink-0" />
                Continue with Google
              </>
            )}
          </button>

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
