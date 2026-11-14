import { db } from '../db.js';
import { toMinutes } from './query.js';
import { reserveSeat } from './seats.js';

/**
 * Cloning a curated agenda: take a seat (or a waitlist place) in everything a
 * curator holds that has not ended, in one transaction. Only an attendee with
 * an empty agenda may do it, only once ever, and each curator can be cloned by
 * at most `ceil(attendees / curators)` people so no agenda is flooded.
 */

const getUser = db.prepare('SELECT id, is_curator FROM users WHERE id = ?');
const attendeeCount = db.prepare('SELECT COUNT(*) n FROM users WHERE is_curator = 0');
const curatorCount = db.prepare('SELECT COUNT(*) n FROM users WHERE is_curator = 1');
const curatorIds = db.prepare('SELECT id FROM users WHERE is_curator = 1 ORDER BY id');
const holdsAny = db.prepare('SELECT 1 FROM reservations WHERE user_id = ? LIMIT 1');
const alreadyCloned = db.prepare('SELECT 1 FROM agenda_clones WHERE user_id = ?');
const clonesOf = db.prepare('SELECT COUNT(*) n FROM agenda_clones WHERE curator_id = ?');
const insertClone = db.prepare('INSERT INTO agenda_clones (user_id, curator_id, created_at) VALUES (?, ?, ?)');
const curatorSessions = db.prepare(`
  SELECT s.id, s.title, s.day, s.ends_at FROM reservations r
  JOIN sessions s ON s.id = r.session_id
  WHERE r.user_id = ? AND r.status = 'confirmed'
  ORDER BY s.day, s.starts_at, s.id`);

export const cloneCap = () => Math.ceil(attendeeCount.get().n / Math.max(1, curatorCount.get().n));

/** Per curator, how many have cloned them and whether another may. */
export function curatorStandings() {
  const cap = cloneCap();
  return new Map(curatorIds.all().map(({ id }) => {
    const cloneCount = clonesOf.get(id).n;
    return [id, { cloneCount, cloneCap: cap, isFull: cloneCount >= cap }];
  }));
}

const brief = (s) => ({ id: s.id, title: s.title });

export const cloneAgenda = db.transaction((userId, curatorId, now) => {
  if (!getUser.get(userId) || !getUser.get(curatorId)?.is_curator) return null;
  if (holdsAny.get(userId)) return { rejected: 'not-empty' };
  if (alreadyCloned.get(userId)) return { rejected: 'already-cloned' };
  if (curatorStandings().get(curatorId).isFull) return { rejected: 'curator-full' };

  const result = { curatorId, seats: [], waitlisted: [], skipped: [], states: [] };
  for (const s of curatorSessions.all(curatorId)) {
    // same test as reserveSeat's ended guard, only when the client sent a clock
    const over = now?.day && now?.time
      && (s.day < now.day || (s.day === now.day && toMinutes(s.ends_at) <= toMinutes(now.time)));
    if (over) { result.skipped.push(brief(s)); continue; }
    const state = reserveSeat(userId, s.id, now);
    result.states.push(state);
    (state.status === 'waitlisted' ? result.waitlisted : result.seats).push(brief(s));
  }
  insertClone.run(userId, curatorId, new Date().toISOString());
  return result;
});
