import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { attendedSession, days, overlaps, startApi } from './harness.js';

/**
 * Clearing My Agenda, at the API. Attendees 11, 12 and 13 are seeded empty; 7 is the
 * curator Tinker. `attendedSession` finds the attendee with the seeded Day 1 check-in.
 */
const TINKER = 7;

let api;
let close;
let dates;
before(async () => {
  ({ api, close } = await startApi());
  dates = await days(api);
});
after(() => close());

const clear = (userId) => api.del(`/users/${userId}/reservations`);
const reserve = (userId, sessionId) => api.put(`/users/${userId}/reservations/${sessionId}`, {});
const pause = () => new Promise((r) => setTimeout(r, 5));
const fillSession = (sessionId) => {
  const raw = new Database(process.env.ORBIT_DB);
  raw.prepare('UPDATE sessions SET seats_taken = capacity WHERE id = ?').run(sessionId);
  raw.close();
};
/** A last-day session, which is not over and clashes with nothing an empty attendee holds. */
const lastDaySessions = async () =>
  (await api.json(`/sessions?day=${dates[3]}`)).filter((s) => !s.isKeynote && s.format !== 'Social');

describe('Clearing My Agenda', () => {
  test('releases every seat and waitlist place, past ones included, and keeps check-ins and ratings', async () => {
    const { userId } = await attendedSession(api);
    const held = new Set((await api.json(`/users/${userId}`)).reservations.map((r) => r.sessionId));
    const mine = (await api.json('/sessions')).filter((x) => held.has(x.id));
    const [open] = (await lastDaySessions()).filter((s) => !mine.some((m) => overlaps(m, s)));
    fillSession(open.id);
    assert.equal((await reserve(userId, open.id)).body.status, 'waitlisted');

    const before = await api.json(`/users/${userId}`);
    assert.ok(before.reservations.some((r) => r.status === 'waitlisted'));
    assert.ok(before.reservations.some((r) => before.checkIns.includes(r.sessionId)), 'holds an attended seat');

    const { status, body } = await clear(userId);
    assert.equal(status, 200);
    assert.equal(body.released.length, before.reservations.length);
    assert.deepEqual(body.released.map((r) => r.sessionId).sort(), before.reservations.map((r) => r.sessionId).sort());
    assert.equal(body.states.length, before.reservations.length);

    const after = await api.json(`/users/${userId}`);
    assert.deepEqual(after.reservations, []);
    assert.deepEqual(after.checkIns, before.checkIns);
    assert.deepEqual(after.ratings, before.ratings);
    assert.equal((await clear(userId)).body.released.length, 0, 'clearing nothing is fine');
  });

  test('a released confirmed seat goes to whoever waited longest', async () => {
    const [, session] = await lastDaySessions();
    assert.equal((await reserve(11, session.id)).body.status, 'confirmed');
    fillSession(session.id);
    assert.equal((await reserve(12, session.id)).body.status, 'waitlisted');
    await pause();
    assert.equal((await reserve(13, session.id)).body.status, 'waitlisted');

    const { body } = await clear(11);
    assert.deepEqual(body.released, [{ sessionId: session.id, status: 'confirmed' }]);
    const state = await api.json(`/sessions/${session.id}`);
    assert.equal(state.seatsTaken, session.capacity);
    assert.equal((await api.json(`/users/12`)).reservations[0].status, 'confirmed');
    assert.equal((await api.json(`/users/13`)).reservations[0].status, 'waitlisted');
    await clear(12);
    await clear(13);
  });

  test('forgets the clone: the curator count drops and the attendee can clone again', async () => {
    const standing = async () => (await api.json('/users/curators')).find((c) => c.id === TINKER).cloneCount;
    const clone = () => api.post(`/users/11/clone/${TINKER}`, { day: dates[0], time: '10:30' });
    const start = await standing();

    assert.equal((await clone()).status, 200);
    assert.equal(await standing(), start + 1);
    assert.equal((await clone()).body.rejected, 'not-empty');

    assert.equal((await clear(11)).status, 200);
    assert.equal(await standing(), start);
    assert.equal((await clone()).status, 200, 'cloned again, not already-cloned');
    assert.equal(await standing(), start + 1);
    await clear(11);
  });

  test('an unknown attendee is a 404', async () => {
    assert.equal((await clear(999)).status, 404);
  });
});
