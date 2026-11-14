/** Shared display helpers. Keep formatting out of components. */

export const time = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, '0')} ${period}`;
};

export const timeRange = (start, end) => `${time(start)} – ${time(end)}`;

export const dayLabel = (iso) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', {
    weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC',
  });

export const shortDay = (iso) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', {
    weekday: 'short', timeZone: 'UTC',
  });

/**
 * "12m ago" measured against the conference clock, not the browser's.
 * Seeded timestamps are conference-local wall time with a Z suffix, so the
 * clock is compared on that same basis.
 */
export const relativeDate = (iso, clock) => {
  const d = new Date(iso);
  const diff = (new Date(`${clock.day}T${clock.time}:00Z`).getTime() - d.getTime()) / 1000;
  if (diff < 3600) return `${Math.max(1, Math.round(diff / 60))}m ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export const plural = (n, one, many = `${one}s`) => `${n.toLocaleString()} ${n === 1 ? one : many}`;

/** The schedule rail's "N sessions · M today"/"M on Day 1" line. `dayPhrase` is the caller's job. */
export const agendaSummary = (total, bookedOnDay, dayPhrase) =>
  `${total === 1 ? 'session' : 'sessions'} · ${bookedOnDay} ${dayPhrase}`;

/**
 * What My Agenda shows: the sessions the store says you hold (seat or waitlist
 * place), grouped by day then start time, with hours totalled from the same
 * answer. Booked minutes are confirmed seats only; waitlisted time is kept
 * apart — see CLAUDE.md, "Hours are hours you hold a chair for". `days` is
 * `[{ date, sessions }]`, `statusOf(id)` the store's `reservationFor`.
 */
export function agendaDays(days, statusOf) {
  return days.map(({ date, sessions }) => {
    const held = sessions.filter((s) => statusOf(s.id))
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.id - b.id);
    const minutes = (status) => held.filter((s) => statusOf(s.id) === status)
      .reduce((n, s) => n + s.durationMins, 0);
    const slots = [...Map.groupBy(held, (s) => s.startsAt)].map(([startsAt, items]) => ({ startsAt, sessions: items }));
    return { date, slots, totalMinutes: minutes('confirmed'), waitlistedMinutes: minutes('waitlisted') };
  }).filter((d) => d.slots.length > 0).sort((a, b) => a.date.localeCompare(b.date));
}

/** 90 → "1.5h" */
export const hoursOf = (mins) => `${+(mins / 60).toFixed(1)}h`;
