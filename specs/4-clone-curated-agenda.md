# Clone a curated agenda into your own

## What this changes
On a curator's page (`/curated-agendas/:id`, from #3) an attendee with an empty agenda (no seats, no waitlist places) sees **Clone this agenda**. One click takes a seat in each of that curator's sessions that has not ended, or a waitlist place where the room is full, in one transaction with the clock from the client. A summary then lists seats taken, sessions waitlisted and sessions skipped because they ended. Each curator can be cloned by at most `ceil(attendees / curators)` attendees (attendees exclude curators: 8 seeded, 4 curators gives 2); at the cap the curator shows **Full** on the list and the page, which can still be viewed, and the API refuses a clone. Each attendee can clone one curator, ever.

## Where
Names `is_curator`, `toUser`, the curator pages and `GET /users/curators` come from #3 (this branch builds on it); open them first.
- `server/db.js` — new table `agenda_clones (user_id PRIMARY KEY REFERENCES users ON DELETE CASCADE, curator_id REFERENCES users, created_at)` beside `reservations`; add `DROP TABLE IF EXISTS agenda_clones` before `users` in the reset list (~line 275).
- `server/lib/clone.js` (new, beside `seats.js`) — `cloneCap()` = `ceil(non-curator users / curators)`; `curatorStandings()` gives per curator `{ cloneCount, cloneCap, isFull }`; `cloneAgenda(userId, curatorId, now)` as `db.transaction`: unknown or non-curator target returns `null` (404); then `rejected` of `'not-empty'` (any reservation row), `'already-cloned'` (row in `agenda_clones`), `'curator-full'`; else for the curator's confirmed sessions by day and start, skip those over (same test as `reserveSeat` step 3, only when `now.day` and `now.time` are sent), call `reserveSeat` for the rest, record the clone. Returns `{ curatorId, seats, waitlisted, skipped }` (each `[{ id, title }]`) plus `states` (the `seatState` of each booked session). Every row mapped in `server/lib/query.js` style (camelCase).
- `server/routes/users.js` — `POST /:id/clone/:curatorId` body `{day,time}`: 404 unknown user, 404 not a curator, **409** with `{ rejected }` when refused; `GET /curators` (from #3) adds `cloneCount`, `cloneCap`, `isFull` from `curatorStandings()`.
- `server/seed.js` — append two empty-agenda attendees (ids 11, 12: "Priya Raman", "Tomas Berg", hidden-from-switcher company, no plan, follows or queue; skipped by the `PLAN_SHAPE`/follows loops like curators, no `rnd()` draws), so a browser test has attendees whose agenda is truly empty (every seeded attendee holds seats).
- `src/lib/api.js` — `cloneAgenda = (userId, curatorId, now) => api(`/users/${userId}/clone/${curatorId}`, { method: 'POST', body: JSON.stringify(now ?? {}) })` (the only `fetch` caller).
- `src/lib/store.jsx` — `cloneAgenda(curatorId)`: calls the api with `clock`, `applySeatState` for each of `states`, toasts a refusal (`not-empty`, `already-cloned`, `curator-full`), returns the summary; exposed in `value`. Never refetch.
- `src/pages/CuratorAgendaPage.jsx` (from #3) — `data-testid="clone-agenda"` button only when `reservations.size === 0` and the curator is not full; `data-testid="curator-full"` badge when full; after a clone `data-testid="clone-summary"` with `clone-seats`, `clone-waitlisted`, `clone-skipped` (counts plus titles, "waitlisted" and "skipped" never folded into seats). `CuratedAgendasPage.jsx` cards show the same Full badge.
- Tests: `tests/api/clone.test.js` (new, `startApi()` from `tests/api/harness.js`; clearing a seeded attendee with `clearAgenda` or `DELETE` reservations); `tests/curated-clone.spec.js` (new, `visit(page, path, { as, at })`, `momentOn(0, '10:30')`, `laneFor('clone.ui', testInfo)`); `tests/helpers.js` — `ATTENDEES.priya: 11, tomas: 12`, `LANES['clone.ui']` (desktop priya, mobile tomas; they own the whole agenda, no other lane uses them), `tests/smoke.spec.js` and `tests/api/seed.test.js` counts of users if they assert eight.
- `src/components/UserSwitcher.jsx` — no change; the host-company filter hides the fixtures.
- Docs: `CLAUDE.md` (new "Cloning a curated agenda" rules: cap formula, one clone per attendee, empty-agenda rule, summary), `context/engineering-context/seats.md` (route, `cloneAgenda`, invariants), `seed.md` (the two attendees), `data-model.md` (`agenda_clones`), `ui.md` (page changes), `testing.md` (the `clone.ui` lane).

## How it will be proved
| Done when | Check | Layer |
| --- | --- | --- |
| Clone from empty books every not-yet-ended session, as seat or waitlist | API: fill one curator session to capacity, attendee 11 clones with a pinned `now`; `schedule` holds every curator session that has not ended, the full one as `waitlisted`, `seats`+`waitlisted`+`skipped` equals the curator's session count | API |
| Button not offered with a seat or waitlist place | spec: Jonas (seeded seats) on a curator page has no `clone-agenda`; API: clone with any reservation returns 409 `not-empty` | spec + API |
| Summary lists seats, waitlisted, skipped | spec: priya/tomas (pinned 10:30 day 1) click `clone-agenda`, `clone-summary` shows the three counts, skipped above 0, and the button is gone | spec |
| Curator at cap shows full and API refuses | API: with cap 2, two attendees clone Spy, `GET /users/curators` shows Spy `isFull`, a third clone is 409 `curator-full`, the agenda is still readable | API |
| One clone per attendee | API: after cloning Tinker, release everything and clone Tailor: 409 `already-cloned` | API |
| Rules documented | `npm test` context unit test passes; reviewer reads the `CLAUDE.md` and `seats.md` sections | unit |

## Decisions
- Cap counts attendees as every non-curator user, including the two new empty-agenda fixtures (8, cap 2) — OK?
- Add two hidden seeded attendees (Priya, Tomas) so the browser test has an empty agenda, rather than clearing a seeded attendee's plan other lanes depend on — OK?
- "Full" on the list and page is proved at the API only; no browser test fills a curator, since that would consume clone slots shared across projects — OK?
- A refusal after the button was shown (for example `already-cloned` once an attendee has released everything) is a toast, not a hidden button, since one clone is remembered on the server only — OK?
- A clone with no clock sent skips nothing, like `reserveSeat`; the UI always sends it — OK?

## Out of scope
Swapping sessions afterwards, picked-by badges on session cards, any "My Agenda" or Home use of the clone.
