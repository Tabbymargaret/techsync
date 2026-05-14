import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { HelpCircle, Search, X } from 'lucide-react';

type CategoryId = 'account' | 'mentorship' | 'milestones' | 'sync';

type GuideBlock = {
  id: string;
  title: string;
  badge?: string;
  searchBlob: string;
  body: ReactNode;
};

const CATEGORIES: { id: CategoryId; label: string; description: string }[] = [
  {
    id: 'account',
    label: 'Account',
    description: 'Sign-in, profile, and roles',
  },
  {
    id: 'mentorship',
    label: 'Mentorship',
    description: 'Matching, requests, and the hub',
  },
  {
    id: 'milestones',
    label: 'Milestones',
    description: 'Evidence and mentor feedback',
  },
  {
    id: 'sync',
    label: 'Sync & meetings',
    description: 'Live session links',
  },
];

function InfoBadge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-sky-800 dark:border-sky-800/60 dark:bg-sky-950/50 dark:text-sky-200">
      {children}
    </span>
  );
}

function TipBadge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-violet-200 bg-violet-50 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-violet-800 dark:border-violet-800/60 dark:bg-violet-950/40 dark:text-violet-200">
      {children}
    </span>
  );
}

function buildBlocks(): Record<CategoryId, GuideBlock[]> {
  return {
    account: [
      {
        id: 'sign-in',
        title: 'Signing in',
        badge: 'Basics',
        searchBlob:
          'login sign in password email dashboard student mentor role session account register',
        body: (
          <div className="space-y-4">
            <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              Use the email and password you chose at registration. After login, you are sent to the
              dashboard that matches your role (student or mentor).
            </p>
            <div className="flex flex-wrap gap-2">
              <InfoBadge>Authenticated</InfoBadge>
              <TipBadge>Profile</TipBadge>
            </div>
            <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              Update your name, tech stack, and weekly availability from{' '}
              <strong className="text-slate-800 dark:text-slate-200">Profile</strong>. Students use
              tech stack for matching; mentors often publish when they are generally available for
              syncs.
            </p>
          </div>
        ),
      },
    ],
    mentorship: [
      {
        id: 'match-score',
        title: 'How match score works',
        badge: 'Matching',
        searchBlob:
          'match score percentage tech stack skills overlap student mentor directory top matches fifty 50 lowercase normalization',
        body: (
          <div className="space-y-4">
            <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              Each mentor card shows a <strong className="text-slate-800 dark:text-slate-200">match score</strong> comparing{' '}
              <strong className="text-slate-800 dark:text-slate-200">your tech stack</strong> to{' '}
              <strong className="text-slate-800 dark:text-slate-200">the mentor&apos;s tech stack</strong>
              . Skills are compared case-insensitively (for example React and react count as the same).
            </p>
            <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              <li>
                Count how many of <strong className="text-slate-800 dark:text-slate-200">your</strong> skills appear in the{' '}
                <strong className="text-slate-800 dark:text-slate-200">mentor&apos;s</strong> list (after normalizing case).
              </li>
              <li>
                <strong className="text-slate-800 dark:text-slate-200">Match score</strong> = (
                matching student skills ÷ <strong className="text-slate-800 dark:text-slate-200">your</strong> number of
                skills ) × 100, rounded to a whole percent. That way mentors with very long stacks are not penalized
                compared to students with smaller profiles.
              </li>
              <li>If you have no skills on your profile, the score is 0% (no division).</li>
            </ol>
            <div className="flex flex-wrap gap-2">
              <InfoBadge>Skill overlap</InfoBadge>
            </div>
          </div>
        ),
      },
      {
        id: 'requests-hub',
        title: 'Requests and the mentorship hub',
        badge: 'Workflow',
        searchBlob:
          'request mentorship pending accept decline active mentee student mentor hub timeline pairing cancel directory',
        body: (
          <div className="space-y-4">
            <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              Students send a <strong className="text-slate-800 dark:text-slate-200">mentorship request</strong> from the
              mentor directory or dashboard. While a request is pending or active, other mentors are
              usually blocked so you focus on one relationship at a time.
            </p>
            <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              Mentors accept or decline from the dashboard. After a pairing is active, both sides can
              open the shared <strong className="text-slate-800 dark:text-slate-200">mentorship hub</strong> for roadmap
              progress and meeting tools, and the full <strong className="text-slate-800 dark:text-slate-200">milestone timeline</strong>{' '}
              for detailed tasks.
            </p>
          </div>
        ),
      },
    ],
    milestones: [
      {
        id: 'evidence',
        title: 'Submitting evidence',
        badge: 'Students',
        searchBlob:
          'evidence url link github portfolio cv pdf add milestone submit review valid https http',
        body: (
          <div className="space-y-4">
            <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              On the milestone timeline, use <strong className="text-slate-800 dark:text-slate-200">Add evidence</strong> and
              paste a link to your work (for example a GitHub repo, Google Doc, or portfolio page).
            </p>
            <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              The app only accepts a <strong className="text-slate-800 dark:text-slate-200">valid URL</strong>: it must
              parse as <code className="rounded bg-slate-100 px-1 py-0.5 text-xs dark:bg-slate-800">http://</code> or{' '}
              <code className="rounded bg-slate-100 px-1 py-0.5 text-xs dark:bg-slate-800">https://</code>. If you omit
              the scheme, <strong className="text-slate-800 dark:text-slate-200">https://</strong> is added
              automatically when possible.
            </p>
            <div className="flex flex-wrap gap-2">
              <InfoBadge>Needs review</InfoBadge>
            </div>
            <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              Submitting sends the milestone to <strong className="text-slate-800 dark:text-slate-200">Needs review</strong> so
              your mentor can open the link and approve or request changes.
            </p>
          </div>
        ),
      },
      {
        id: 'request-changes',
        title: 'Request changes (mentors)',
        badge: 'Feedback',
        searchBlob:
          'request changes mentor approve review work feedback note student revise in progress evidence cleared',
        body: (
          <div className="space-y-4">
            <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              When a milestone is in <strong className="text-slate-800 dark:text-slate-200">Needs review</strong> and the
              student has submitted evidence, you can open <strong className="text-slate-800 dark:text-slate-200">Review work</strong>,{' '}
              <strong className="text-slate-800 dark:text-slate-200">Approve</strong>, or{' '}
              <strong className="text-slate-800 dark:text-slate-200">Request changes</strong>.
            </p>
            <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              <li>
                Click <strong className="text-slate-800 dark:text-slate-200">Request changes</strong> and describe what the
                student should fix or redo.
              </li>
              <li>
                Your message is saved as a <strong className="text-slate-800 dark:text-slate-200">mentor note</strong> on
                that milestone.
              </li>
              <li>
                Status returns to <strong className="text-slate-800 dark:text-slate-200">In progress</strong>; the previous
                evidence link is cleared so the student can submit a fresh URL after revising.
              </li>
              <li>The student reads the note, updates their work, and submits evidence again.</li>
            </ol>
            <div className="flex flex-wrap gap-2">
              <TipBadge>Iteration</TipBadge>
            </div>
          </div>
        ),
      },
    ],
    sync: [
      {
        id: 'live-sync',
        title: 'Live sync links',
        badge: 'Meetings',
        searchBlob:
          'meeting link zoom google meet teams webex https save join live sync mentor student validation url',
        body: (
          <div className="space-y-4">
            <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              In the mentorship hub, mentors can paste a session URL under{' '}
              <strong className="text-slate-800 dark:text-slate-200">Live sync setup</strong>. Only{' '}
              <strong className="text-slate-800 dark:text-slate-200">valid meeting URLs</strong> are accepted: the link
              must be a proper <code className="rounded bg-slate-100 px-1 py-0.5 text-xs dark:bg-slate-800">http(s)</code>{' '}
              address hosted on a supported provider (
              <strong className="text-slate-800 dark:text-slate-200">Google Meet, Zoom, Microsoft Teams,</strong> or{' '}
              <strong className="text-slate-800 dark:text-slate-200">Webex</strong>).
            </p>
            <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              If you forget <strong className="text-slate-800 dark:text-slate-200">https://</strong>, TechSync adds it when
              saving. Students see a prominent <strong className="text-slate-800 dark:text-slate-200">Join live sync session</strong>{' '}
              button when a link is present; updates can appear in near real time while the hub is
              open.
            </p>
            <div className="flex flex-wrap gap-2">
              <InfoBadge>Supported providers</InfoBadge>
            </div>
          </div>
        ),
      },
    ],
  };
}

function blockMatchesQuery(block: GuideBlock, query: string): boolean {
  if (!query) return true;
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    block.title.toLowerCase().includes(q) ||
    block.searchBlob.includes(q) ||
    (block.badge?.toLowerCase().includes(q) ?? false)
  );
}

export default function PlatformUserGuide() {
  const [open, setOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<CategoryId>('account');
  const [search, setSearch] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  const blocksByCategory = useMemo(() => buildBlocks(), []);

  const searchActive = search.trim().length > 0;

  const visibleContent = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) {
      return blocksByCategory[activeCategory].map((b) => ({ categoryId: activeCategory, block: b }));
    }
    const out: { categoryId: CategoryId; block: GuideBlock }[] = [];
    for (const cat of CATEGORIES) {
      for (const block of blocksByCategory[cat.id]) {
        if (blockMatchesQuery(block, q)) {
          out.push({ categoryId: cat.id, block });
        }
      }
    }
    return out;
  }, [activeCategory, blocksByCategory, search]);

  const close = useCallback(() => {
    setOpen(false);
    setSearch('');
  }, []);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => searchInputRef.current?.focus(), 50);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-[60] flex h-14 w-14 items-center justify-center rounded-full bg-slate-900 text-white shadow-lg ring-2 ring-white/10 transition hover:bg-slate-800 hover:shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 dark:bg-white dark:text-slate-900 dark:ring-slate-900/20 dark:hover:bg-slate-100"
        aria-label="Open platform user guide"
      >
        <HelpCircle className="h-7 w-7" aria-hidden />
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[2px] dark:bg-black/50"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div
            className="flex max-h-[min(90vh,880px)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
            role="dialog"
            aria-modal="true"
            aria-labelledby="platform-user-guide-title"
          >
            <header className="shrink-0 border-b border-slate-200 px-6 py-5 dark:border-slate-700 sm:px-8">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2
                      id="platform-user-guide-title"
                      className="text-xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-2xl"
                    >
                      Platform User Guide
                    </h2>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                      Docs
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Quick reference for TechSync — search topics or browse by section.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={close}
                  className="shrink-0 rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"
                  aria-label="Close user guide"
                >
                  <X className="h-5 w-5" aria-hidden />
                </button>
              </div>

              <div className="relative mt-5">
                <Search
                  className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                  aria-hidden
                />
                <input
                  ref={searchInputRef}
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search help topics…"
                  autoComplete="off"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 dark:border-slate-600 dark:bg-slate-800/80 dark:text-white dark:focus:bg-slate-900"
                />
              </div>
            </header>

            <div className="flex min-h-0 flex-1 flex-col md:flex-row">
              <nav
                className="shrink-0 border-b border-slate-200 bg-slate-50/80 px-3 py-4 dark:border-slate-700 dark:bg-slate-950/50 md:w-52 md:border-b-0 md:border-r"
                aria-label="Guide categories"
              >
                <p className="px-3 pb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Categories
                </p>
                <ul className="space-y-1">
                  {CATEGORIES.map((cat) => {
                    const isActive = !searchActive && activeCategory === cat.id;
                    return (
                      <li key={cat.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveCategory(cat.id);
                            if (searchActive) setSearch('');
                          }}
                          className={`flex w-full flex-col items-start rounded-lg px-3 py-2.5 text-left text-sm transition ${
                            isActive
                              ? 'bg-white font-semibold text-slate-900 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:text-white dark:ring-slate-600'
                              : 'text-slate-600 hover:bg-white/80 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/80 dark:hover:text-white'
                          }`}
                        >
                          <span>{cat.label}</span>
                          <span className="mt-0.5 text-[11px] font-normal leading-snug text-slate-400 dark:text-slate-500">
                            {cat.description}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </nav>

              <div className="min-h-0 flex-1 overflow-y-auto bg-white dark:bg-slate-900">
                <div className="mx-auto max-w-2xl px-6 py-8 sm:px-10 sm:py-10">
                  {searchActive && (
                    <p className="mb-8 text-sm text-slate-500 dark:text-slate-400">
                      Showing <strong className="text-slate-800 dark:text-slate-200">{visibleContent.length}</strong>{' '}
                      matching topic{visibleContent.length === 1 ? '' : 's'}.
                    </p>
                  )}

                  {!searchActive && (
                    <p className="mb-10 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                      {CATEGORIES.find((c) => c.id === activeCategory)?.description}.
                    </p>
                  )}

                  {visibleContent.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center dark:border-slate-700 dark:bg-slate-800/50">
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        No topics match “{search.trim()}”.
                      </p>
                      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                        Try another keyword or clear the search to browse a category.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-12">
                      {visibleContent.map(({ categoryId, block }) => {
                        const catLabel = CATEGORIES.find((c) => c.id === categoryId)?.label ?? '';
                        return (
                          <article
                            key={searchActive ? `${categoryId}-${block.id}` : block.id}
                            className="scroll-mt-4 border-b border-slate-100 pb-12 last:border-0 last:pb-0 dark:border-slate-800"
                          >
                            {searchActive ? (
                              <p className="mb-3">
                                <span className="inline-flex rounded-md bg-slate-100 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                                  {catLabel}
                                </span>
                              </p>
                            ) : null}
                            <div className="mb-4 flex flex-wrap items-center gap-2">
                              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                                {block.title}
                              </h3>
                              {block.badge ? (
                                <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                  {block.badge}
                                </span>
                              ) : null}
                            </div>
                            {block.body}
                          </article>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
