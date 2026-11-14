import { useMemo, useState } from 'react';
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
  const { currentUser, currentUserId, reservationFor } = useConference();
  const { data, loading, error, reload } = useFetch(() => api.getSchedule(currentUserId), [currentUserId]);
  // Sessions swapped into after the payload was fetched
  const [added, setAdded] = useState(() => new Map());
  // The row that was just swapped into a full room; it outlives the row it replaced
  const [waitNote, setWaitNote] = useState(null);

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
          action={<Button to="/schedule" size="sm">Browse the schedule</Button>}
        />
      ) : (
        <>
          <div className="grid max-w-xs">
            <Stat
              value={hoursOf(booked)}
              label="Hours booked"
              testId="agenda-booked-hours"
              note={waitlisted > 0 ? `+${hoursOf(waitlisted)} waitlisted` : null}
              noteTestId="agenda-booked-note"
            />
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
