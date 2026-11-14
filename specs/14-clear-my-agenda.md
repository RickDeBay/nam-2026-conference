# Clear my agenda in one step so I can start over from a curated agenda

## What this changes
My Agenda gets a **Clear my agenda** button (hidden while the agenda is empty). It opens a confirm dialog; confirming releases every seat and waitlist place the attendee holds, past sessions included, and cancelling changes nothing. Each released confirmed seat goes to whoever has waited longest. Clearing also forgets the attendee's clone, so they can clone a curated agenda again and that curator's clone count drops by one. Check-ins and ratings are untouched. The empty state after clearing links to Curated agendas as well as the schedule.

## Where
- `server/lib/seats.js` — new `clearAgenda(userId)`, a `db.transaction` that calls `releaseSeat` for each of the user's reservation rows (so promotion and `seats_taken` stay in one place) and returns `{ released: [{ sessionId, status }], states: [seatState…] }`; new prepared statement listing a user's reservations.
- `server/lib/clone.js` — export a `forgetClone(userId)` (`DELETE FROM agenda_clones WHERE user_id = ?`), called from `clearAgenda` inside the same transaction (seats.js imports clone.js already depends on seats.js, so put the delete statement in seats.js instead to avoid a cycle). Does not touch `check_ins` or `ratings`.
- `server/routes/users.js` — `DELETE /:id/reservations` (collection route, next to the existing item routes): 404 unknown user, else `clearAgenda`.
- `src/lib/api.js` — `clearAgenda(userId)`, the only `fetch` caller.
- `src/lib/store.jsx` — `clearAgenda()`: calls the api, `applySeatState` for each returned state, empties `reservations` for those sessions, toasts "Agenda cleared"; failure toasts and applies nothing. Exposed on `useConference()`.
- `src/pages/MyAgendaPage.jsx` — `clear-agenda` button (only when `days.length > 0`) opening a small confirm dialog modelled on `ConflictDialog` (`clear-confirm`, `clear-cancel`); empty-state `action` gains a `Button to="/curated-agendas"` ("Browse curated agendas").
- Docs: `CLAUDE.md` § Cloning ("One clone per attendee, ever" becomes one clone at a time, reset by clearing); `context/engineering-context/seats.md` (clearAgenda, route, store, clone section, testids); `agenda.md` (My Agenda paragraph).
- Tests: API in `tests/api/clear.test.js` (new, `startApi()` throwaway database, `days()`/`clearAgenda` helpers from `tests/api/harness.js`, same style as `clone.test.js`); browser in `tests/agenda-clear.spec.js` with a new lane `agenda.clear` in `tests/helpers.js` `LANES` (user and day not used by another lane, `lanes.test.js` checks), booking via `bookableFor` and the clock pinned with `momentOn`.

## How it will be proved
| Done when | Check | Layer |
| --- | --- | --- |
| Clearing leaves no seats or waitlist places, past sessions included | seeded attendee with a Day 1 morning seat plus a waitlist place: `DELETE /users/:id/reservations` then `GET /users/:id` has `reservations: []` | API |
| Cancel leaves the agenda unchanged | click Clear, click Cancel, rows and `agenda-booked-hours` unchanged | Playwright |
| Released seat goes to the longest waiter | fill a session, queue two users, clear the holder: first waiter confirmed, second still waitlisted, `seatsTaken` unchanged | API |
| Can clone again; curator's clone count drops by one | clone Priya (11) from Tinker, `cloneCount` +1, clear, `GET /users/curators` count back, second clone returns 200 not `already-cloned` | API |
| Check-ins and ratings survive | attendee with the seeded Day 1 check-in and rating clears; `checkIns` and `ratings` in `GET /users/:id` equal before | API |
| Button hidden when empty; empty state links to Curated agendas | `clear-agenda` count 0 for an empty attendee; after confirming, empty state has a link to `/curated-agendas` | Playwright |
| Confirming clears the UI | click Clear, confirm: no `agenda-row`, empty state shown | Playwright |
| Docs say one clone at a time | `tests/unit/context.test.js` keeps docs consistent; reviewed by reading the three files | unit / review |

## Decisions
None of the Done-when criteria already hold on main: there is no clear endpoint or button today.

## Out of scope
Per-day or per-session bulk removal, an undo for a clear, and changing the clone cap.
