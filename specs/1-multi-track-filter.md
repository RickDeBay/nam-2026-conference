# Choose several tracks on the Schedule page

## What this changes
The track pills in `/schedule`'s filter rail toggle in and out of a selection, and the list shows sessions from any selected track. **All** clears the selection; deselecting the last track returns to All. The selection is the URL's `?track=a,b` (one key, comma-separated), so reloads, shared links and old `?track=<slug>` links work. Any selected track still forces the list view and disables the grid tab. `GET /api/sessions?trackSlug=a,b` returns sessions in any of those tracks.

## Where
- `server/routes/sessions.js` — the `trackSlug` line in `GET /`: split on commas, drop blanks, `t.slug IN (?, ?)`; one value is the same query as today. Test in `tests/api/endpoints.test.js` (own `describe`, alongside `filtered()`): two slugs from `ids`/bootstrap return exactly the union of the two single-track results, and every row's `track.slug` is one of them.
- `src/pages/SchedulePage.jsx` — `filters.track` becomes the raw string, with a `selectedTracks` array derived by splitting on commas; the track pill `active` is `selectedTracks.includes(t.slug)`; click toggles that slug and writes the joined list through `set('track', …)`, which already deletes the key when empty (so deselecting the last returns to All); **All** is active when the list is empty. Add `aria-pressed` and `data-testid="track-<slug>"` / `track-all` to the pills. `BLOCKERS`, `activeKeys` and `getSessions({trackSlug})` already work off the string unchanged.
- `tests/schedule.spec.js` — new tests using `visit`, `waitForResults`, `conferenceDays()`, and the API's counts for `result-count`; read-only, so no seat lane. On mobile click `Filters` first (schedule.md Gotchas).
- `context/engineering-context/schedule.md` — note track is multi-select (the multi-value gotcha is already there).

## How it will be proved
| Done when | Check | Layer |
| --- | --- | --- |
| `GET /api/sessions` with several track slugs returns only those tracks | `trackSlug=a,b` equals the union of `a` and `b`, all rows in those tracks | API (`endpoints.test.js`) |
| Two tracks show exactly their sessions; count matches | click two pills, `result-count` equals API count for `trackSlug=a,b` and cards match | spec |
| Selected pills all active; clicking an active pill removes only that track | both `aria-pressed=true`; click one: it is false, the other true, count equals the other's API count | spec |
| All, or deselecting the last, shows every track | click All (and separately deselect the last): no `track=` in URL, count equals the unfiltered API count | spec |
| Reload / copied URL restores the selection | reload on `?track=a,b`: both pressed, same count | spec |
| Single `?track=<slug>` still filters to one | visit it: one pill pressed, count equals that track's API count | spec |
| Grid tab disabled and list shown with tracks selected | `view-grid` disabled, `grid-blocked-notice`/list visible, with two tracks | spec |

## Decisions
- Use a comma-separated `?track=a,b` (one URL key and API param, as schedule.md prescribes) rather than a repeated key — OK?
- Pill order in the URL follows click order, not the track list order — OK?

## Out of scope
Topic, level, format and venue filters stay single-select; Speakers page unchanged.
