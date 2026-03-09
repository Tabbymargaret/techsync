import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/NavBar.tsx';

type StoredUser = {
  full_name?: string;
  role?: string;
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

  const studentCards = [
    { title: 'Find a Mentor', description: 'Browse and request mentors.' },
    { title: 'My Milestones', description: 'Track your progress.' },
  ];

  const mentorCards = [
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
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:gap-8">
            {cards.map((card) => (
              <div
                key={card.title}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition dark:border-slate-700 dark:bg-gray-800"
              >
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                  {card.title}
                </h2>
                <p className="mt-2 text-slate-600 dark:text-slate-400">
                  {card.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
