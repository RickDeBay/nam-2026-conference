# Swap one session for another on My Agenda

## What this changes
`/my-agenda` stops being a placeholder. It lists the signed-in attendee's sessions grouped by day and time slot, seats and waitlist places marked apart. Each row has an **Other options** control that opens the other sessions starting in that slot (same day, same start), each with a **Swap** button. Swap gives up the current seat or place and takes the chosen session (a seat, or a waitlist place if it is full, and the page says so). A session that has ended has a disabled Swap. A booked-hours stat counts confirmed seats only, with waitlisted time in its `note`.

## Where
- `src/lib/store.jsx` — new `swapSeat(fromId, toSession)` exposed on `useConference()`: refuses (toast) if `hasEnded(toSession, clock)` before touching anything, then `api.releaseSeat` then `api.reserveSeat` (clock passed), `applySeatState` on both responses, toast naming a promotion, a waitlist place or a plain swap. Same shape as `resolveConflict`; no refetch.
- `src/pages/MyAgendaPage.jsx` — replace the placeholder: `api.getSchedule(currentUser.id)` once for the day structure, re-filter each day through `reservationFor(s.id)` and recompute `totalMinutes`/`waitlistedMinutes` client-side (drop empty days, group by `startsAt`); `SessionCard variant="row"`, `Stat note=` for hours. Other options: `api.getSessions({ day })`, filter `startsAt === row.startsAt && id !== row.id`, fetched on first open. Test ids: `agenda-day`, `agenda-slot`, `agenda-row`, `other-options`, `swap-option`, `swap-waitlist-note`, `agenda-booked-hours`.
- `tests/helpers.js` — new lane `'agenda.swap'` (desktop jonas day 1, mobile andy day 1; builder greps the table for a free user+day pair first).
- `tests/agenda-swap.spec.js` — lane + `bookableFor` to book via API, `momentOn` to pin the clock, `shotForPR`; replaces `tests/home.spec.js` "My Agenda is a blank canvas" (nav, `/my-plan` redirect kept, placeholder assertion removed).
- Docs: `context/engineering-context/agenda.md` (page no longer a placeholder, front matter and "Where to change"), `CLAUDE.md` (My Agenda bullets in "Deliberately unbuilt" and "There is exactly one action"), `context/engineering-context/seats.md` (swapSeat).

## How it will be proved
| Done when | Check | Layer |
| --- | --- | --- |
| Lists seats and waitlist places by day and slot | after booking one seat via the API, `agenda-slot` shows it grouped under its day with a seat marker; a waitlisted row shows a waitlist marker | spec |
| Other options shows exactly the other sessions in the slot | `swap-option` titles equal the `/api/sessions?day=` sessions with the same `startsAt`, minus the held one | spec |
| After Swap the new session is held, the old is not, old seat freed | row for the new session present, old gone; old session's `seatsTaken` drops by one via the API (promotion itself is `seats.test.js`'s rule) | spec |
| Swapping into a full session gives a waitlist place and says so | swap into a full session in the slot shows `swap-waitlist-note` and a waitlist marker | spec |
| An ended session cannot be swapped into | clock pinned after a morning slot; Swap for the attended-morning alternatives is disabled and the attendee's held seat is unchanged | spec |
| Hours count confirmed seats only, waitlist apart | `agenda-booked-hours` equals confirmed minutes from `/schedule`, its note shows the waitlisted minutes; a pure helper for the totals is unit-tested if extracted | spec / unit |
| Docs no longer say placeholder | `grep -rn "placeholder" CLAUDE.md context/engineering-context/agenda.md` finds no My Agenda placeholder claim (excluding `specs/`) | review |

## Decisions
- Swap is composed client-side (release, then reserve) like the conflict dialog, rather than a new atomic endpoint, so no API or rule changes — OK?
- Sessions that have ended stay listed under Other options with Swap disabled, rather than being hidden — OK?
- Other options includes every session starting in the slot, keynotes and socials too — OK?
- If the reserve half fails after the release (rare race), the attendee is told and left without the old seat, as the conflict dialog does today — OK?

## Out of scope
Cloning, suggestions beyond the slot, any server change.
