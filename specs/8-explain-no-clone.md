# Say why cloning isn't offered when your agenda already has sessions

## What this changes
On a curator's agenda page, an attendee who already holds a seat or waitlist place no longer sees an empty gap where **Clone this agenda** would be. They see a line, "You already have sessions on your agenda. Cloning starts from an empty one.", with a link to My Agenda. An empty agenda still gets the button; a full curator still shows only its Full notice; after a clone the summary shows.

## Where
- `src/pages/CuratorAgendaPage.jsx` — the `summary ? <CloneSummary/> : reservations.size === 0 && !curator.isFull && (button)` branch: add a third arm, `!curator.isFull && reservations.size > 0`, rendering `<p data-testid="clone-unavailable">` with a `<Link to="/my-agenda">` on "My Agenda". `reservations` already holds seats and waitlist places (from `useConference()`); no store or API change.
- `tests/curated-clone.spec.js` — extend the existing test: the Jonas step (`ATTENDEES.jonas`, 15 seats, `momentOn(0, '10:30')` clock pin) asserts `clone-unavailable` is visible, links to `/my-agenda`, and `clone-agenda` is absent; the `lane.user` step asserts `clone-unavailable` is absent before cloning and after the summary shows. Add a second test that uses `visit(... as jonas, at)` with `page.route('**/api/curators', ...)` rewriting the curator to `isFull: true`, asserting `curator-full` shows and `clone-unavailable` does not. It books nothing, so it needs no lane.

## How it will be proved
| Done when | Check | Layer |
| --- | --- | --- |
| Seat or waitlist place sees the explanation, no button | Jonas on a curator page: `clone-unavailable` visible, `clone-agenda` count 0 | spec |
| Explanation links to `/my-agenda` | `clone-unavailable` link `href` is `/my-agenda` | spec |
| Empty agenda still sees the button, no explanation | `lane.user`: `clone-agenda` visible, `clone-unavailable` count 0 | spec |
| Full curator shows only its Full notice | Jonas with `/api/curators` stubbed `isFull: true`: `curator-full` visible, `clone-unavailable` count 0 | spec |
| After a clone the summary shows, not the explanation | after clicking clone: `clone-summary` visible, `clone-unavailable` count 0 (the agenda is no longer empty, so this guards the `summary` arm order) | spec |
| Covered by a spec, clock pinned | every visit passes `at` from `momentOn` | spec |

## Decisions
- Waitlist-only attendees are covered by the same `reservations.size > 0` check as seat holders, and the spec proves it with Jonas's seats only (no seeded attendee holds only a waitlist place) — OK?
- The full-curator case is proved by stubbing `/api/curators` in the browser rather than filling a real curator to its cap, which would change shared state — OK?
