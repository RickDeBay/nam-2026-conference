# Find a curated agenda from Tinker, Tailor, Soldier or Spy

## What this changes
Four seeded curators (Tinker, Tailor, Soldier, Spy) each hold a full, confirmed-seat agenda across the four days. A new **Curated agendas** page (`/curated-agendas`) lists exactly those four, linked from the main nav and a Home quick link. `/curated-agendas/:id` shows one curator's sessions grouped by day, then time slot. Curators are attendees, not speakers, so `/speakers` is unchanged. Vocabulary: "Spy's agenda", "Curated agendas", never "track".

## Where
- `server/db.js` — `users` table: add `is_curator INTEGER NOT NULL DEFAULT 0` (line ~37 beside `ticket_tier`).
- `server/lib/query.js` — `toUser`: add `isCurator: !!row.is_curator` (camelCase boundary).
- `server/seed.js` — append four curators to `USERS` (ids 7–10, no `Speaker` tier so `speakerIdFor` gives null, a non-"Equal Experts" company, `is_curator=1` set in `uStmt`). Add a new deterministic step after the sold-out and queue block (~line 760) and before the ratings loop: for each day, the keynote goes to all four; for each slot in `slotsByDay`, take the sessions that still have seats and are not in `fullSessions` or the near-full set, sort by id, and give curator `k` the session at index `(k + slotIndex) % n` so no session repeats; `bookSeat` them. No `rnd()` draws, so existing attendees' data does not move. The follows and queue loops (`users.forEach` ~line 775, `waiting` ~line 757) and `PLAN_SHAPE` loop skip curators (`users.filter((u) => !u.is_curator)`); the ratings loop keeps them, so Day 1 morning check-ins and ratings follow the existing rules. Portraits: none (`GeneratedAvatar` fallback).
- `server/routes/users.js` — `GET /api/curators` is awkward under `/users`, so add `usersRouter.get('/curators', …)` before `/:id`: curators in id order. The agenda itself reuses `GET /users/:id/schedule`.
- `src/lib/api.js` — `getCurators = () => api('/users/curators')`; the agenda page uses the existing `getSchedule(id)`.
- `src/pages/CuratedAgendasPage.jsx` (list, `SectionHeader` "Curated agendas", cards `data-testid="curator-card"`) and `CuratorAgendaPage.jsx` (`SectionHeader` "<Name>'s agenda"; per day `data-testid="curator-day"`, per slot `data-testid="curator-slot"`, session links). Count confirmed seats only. Routes in `src/App.jsx` beside `speakers`.
- `src/components/Layout.jsx` — `NAV`: add `{ to: '/curated-agendas', label: 'Curated agendas', icon: 'ticket' }`.
- `src/pages/HomePage.jsx` — `LINKS`: add a Curated agendas entry (static, nothing personal).
- `src/components/UserSwitcher.jsx` — no change: its `HOST_COMPANY` filter already hides curators.
- Tests: `tests/api/seed.test.js` (new `describe('Curators')`, `startApi()` harness); `tests/curated-agendas.spec.js` (new; `visit`, `laneFor` not needed, the page only reads); update `tests/home.spec.js` (link count 5 to 6) and add the route to `ROUTES` in `tests/smoke.spec.js`.
- Docs: `context/engineering-context/seed.md` (curators table, no-overlap rule, no PRNG draws, exclusion from follows/queues), `context/product-context/user-personas.md` (the curated-agenda persona), `CLAUDE.md` (the rules: curators are attendees not speakers, agendas disjoint except keynotes/socials, "curated agenda" never "track"), plus `ui.md` (page, nav, Home link), `data-model.md` (`is_curator`), `testing.md` if ids change.

## How it will be proved
| Done when | Check | Layer |
| --- | --- | --- |
| Lists exactly the four, from nav and Home | `/users/curators` names equal Tinker, Tailor, Soldier, Spy; spec clicks the nav link and the Home link, expects four `curator-card`s | API + spec |
| Sessions grouped by day and slot | spec opens a curator: `curator-day` count 4, each with `curator-slot`s, one session per slot; API: `/users/:id/schedule` has a confirmed session on every day, no clashes | spec + API |
| No shared session except keynote/social | seed test: every non-keynote, non-Social session id appears in at most one curator's reservations, and each curator has no two seats in one slot | API |
| Not on `/speakers`; seed deterministic | `/speakers` names exclude the curators and each curator has `speakerId` null; two `startApi()` seeds under the same `ORBIT_START_DATE` give identical curator reservations | API |
| Documented | `npm test` context unit test (`tests/unit/context.test.js`) passes; reviewer reads the three docs | unit |

## Decisions
- Hide the curators from the attendee switcher (they are readers' guides, not people to sign in as), via their company not being the host's — OK?
- Where a slot has fewer than four sessions with seats left after the sold-out step, a curator may skip that slot rather than join a waitlist — OK?
- Socials are left off the curators' agendas (the ticket says they "may" appear); only keynotes are shared — OK?
- Mark curators with a new `is_curator` column rather than a name list or a hidden tier — OK?

## Out of scope
Cloning a curator's agenda, swapping sessions, showing picked-by badges on session cards.
