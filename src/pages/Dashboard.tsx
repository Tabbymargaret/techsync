import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Calendar, Settings, type LucideIcon } from 'lucide-react';
import Navbar from '../components/NavBar.tsx';
import StudentDashboard from './StudentDashboard.tsx';

type StoredUser = {
  full_name?: string;
  role?: string;
};

type DashboardCard = {
  title: string;
  description: string;
  icon?: LucideIcon;
};

const STORAGE_KEY = 'techsync_user';

export default function Dashboard() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('');
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      navigate('/login', { replace: true });
      return;
    }
    try {
      const data: StoredUser = JSON.parse(stored);
      const name = data.full_name ?? '';
      const userRole = data.role ?? '';
      if (!name || !userRole) {
        navigate('/login', { replace: true });
        return;
      }
      setFullName(name);
      setRole(userRole);
    } catch {
      navigate('/login', { replace: true });
      return;
    }
    setIsReady(true);
  }, [navigate]);

  function handleLogout() {
    localStorage.removeItem(STORAGE_KEY);
    navigate('/login', { replace: true });
  }

  if (!isReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-gray-900">
        <p className="text-slate-500 dark:text-slate-400">Loading…</p>
      </div>
    );
  }

  const isStudent = role.toLowerCase() === 'student';

  const studentCards: DashboardCard[] = [
    {
      title: 'Upcoming Sessions',
      description: 'View your scheduled mentorship meetings.',
      icon: Calendar,
    },
    { title: 'My Milestones', description: 'Track your progress.' },
  ];

  const mentorCards: DashboardCard[] = [
    { title: 'Pending Requests', description: 'Review student requests.' },
    { title: 'My Students', description: 'Manage your pairings.' },
  ];

  const cards = isStudent ? studentCards : mentorCards;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-900">
      <Navbar onLogout={handleLogout} />
      <div className="px-4 pt-24 pb-12">
        <div className="mx-auto max-w-6xl">
          <div className="mb-10 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
                Welcome back, {fullName}
              </h1>
              <span className="inline-flex rounded-full bg-slate-200 px-3 py-1 text-sm font-medium text-slate-800 dark:bg-slate-600 dark:text-slate-200">
                {role}
              </span>
            </div>
            <Link
              to="/profile"
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
            >
              <Settings className="h-4 w-4 shrink-0 text-white dark:text-slate-900" aria-hidden />
              Edit Profile
            </Link>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:gap-8">
            {cards.map((card) => {
              const CardIcon = card.icon;
              return (
                <div
                  key={card.title}
                  className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition dark:border-slate-700 dark:bg-gray-800"
                >
                  {CardIcon && (
                    <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-700/80">
                      <CardIcon
                        className="h-5 w-5 text-slate-700 dark:text-slate-200"
                        aria-hidden
                      />
                    </div>
                  )}
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                    {card.title}
                  </h2>
                  <p className="mt-2 text-slate-600 dark:text-slate-400">
                    {card.description}
                  </p>
                </div>
              );
            })}
          </div>

          {isStudent && (
            <div className="mt-12">
              <StudentDashboard />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
