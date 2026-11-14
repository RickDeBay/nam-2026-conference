# Add an empty-agenda attendee to the user switcher for trying cloning
## What this changes
A reviewer opens the user switcher and sees one more attendee, Wren Okafor, with "no sessions yet" under the name. Picking Wren gives an empty My Agenda, so a curator's page at `/curated-agendas/:id` offers **Clone this agenda** with no console step. Priya Raman and Tomas Berg stay hidden. The clone cap rises from `ceil(8/4) = 2` to `ceil(9/4) = 3`, because Wren is a non-curator user.
## Where
- `server/seed.js` — append `['Wren Okafor', 'wren@orbitconf.dev', 'Product Reviewer', 'ORBIT Demo Desk', ...]` to `USERS` after Tomas (id 13, tier `Standard`, no `Speaker`, so no speaker link); add the name to `EMPTY_AGENDAS` (line ~609) so the `attendees` filter (~627) skips it: no plan, follows or queue, and no `rnd()` draws. No portrait file exists for `attendee-013`, so `GeneratedAvatar` is the fallback. Test in `tests/api/seed.test.js` (throwaway-DB API harness, `startApi()`).
- `src/components/UserSwitcher.jsx` — `choices` (line 27) lists `HOST_COMPANY` plus a new `DEMO_COMPANY = 'ORBIT Demo Desk'`, and the selected user as before. The row's second line (~line 107) reads `{company} · no sessions yet` when `agendaCount === 0`, else `N on agenda`. Test in `tests/switcher.spec.js` using `visit(page, '/', { as: ATTENDEES.jonas })` and `laneFor` is not needed: the test only reads and clicks, and books nothing.
- `server/lib/clone.js` — no change: `cloneCap()` already counts non-curators; the cap becomes 3 by itself.
- `tests/api/clone.test.js` — header comment and the cap test (lines 83-100): Spy now has to be cloned three times (12, 3, 5) to reach `[3, 3, true]`, and the refused clone uses attendee 6 (cleared with `clearAgenda(api, 6)`), not 5. Tinker's `isFull` stays false. Uses the file's own `clone` and `clearAgenda` helpers.
- `tests/api/seed.test.js` — new tests under "Seeded attendees": user 13 is Wren, holds no reservation, and the cap is 3 for 9 non-curators.
- `tests/switcher.spec.js` — a spec that reads only: the switcher lists Wren with "no sessions yet" and not Priya or Tomas; clicking Wren's row, then opening `/curated-agendas/7`, shows `clone-agenda` (never clicked, so Wren stays empty).
- `context/engineering-context/seed.md` (USERS line 61 and the empty-agenda paragraph ~104: ids, "8 non-curators" becomes 9, what Wren is for), `context/engineering-context/ui.md` (switcher paragraph ~140: the demo company and the "no sessions yet" row), `context/engineering-context/seats.md` (cap example, if it names 8), `context/product-context/user-personas.md` (a persona for the newcomer with an empty agenda, seeded as Wren Okafor).
## How it will be proved
| Done when | Check | Layer |
| --- | --- | --- |
| Switcher lists the new attendee, empty count | switcher spec: option /Wren/ visible with "no sessions yet"; after clicking it, the row for Wren reads the same | spec |
| Wren sees **Clone this agenda** with no console step | switcher spec: select Wren through the switcher, open `/curated-agendas/7`, `clone-agenda` is visible | spec |
| Priya and Tomas still hidden | switcher spec: no option named /Priya/ or /Tomas/ while Jonas is selected (holds today, guards the new filter) | spec |
| Seed deterministic, seed and cap tests reflect the new count | seed.test: user 13 is Wren with zero reservations, follows and waitlist; `/users/curators` reports `cloneCap` 3. clone.test: Spy fills at 3 clones | API |
| `seed.md` and `user-personas.md` describe Wren | a docs-check by reading in review; `node scripts/context.mjs for server/seed.js` names the docs | review |
## Decisions
The criterion "lists the new attendee" cannot hold today because the switcher shows only Equal Experts hosts, so no seed change alone would show Wren.
## Out of scope
Priya and Tomas fixtures, the clone rules, and My Agenda itself.
