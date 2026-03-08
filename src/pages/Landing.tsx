import { Link } from 'react-router-dom';
import NavBar from '../components/NavBar';

const HOW_IT_WORKS = [
  {
    step: '01',
    title: 'Apply',
    description:
      'Sign up as a student or mentor. Share your goals, skills, and availability so we can find the right fit.',
  },
  {
    step: '02',
    title: 'Get Matched',
    description:
      'Our custom matching algorithm pairs you based on skills, goals, and capacity—so every pairing has real potential.',
  },
  {
    step: '03',
    title: 'Commit to a 3–6 Month Lifecycle',
    description:
      'Structured pairings with clear milestones and sessions. No endless browsing—just focused progress.',
  },
] as const;

const FEATURES = [
  {
    title: 'Structured pairings that last',
    description:
      'Every mentorship runs on a defined 3–6 month lifecycle with milestones and scheduled sessions, so progress is measurable.',
    placeholderIcon: 'calendar',
  },
  {
    title: 'Matching that actually fits',
    description:
      'We use skill profiles, capacity, and goals to match students with mentors—not random browsing.',
    placeholderIcon: 'target',
  },
  {
    title: 'Milestones and sessions in one place',
    description:
      'Track progress, book sessions, and hit milestones without switching tools. Everything stays in TechSync.',
    placeholderIcon: 'layers',
  },
] as const;

function PlaceholderBlock({ icon }: { icon: string }) {
  const icons: Record<string, React.ReactNode> = {
    calendar: (
      <svg className="h-16 w-16 text-slate-400 dark:text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
      </svg>
    ),
    target: (
      <svg className="h-16 w-16 text-slate-400 dark:text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    layers: (
      <svg className="h-16 w-16 text-slate-400 dark:text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.429 9.75L2.25 12l4.179 2.25m0-4.5l5.571 3 5.571-3m-11.142 0L2.25 7.5 12 2.25l9.75 5.25-4.179 2.25m0 0L21.75 12l-4.179 2.25m0 0l4.179 2.25L12 21.75 2.25 16.5l4.179-2.25m11.142 0l-5.571 3-5.571-3" />
      </svg>
    ),
  };
  return (
    <div className="flex aspect-video w-full items-center justify-center rounded-2xl bg-slate-200/60 ring-1 ring-slate-200 dark:bg-slate-700/40 dark:ring-slate-600">
      {icons[icon] ?? icons.calendar}
    </div>
  );
}

export default function Landing() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-900">
      <NavBar />

      <main>
        {/* Hero */}
        <section className="flex min-h-[85vh] flex-col items-center justify-center px-6 pt-16">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-5xl md:text-6xl">
              Mentorship that shapes your future
            </h1>
            <p className="mt-6 text-lg text-slate-600 dark:text-slate-300 sm:text-xl">
              Connect with mentors who get it. TechSync gives you a{' '}
              <span className="font-semibold text-slate-800 dark:text-slate-100">
                structured 3–6 month Pairing Lifecycle
              </span>
              —so progress is real, not random.
            </p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <Link
                to="/register"
                className="rounded-xl bg-slate-900 px-6 py-3.5 text-base font-semibold text-white shadow-lg transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200 dark:focus:ring-white dark:focus:ring-offset-gray-900"
              >
                Join as Student
              </Link>
              <Link
                to="/register"
                className="rounded-xl border-2 border-slate-900 bg-transparent px-6 py-3.5 text-base font-semibold text-slate-900 transition hover:bg-slate-900 hover:text-white focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 dark:border-white dark:text-white dark:hover:bg-white dark:hover:text-slate-900 dark:focus:ring-white dark:focus:ring-offset-gray-900"
              >
                Join as Mentor
              </Link>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="border-t border-slate-200 bg-white px-6 py-20 dark:border-slate-700 dark:bg-gray-900 sm:py-24">
          <div className="mx-auto max-w-6xl">
            <h2 className="text-center text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
              How It Works
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-center text-slate-600 dark:text-slate-400">
              From sign-up to a committed pairing—simple steps, real structure.
            </p>
            <div className="mt-16 grid gap-12 sm:grid-cols-3 sm:gap-8">
              {HOW_IT_WORKS.map((item) => (
                <div key={item.step} className="relative text-center sm:text-left">
                  <span className="text-5xl font-bold text-slate-200 dark:text-slate-600 sm:text-6xl">
                    {item.step}
                  </span>
                  <h3 className="mt-2 text-xl font-semibold text-slate-900 dark:text-white">
                    {item.title}
                  </h3>
                  <p className="mt-3 text-slate-600 dark:text-slate-400">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="border-t border-slate-200 bg-slate-50 px-6 py-20 dark:border-slate-700 dark:bg-gray-800/50 sm:py-24">
          <div className="mx-auto max-w-6xl">
            <h2 className="text-center text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
              Features
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-center text-slate-600 dark:text-slate-400">
              Built for the way mentorship actually works.
            </p>
            <div className="mt-16 space-y-24">
              {FEATURES.map((feature, index) => (
                <div
                  key={feature.title}
                  className="grid gap-10 md:grid-cols-2 md:gap-16 md:items-center"
                >
                  <div
                    className={`flex flex-col justify-center ${index % 2 === 1 ? 'md:order-2' : ''}`}
                  >
                    <h3 className="text-2xl font-semibold text-slate-900 dark:text-white">
                      {feature.title}
                    </h3>
                    <p className="mt-4 text-slate-600 dark:text-slate-400">
                      {feature.description}
                    </p>
                  </div>
                  <div className={index % 2 === 1 ? 'md:order-1' : ''}>
                    <PlaceholderBlock icon={feature.placeholderIcon} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-slate-200 bg-white px-6 py-14 dark:border-slate-700 dark:bg-gray-900">
          <div className="mx-auto max-w-6xl">
            <div className="grid gap-10 sm:grid-cols-3">
              <div>
                <h4 className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Product
                </h4>
                <ul className="mt-4 space-y-3">
                  <li>
                    <Link to="/" className="text-slate-600 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
                      Features
                    </Link>
                  </li>
                  <li>
                    <Link to="/" className="text-slate-600 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
                      How It Works
                    </Link>
                  </li>
                  <li>
                    <Link to="/register" className="text-slate-600 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
                      Sign Up
                    </Link>
                  </li>
                </ul>
              </div>
              <div>
                <h4 className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Company
                </h4>
                <ul className="mt-4 space-y-3">
                  <li>
                    <Link to="/" className="text-slate-600 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
                      About
                    </Link>
                  </li>
                  <li>
                    <Link to="/" className="text-slate-600 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
                      Contact
                    </Link>
                  </li>
                </ul>
              </div>
              <div>
                <h4 className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Legal
                </h4>
                <ul className="mt-4 space-y-3">
                  <li>
                    <Link to="/" className="text-slate-600 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
                      Privacy Policy
                    </Link>
                  </li>
                  <li>
                    <Link to="/" className="text-slate-600 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
                      Terms of Service
                    </Link>
                  </li>
                </ul>
              </div>
            </div>
            <div className="mt-12 border-t border-slate-200 pt-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
              © {new Date().getFullYear()} TechSync. All rights reserved.
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
