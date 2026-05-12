# TechSync — Project context (for Gemini / external assistants)

Use this file to understand **where the codebase stands today**. It lives at **`docs/CONTEXT.md`**. It describes the **production app only**: there is **no** `prototypes` folder, **no** `/prototypes` route, and **no** dedicated UI-kit layer under `components/ui`.

---

## One-line summary

**TechSync** is a **student–mentor matching** web app: users sign up with a role (**Student** or **Mentor**), students maintain a **tech stack**, browse mentors with **match scores**, and send **mentorship requests** stored in Supabase. Auth is **Supabase Auth**; app-specific user rows live in Postgres and are mirrored in **`localStorage`** under the key **`techsync_user`**.

---

## Stack

| Layer | Choice |
|--------|--------|
| Build | Vite 7 |
| UI | React 19, React Router 7 |
| Styling | Tailwind CSS 4 (`@import "tailwindcss"` in `src/index.css`, Vite plugin) |
| Dark mode | Class-based: `@custom-variant dark` on `.dark` / descendants |
| Icons | `lucide-react` |
| Backend | Supabase (`@supabase/supabase-js`) — `src/lib/supabase.ts` |
| Email (optional) | EmailJS inside `MentorCard` when a request is sent |
| Types | `src/types/database.types.ts` — Postgres/Supabase table shapes |

Font: **Plus Jakarta Sans** (see `src/index.css`).

---

## Repository layout (source)

```
src/
  App.tsx                 # Route table
  main.tsx
  index.css
  components/
    NavBar.tsx            # Fixed top nav + ThemeToggle + Login/Logout
    ProtectedRoute.tsx    # Auth gate + optional role allowlist
    ThemeToggle.tsx
    MentorCard.tsx        # Mentor tile, match %, request button, EmailJS
  pages/
    Landing.tsx
    Login.tsx
    Register.tsx
    DashboardRedirect.tsx
    StudentDashboard.tsx
    MentorDashboard.tsx
    Profile.tsx
    MentorsDirectory.tsx
  lib/
    supabase.ts
    dashboardPath.ts      # Role → route; reads techsync_user from localStorage
    mentors.ts            # Display name + calculateMatchScore( studentStack, mentorStack )
  types/
    database.types.ts     # Database-generated TypeScript types
```

There is **no** `src/app/prototypes/` directory and **no** `PrototypesGallery` page or `/prototypes` route—the product tree is pages + components only unless you add new folders yourself.

---

## Routing (`src/App.tsx`)

| Path | Guard | Page |
|------|--------|------|
| `/` | — | `Landing` |
| `/login` | — | `Login` |
| `/register` | — | `Register` |
| `/dashboard` | Logged in (`ProtectedRoute`) | `DashboardRedirect` |
| `/profile` | Logged in | `Profile` |
| `/mentors` | Logged in | `MentorsDirectory` |
| `/mentor-dashboard` | Logged in + role **mentor** | `MentorDashboard` |
| `/student-dashboard` | Logged in + role **student** | `StudentDashboard` |
| `*` | — | Redirect to `/` |

**`ProtectedRoute`** (`src/components/ProtectedRoute.tsx`): if no valid role in storage → `/login`. If `allowedRoles` is set and the user’s role is not allowed → redirect to their dashboard from `dashboardPathFromStoredUser()`.

**Role normalization** (`src/lib/dashboardPath.ts`): `getStoredUserRole()` returns lowercase `'mentor' | 'student' | null` after reading `techsync_user.role`.

---

## Auth and session model (important)

1. **Supabase Auth** — `Login` / `Register` use `signInWithPassword` / `signUp`.
2. **Public `users` table** — On register, a row is inserted (see `Register.tsx`) with **`user_id`** aligned to the auth user id, plus `full_name`, `email`, `role`, `password_hash` (often empty string placeholder), etc.
3. **`localStorage`** key **`techsync_user`** — Holds a JSON user object (at least `user_id`, `role`, often `tech_stack`, `email`, …). Used by `ProtectedRoute`, dashboards, and profile flows. **Logout** clears it (and may call `supabase.auth.signOut()` where implemented).

Third-party assistants should assume **both** Supabase session **and** `techsync_user` matter for “who is logged in” in the UI.

---

## Core product flows

- **Profile (`Profile.tsx`)**  
  - Loads `users` row for `tech_stack`.  
  - Skills are chosen from a **fixed catalog** `STANDARD_SKILLS` (no arbitrary strings).  
  - Saves with `supabase.from('users').update({ tech_stack })`.

- **Mentors directory & student home**  
  - Fetches mentors: `users` where `role` is Mentor (see `MentorsDirectory.tsx`, `StudentDashboard.tsx` — note casing in DB queries may be `'Mentor'` in some places).  
  - **Match score**: `calculateMatchScore` in `lib/mentors.ts` compares student vs mentor `tech_stack` arrays; UI shows a percentage-style badge on cards.

- **Mentorship request**  
  - `MentorCard` / `insertMentorshipRequest` inserts into **`mentorship_pairing`** with `student_id`, `mentor_id`, `status` (e.g. `'Pending'`).  
  - App logic treats **pending** and **accepted** pairings as “active slot” and can gray out other requests.  
  - **EmailJS** may fire after a successful insert (service/template/public key are in `MentorCard.tsx`).

- **Mentor dashboard / student dashboard**  
  - Separate pages; role-gated. Implement details in respective files (pairing management, cancel flow uses `status: 'Cancelled'` update in student path where present).

---

## Database (Supabase / Postgres) — tables in `database.types.ts`

Present in types (public schema):

- **`users`** — `user_id`, `full_name`, `email`, `role`, `tech_stack`, `password_hash`, `created_at`
- **`profiles`** — `profile_id`, `user_id`, `bio`, `github_url`, `max_capacity`, …
- **`skills`** — `skill_id`, `profile_id`, `skill_name`, `category`, `proficiency_level`, `weight_score`, …
- **`mentorship_pairing`** — `pairing_id`, `student_id`, `mentor_id`, `start_date`, `end_date`, `status`, `created_at`
- **`milestones`** — `milestone_id`, `pairing_id`, `title`, `description`, `due_date`, `progress_status`, …
- **`sessions`** — `session_id`, `pairing_id`, `scheduled_time`, `meeting_link`, `attendance_status`, …

**Reality check:** As of this snapshot, **`milestones` and `sessions` are typed but not wired to main React pages** (only mentioned in marketing copy on `Landing.tsx`). Pairing + profile + mentor discovery are the implemented UI surfaces.

---

## Styling and UX conventions

- Pages typically: `min-h-screen bg-slate-50 dark:bg-gray-900`, **`Navbar`** fixed at top, content with `pt-24` / horizontal padding.
- Buttons: mix of `rounded-lg`, `bg-slate-900` (primary), `bg-blue-600` (e.g. request CTA on cards), borders `border-slate-200/300`.
- **No** shared `Layout.tsx`, **no** `components/ui/Button.tsx` / `Card.tsx` in this repo.

---

## Scripts

- `npm run dev` — Vite dev server  
- `npm run build` — `tsc -b && vite build`  
- `npm run lint` — ESLint  

---

## Intentional omissions (do not assume they exist)

- No **`src/app/prototypes/`** directory  
- No prototype gallery route  
- No design-system-only component library folder  

---

## Suggested prompts for Gemini when editing this repo

- “Respect `techsync_user` in localStorage and `getStoredUserRole()` for guards.”  
- “Use `database.types.ts` for Supabase row/insert/update shapes.”  
- “Match existing Tailwind patterns in `Login.tsx` / `Profile.tsx` / `MentorCard.tsx`.”  
- “Do not introduce a prototypes folder unless the human explicitly asks.”

---

*Snapshot of the TechSync implementation state. Path: **`docs/CONTEXT.md`**. Update this file when major architecture or routes change.*
