import { Link } from 'react-router-dom';
import ThemeToggle from './ThemeToggle';

type NavBarProps = {
  onLogout?: () => void;
};

export default function Navbar({ onLogout }: NavBarProps) {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur-sm dark:border-slate-700/80 dark:bg-slate-900/90">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link
          to="/"
          className="text-xl font-semibold tracking-tight text-slate-900 transition hover:text-slate-700 dark:text-white dark:hover:text-slate-200"
        >
          TechSync
        </Link>
        // Add this next to your 'Home' or 'Mentors' links
<a href="/dashboard" className="text-gray-600 hover:text-blue-600">
  Dashboard
</a>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {onLogout ? (
            <button
              type="button"
              onClick={onLogout}
              className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
            >
              Logout
            </button>
          ) : (
            <Link
              to="/login"
              className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
            >
              Login
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
