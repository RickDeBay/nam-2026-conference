import { useEffect, useMemo, useState } from 'react';
import { useDocumentTitle } from '../lib/useDocumentTitle.js';
import { useConference, useFetch } from '../lib/store.jsx';
import * as api from '../lib/api.js';
import { hasEnded } from '../lib/clock.js';
import { agendaDays, dayLabel, hoursOf, time } from '../lib/format.js';
import { Button, EmptyState, ErrorState, SectionHeader, Skeleton, Stat } from '../components/ui.jsx';
import { SessionCard } from '../components/SessionCard.jsx';

/**
 * Everything you hold, by day and slot. The schedule payload gives the day
 * structure once; what is shown is re-filtered through the store, so a swap or
 * a removal shows at once and never waits for a refetch.
 */
export function MyAgendaPage() {
  useDocumentTitle('My Agenda');
  const { currentUser, currentUserId, reservationFor, clearAgenda } = useConference();
  const { data, loading, error, reload } = useFetch(() => api.getSchedule(currentUserId), [currentUserId]);
  // Sessions swapped into after the payload was fetched
  const [added, setAdded] = useState(() => new Map());
  // The row that was just swapped into a full room; it outlives the row it replaced
  const [waitNote, setWaitNote] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [clearing, setClearing] = useState(false);

  const days = useMemo(() => {
    const pool = new Map();
    for (const d of data?.days ?? []) for (const s of d.sessions) pool.set(s.id, s);
    for (const s of added.values()) pool.set(s.id, s);
    const byDay = Map.groupBy(pool.values(), (s) => s.day);
    return agendaDays([...byDay].map(([date, sessions]) => ({ date, sessions })), reservationFor);
  }, [data, added, reservationFor]);

  if (loading && !data) {
    return <div className="space-y-4"><SectionHeader eyebrow="Your conference" title="My Agenda" /><Skeleton className="h-40" /></div>;
  }
  if (error) return <ErrorState error={error} onRetry={reload} />;

  async function confirmClear() {
    setClearing(true);
    const ok = await clearAgenda();
    setClearing(false);
    if (ok) { setConfirming(false); setAdded(new Map()); setWaitNote(null); }
  }

  const booked = days.reduce((n, d) => n + d.totalMinutes, 0);
  const waitlisted = days.reduce((n, d) => n + d.waitlistedMinutes, 0);

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Your conference"
        title="My Agenda"
        description={currentUser ? `Seats and waitlist places held by ${currentUser.name}.` : undefined}
      />
      {days.length === 0 ? (
        <EmptyState
          icon="ticket"
          title="Nothing on your agenda yet"
          description="Add a session and it takes a seat here."
          action={(
            <div className="flex flex-wrap justify-center gap-2">
              <Button to="/curated-agendas" variant="primary" size="sm">Browse curated agendas</Button>
              <Button to="/schedule" size="sm">Browse the schedule</Button>
            </div>
          )}
        />
      ) : (
        <>
          <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="grid w-full max-w-xs">
            <Stat
              value={hoursOf(booked)}
              label="Hours booked"
              testId="agenda-booked-hours"
              note={waitlisted > 0 ? `+${hoursOf(waitlisted)} waitlisted` : null}
              noteTestId="agenda-booked-note"
            />
          </div>
            <Button size="sm" data-testid="clear-agenda" onClick={() => setConfirming(true)}>Clear my agenda</Button>
          </div>
          {days.map((day) => (
            <section key={day.date} data-testid="agenda-day" className="space-y-4">
              <h2 className="font-display text-xl">{dayLabel(day.date)}</h2>
              {day.slots.map((slot) => (
                <div key={slot.startsAt} data-testid="agenda-slot" className="space-y-2">
                  <div className="font-mono text-xs font-semibold text-muted">{time(slot.startsAt)}</div>
                  {slot.sessions.map((s) => (
                    <AgendaRow
                      key={s.id}
                      session={s}
                      note={waitNote?.id === s.id ? waitNote : null}
                      onSwapped={(to, state) => {
                        setAdded((m) => new Map(m).set(to.id, to));
                        setWaitNote(state.status === 'waitlisted' ? { id: to.id, position: state.waitlistPosition } : null);
                      }}
                    />
                  ))}
                </div>
              ))}
            </section>
          ))}
        </>
      )}
      {confirming && <ClearDialog busy={clearing} onConfirm={confirmClear} onCancel={() => setConfirming(false)} />}
    </div>
  );
}

/** Clearing gives up every seat and waitlist place, so it asks first. */
function ClearDialog({ busy, onConfirm, onCancel }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !busy) onCancel(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [busy, onCancel]);

  return (
    <div className="fixed inset-0 z-[70] grid place-items-end sm:place-items-center" role="dialog" aria-modal="true"
      aria-labelledby="clear-title" data-testid="clear-dialog">
      <button type="button" aria-label="Close" onClick={onCancel} disabled={busy}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="glass relative w-full max-w-md animate-rise rounded-t-2xl border border-hairline p-6 shadow-2xl shadow-black/70 sm:rounded-2xl">
        <h2 id="clear-title" className="font-display text-xl leading-tight">Clear your whole agenda?</h2>
        <p className="mt-1 text-[13px] text-muted">
          Every seat and waitlist place is given up, and each seat goes to whoever has waited longest.
          Your check-ins and ratings stay.
        </p>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={onCancel} disabled={busy} data-testid="clear-cancel">Cancel</Button>
          <Button variant="primary" onClick={onConfirm} disabled={busy} data-testid="clear-confirm">
            {busy ? 'Clearing…' : 'Clear my agenda'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function AgendaRow({ session, note, onSwapped }) {
  const { reservationFor, swapSeat, clock } = useConference();
  const status = reservationFor(session.id);
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState(null);

  async function toggle() {
    setOpen((o) => !o);
    if (options) return;
    const all = await api.getSessions({ day: session.day });
    setOptions(all.filter((s) => s.startsAt === session.startsAt && s.id !== session.id));
  }

  async function swap(to) {
    const state = await swapSeat(session.id, to);
    if (!state) return;
    onSwapped(to, state);
  }

  return (
    <div data-testid="agenda-row" data-status={status} className="space-y-2">
      <SessionCard session={session} variant="row" />
      <button
        type="button"
        data-testid="other-options"
        aria-expanded={open}
        onClick={toggle}
        className="text-xs font-semibold text-violet-300 hover:text-violet-200"
      >
        Other options
      </button>
      {open && (
        <ul className="space-y-2 rounded-xl border border-hairline bg-surface p-3">
          {options === null && <li className="text-xs text-muted">Loading…</li>}
          {options?.length === 0 && <li className="text-xs text-muted">Nothing else starts in this slot.</li>}
          {options?.map((o) => {
            const ended = hasEnded(o, clock);
            return (
              <li key={o.id} data-testid="swap-option" className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <h4 className="truncate text-sm font-semibold">{o.title}</h4>
                  <p className="text-[11px] text-muted">
                    {o.room.name}
                    {ended ? ' · ended' : o.seatsLeft === 0 ? ' · full, you would join the waitlist' : ''}
                  </p>
                </div>
                <Button size="sm" aria-label={`Swap to ${o.title}`} disabled={ended} onClick={() => swap(o)}>Swap</Button>
              </li>
            );
          })}
        </ul>
      )}
      {note && status === 'waitlisted' && (
        <p data-testid="swap-waitlist-note" className="text-xs font-medium text-amber-300">
          Room is full — you are {note.position ? `#${note.position} ` : ''}on the waitlist.
        </p>
      )}
    </div>
  );
}
