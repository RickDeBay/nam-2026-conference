import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useConference, useFetch } from '../lib/store.jsx';
import { useDocumentTitle } from '../lib/useDocumentTitle.js';
import * as api from '../lib/api.js';
import { dayLabel, plural, timeRange } from '../lib/format.js';
import { ErrorState, NotFoundState, SectionHeader, Skeleton } from '../components/ui.jsx';

/** Confirmed seats only, grouped by day and then by start time. */
const bySlot = (sessions) => {
  const slots = new Map();
  for (const s of sessions.filter((x) => x.reservation === 'confirmed')) {
    if (!slots.has(s.startsAt)) slots.set(s.startsAt, []);
    slots.get(s.startsAt).push(s);
  }
  return [...slots.entries()].sort(([a], [b]) => a.localeCompare(b));
};

/** Seats, waitlist places and skips each get their own line, never folded together. */
function CloneSummary({ summary }) {
  const rows = [
    ['clone-seats', 'seats', summary.seats, 'Seats taken'],
    ['clone-waitlisted', 'waitlisted', summary.waitlisted, 'Waitlisted'],
    ['clone-skipped', 'skipped', summary.skipped, 'Skipped (already over)'],
  ];
  return (
    <section data-testid="clone-summary" className="space-y-3 rounded-xl border border-hairline bg-surface p-4">
      <h3 className="font-display text-lg">Agenda cloned</h3>
      {rows.map(([testid, , list, label]) => (
        <div key={testid} data-testid={testid}>
          <p className="text-sm font-semibold">{label}: {list.length}</p>
          {list.length > 0 && <p className="text-xs text-muted">{list.map((s) => s.title).join(' · ')}</p>}
        </div>
      ))}
    </section>
  );
}

export function CuratorAgendaPage() {
  const { id } = useParams();
  const { reservations, cloneAgenda } = useConference();
  const [summary, setSummary] = useState(null);
  const [busy, setBusy] = useState(false);
  const { data, loading, error, reload } = useFetch(async () => {
    const [curators, schedule] = await Promise.all([api.getCurators(), api.getSchedule(id)]);
    return { curator: curators.find((c) => c.id === Number(id)), schedule };
  }, [id]);
  const curator = data?.curator;
  useDocumentTitle(curator ? `${curator.name}’s agenda` : 'Curated agendas');

  if (loading && !data) return <Skeleton className="h-64" />;
  if (error?.status === 404 || (data && !curator)) {
    return <NotFoundState title="Curator not found" backTo="/curated-agendas" backLabel="All curated agendas" />;
  }
  if (error) return <ErrorState error={error} onRetry={reload} />;

  const clone = async () => {
    setBusy(true);
    const result = await cloneAgenda(curator.id);
    setBusy(false);
    if (result) setSummary(result);
  };

  return (
    <div className="space-y-8">
      <SectionHeader eyebrow="Curated agenda" title={`${curator.name}’s agenda`} description={curator.bio}
        action={<Link to="/curated-agendas" className="text-sm text-violet-300 hover:underline">All curated agendas</Link>} />
      {curator.isFull && (
        <p data-testid="curator-full" className="text-sm font-semibold text-muted">
          Full: this agenda has been cloned as many times as it can be.
        </p>
      )}
      {summary ? <CloneSummary summary={summary} />
        : reservations.size === 0 && !curator.isFull && (
          <button type="button" data-testid="clone-agenda" onClick={clone} disabled={busy}
            className="rounded-lg bg-violet-500 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-400 disabled:opacity-60">
            Clone this agenda
          </button>
        )}
      {data.schedule.days.map((day) => (
        <section key={day.date} data-testid="curator-day" className="space-y-3">
          <h3 className="font-display text-xl">{dayLabel(day.date)}</h3>
          {bySlot(day.sessions).map(([start, sessions]) => (
            <div key={start} data-testid="curator-slot" className="rounded-xl border border-hairline bg-surface p-4">
              {sessions.map((s) => (
                <Link key={s.id} to={`/sessions/${s.id}`} className="block hover:text-violet-200">
                  <span className="block text-xs font-semibold uppercase tracking-wide text-faint">
                    {timeRange(s.startsAt, s.endsAt)} · {s.venue.shortName}, {s.room.name}
                  </span>
                  <span className="block font-medium">{s.title}</span>
                </Link>
              ))}
            </div>
          ))}
          <p className="text-xs text-muted">{plural(day.sessions.filter((s) => s.reservation === 'confirmed').length, 'session')}</p>
        </section>
      ))}
    </div>
  );
}
