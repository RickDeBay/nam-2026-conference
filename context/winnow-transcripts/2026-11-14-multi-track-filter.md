# Choose several tracks on the Schedule page

- **Title:** Choose several tracks on the Schedule page
- **Date:** Unknown — the transcript carries no date (processed 2026-11-14)
- **Participants:** Unknown — one unnamed speaker
- **Source:** `context/winnow-transcripts/demo-transcript.txt`

## Tickets raised

- [#1 Choose several tracks on the Schedule page](https://github.com/RickDeBay/nam-2026-conference/issues/1)

## Context updated

None. No rule changed; `context/engineering-context/schedule.md` is updated
in the pull request that builds #1, once the code exists.

## Set aside

- Making the topic, level, format and venue filters multi-select — not asked
  for; they stay single-select.
- Multi-track filtering on the Speakers page — out of scope.
- Showing the grid view for a track selection — the grid only makes sense with
  whole rooms visible, so any track selection keeps the list.
- "So let's take a look at the website" — introductory.
- "philtre" — a transcription slip for "filter".

## Q&A

- **Which page is "the search function"?** The Schedule page (`/schedule`) —
  its filter rail, where the track pills sit next to the search box.
- **Tracks only, or every filter multi-select?** Tracks only.
- **How should picking tracks behave?** Each track pill toggles; sessions from
  any selected track are shown; All tracks clears the selection; deselecting the
  last track returns to All; existing single-track links keep working.
- **Does a multi-track selection still force the list view?** Yes, as a single
  track does today.
