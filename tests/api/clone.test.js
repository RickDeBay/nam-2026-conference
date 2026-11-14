import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { clearAgenda, days, startApi } from './harness.js';

/**
 * Cloning a curated agenda, at the API. Attendees 11 and 12 (Priya, Tomas) are
 * seeded with an empty agenda; anyone else is cleared first. Curators are
 * 7 Tinker, 8 Tailor, 9 Soldier, 10 Spy; 9 non-curators (Wren, 13, among them) and
 * 4 curators make the cap ceil(9 / 4) = 3.
 */
const [TINKER, TAILOR, , SPY] = [7, 8, 9, 10];

let api;
let close;
let day1;
before(async () => {
  ({ api, close } = await startApi());
  day1 = (await days(api))[0];
});
after(() => close());

const confirmedOf = async (curatorId) => {
  const { days: d } = await api.json(`/users/${curatorId}/schedule`);
  return d.flatMap((x) => x.sessions).filter((s) => s.reservation === 'confirmed');
};
const clone = (userId, curatorId, time = '10:30') =>
  api.post(`/users/${userId}/clone/${curatorId}`, { day: day1, time });
const fillSession = (sessionId) => {
  const raw = new Database(process.env.ORBIT_DB);
  raw.prepare('UPDATE sessions SET seats_taken = capacity WHERE id = ?').run(sessionId);
  raw.close();
};

describe('Cloning a curated agenda', () => {
  test('books every session that has not ended, the full one as a waitlist place', async () => {
    const theirs = await confirmedOf(TINKER);
    const over = (s) => s.day < day1 || (s.day === day1 && s.endsAt <= '10:30');
    const ended = theirs.filter(over);
    const open = theirs.filter((s) => !over(s));
    const full = open[open.length - 1];
    fillSession(full.id);

    const { status, body } = await clone(11, TINKER);
    assert.equal(status, 200);
    assert.equal(body.curatorId, TINKER);
    assert.deepEqual(body.waitlisted.map((s) => s.id), [full.id]);
    assert.equal(body.seats.length, open.length - 1);
    assert.deepEqual(body.skipped.map((s) => s.id).sort(), ended.map((s) => s.id).sort());
    assert.ok(ended.length > 0, 'Day 1 morning is already over at 10:30');
    assert.equal(body.seats.length + body.waitlisted.length + body.skipped.length, theirs.length);
    assert.equal(body.states.length, open.length);
    assert.ok(body.seats.every((s) => s.id && s.title));

    const mine = await api.json('/users/11');
    assert.equal(mine.reservations.length, open.length);
    assert.equal(mine.reservations.find((r) => r.sessionId === full.id).status, 'waitlisted');
    assert.ok(!mine.reservations.some((r) => ended.some((s) => s.id === r.sessionId)));
  });

  test('an attendee with any seat or waitlist place cannot clone', async () => {
    const { status, body } = await clone(1, TAILOR);
    assert.equal(status, 409);
    assert.equal(body.rejected, 'not-empty');
  });

  test('without a clock nothing is skipped', async () => {
    await clearAgenda(api, 4);
    const { status, body } = await api.post(`/users/4/clone/${TAILOR}`, {});
    assert.equal(status, 200);
    assert.equal(body.skipped.length, 0);
    assert.equal(body.seats.length + body.waitlisted.length, (await confirmedOf(TAILOR)).length);
    await clearAgenda(api, 4);
  });

  test('one clone per attendee, even after releasing everything', async () => {
    await clearAgenda(api, 11);
    const { status, body } = await clone(11, TAILOR);
    assert.equal(status, 409);
    assert.equal(body.rejected, 'already-cloned');
  });

  test('a curator at the cap shows full and cannot be cloned, but can still be read', async () => {
    assert.equal((await clone(12, SPY)).status, 200);
    await clearAgenda(api, 3);
    assert.equal((await clone(3, SPY)).status, 200);
    await clearAgenda(api, 5);
    assert.equal((await clone(5, SPY)).status, 200);

    const spy = (await api.json('/users/curators')).find((c) => c.id === SPY);
    assert.deepEqual([spy.cloneCount, spy.cloneCap, spy.isFull], [3, 3, true]);
    const tinker = (await api.json('/users/curators')).find((c) => c.id === TINKER);
    assert.deepEqual([tinker.cloneCount, tinker.isFull], [1, false]);

    await clearAgenda(api, 6);
    const refused = await clone(6, SPY);
    assert.equal(refused.status, 409);
    assert.equal(refused.body.rejected, 'curator-full');
    assert.equal((await api.get(`/users/${SPY}/schedule`)).status, 200);
    assert.equal((await api.json(`/users/6`)).reservations.length, 0);
  });

  test('unknown attendee or a target that is not a curator is a 404', async () => {
    assert.equal((await clone(999, TINKER)).status, 404);
    assert.equal((await clone(11, 1)).status, 404);
    assert.equal((await clone(11, 999)).status, 404);
  });
});
