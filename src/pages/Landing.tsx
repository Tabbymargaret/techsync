import { Link } from 'react-router-dom';
import NavBar from '../components/NavBar';

export default function Landing() {
  return (
    <div className="min-h-screen bg-slate-50">
      <NavBar />

      <main className="flex min-h-screen flex-col items-center justify-center px-6 pt-16">
        <section className="mx-auto max-w-3xl text-center">
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl md:text-6xl">
            Mentorship that shapes your future
          </h1>
          <p className="mt-6 text-lg text-slate-600 sm:text-xl">
            Connect with mentors who get it. TechSync gives you a{' '}
            <span className="font-semibold text-slate-800">
              structured 3–6 month Pairing Lifecycle
            </span>
            —so progress is real, not random.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              to="/register"
              className="rounded-xl bg-slate-900 px-6 py-3.5 text-base font-semibold text-white shadow-lg transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2"
            >
              Join as Student
            </Link>
            <Link
              to="/register"
              className="rounded-xl border-2 border-slate-900 bg-transparent px-6 py-3.5 text-base font-semibold text-slate-900 transition hover:bg-slate-900 hover:text-white focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2"
            >
              Join as Mentor
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
