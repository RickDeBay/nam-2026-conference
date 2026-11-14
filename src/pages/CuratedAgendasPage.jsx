import { Link } from 'react-router-dom';
import { useFetch } from '../lib/store.jsx';
import { useDocumentTitle } from '../lib/useDocumentTitle.js';
import * as api from '../lib/api.js';
import { Avatar, ErrorState, SectionHeader, Skeleton } from '../components/ui.jsx';

/** Four ready-made agendas to browse. Curators are attendees, not speakers, and an agenda is not a track. */
export function CuratedAgendasPage() {
  useDocumentTitle('Curated agendas');
  const { data: curators, loading, error, reload } = useFetch(() => api.getCurators(), []);

  return (
    <div className="space-y-8">
      <SectionHeader title="Curated agendas"
        description="Four ready-made ways through the four days. No two agendas share a talk." />
      {error ? <ErrorState error={error} onRetry={reload} />
        : loading && !curators ? <Skeleton className="h-40" />
        : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {curators.map((c) => (
              <li key={c.id}>
                <Link to={`/curated-agendas/${c.id}`} data-testid="curator-card"
                  className="flex h-full items-start gap-4 rounded-xl border border-hairline bg-surface p-5 transition-colors hover:border-white/20 hover:bg-raised">
                  <Avatar name={c.name} initials={c.initials} accent={c.accent} imageUrl={c.imageUrl} size="lg" />
                  <span className="min-w-0">
                    <span className="block font-display text-xl">{c.name}’s agenda</span>
                    <span className="mt-1 block text-sm text-muted">{c.bio}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
    </div>
  );
}
