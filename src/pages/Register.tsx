import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Navbar from '../components/NavBar.tsx';
import { supabase } from '../lib/supabase';
import type { Database } from '../types/database.types';

type Role = 'Student' | 'Mentor';
type UserInsert = Database['public']['Tables']['users']['Insert'];

export default function Register() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('Student');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const row: UserInsert = {
        full_name: fullName,
        email,
        role,
        password_hash: password,
      };
      // @ts-expect-error - Supabase generated types can infer never for insert; row matches users.Insert
      const { error: insertError } = await supabase.from('users').insert(row);
      if (insertError) throw insertError;
      navigate('/login');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Registration failed';
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
            Create account
          </h1>
          <p className="mt-2 text-slate-600 dark:text-slate-400">
            Join TechSync as a student or mentor.
          </p>
          {error && (
            <div className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </div>
          )}
          <form onSubmit={handleRegister} className="mt-8 space-y-6">
            <div>
              <label
                htmlFor="register-name"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Full Name
              </label>
              <input
                id="register-name"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                autoComplete="name"
                className="mt-2 block w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 placeholder-slate-400 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 dark:border-slate-600 dark:bg-gray-700 dark:text-white dark:placeholder-slate-500 dark:focus:border-slate-400 dark:focus:ring-slate-400"
                placeholder="Jane Doe"
              />
            </div>
            <div>
              <label
                htmlFor="register-email"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Email
              </label>
              <input
                id="register-email"
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
                htmlFor="register-password"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Password
              </label>
              <input
                id="register-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
                className="mt-2 block w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 placeholder-slate-400 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 dark:border-slate-600 dark:bg-gray-700 dark:text-white dark:placeholder-slate-500 dark:focus:border-slate-400 dark:focus:ring-slate-400"
                placeholder="••••••••"
              />
            </div>
            <div>
              <span className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Role
              </span>
              <div className="mt-3 flex gap-6">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="role"
                    value="Student"
                    checked={role === 'Student'}
                    onChange={() => setRole('Student')}
                    className="h-4 w-4 border-slate-300 text-slate-900 focus:ring-slate-900 dark:border-slate-600 dark:bg-gray-700 dark:text-white dark:focus:ring-slate-400"
                  />
                  <span className="text-slate-700 dark:text-slate-300">Student</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="role"
                    value="Mentor"
                    checked={role === 'Mentor'}
                    onChange={() => setRole('Mentor')}
                    className="h-4 w-4 border-slate-300 text-slate-900 focus:ring-slate-900 dark:border-slate-600 dark:bg-gray-700 dark:text-white dark:focus:ring-slate-400"
                  />
                  <span className="text-slate-700 dark:text-slate-300">Mentor</span>
                </label>
              </div>
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200 dark:focus:ring-white dark:focus:ring-offset-gray-800"
            >
              {isLoading ? 'Creating account…' : 'Create Account'}
            </button>
          </form>
          <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">
            Already have an account?{' '}
            <Link
              to="/login"
              className="font-medium text-slate-900 underline transition hover:text-slate-700 dark:text-white dark:hover:text-slate-300"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
      </div>
    </div>
  );
}
