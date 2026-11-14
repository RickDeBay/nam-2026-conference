import { Link, useParams } from 'react-router-dom';
import { useFetch } from '../lib/store.jsx';
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

export function CuratorAgendaPage() {
  const { id } = useParams();
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

  return (
    <div className="space-y-8">
      <SectionHeader eyebrow="Curated agenda" title={`${curator.name}’s agenda`} description={curator.bio}
        action={<Link to="/curated-agendas" className="text-sm text-violet-300 hover:underline">All curated agendas</Link>} />
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
