import { useState } from 'react';
import { Link } from 'react-router-dom';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Auth logic will be wired up later
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-900 px-4 pt-24 pb-12">
      <div className="mx-auto w-full max-w-md">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-700 dark:bg-gray-800">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Sign in
          </h1>
          <p className="mt-2 text-slate-600 dark:text-slate-400">
            Enter your credentials to access your account.
          </p>
          <form onSubmit={handleSubmit} className="mt-8 space-y-6">
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
              className="w-full rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200 dark:focus:ring-white dark:focus:ring-offset-gray-800"
            >
              Sign In
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
  );
}
