import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { startApi } from './harness.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * What the seed promises the app, checked on the seeded database itself.
 *
 * An attendee chooses interests from the topic tags, so a seeded interest
 * that is not one can never be shown — and a save from the picker drops it.
 * Kenji's `Edge`, a tech tag, did exactly that on #219.
 */

let api;
let close;

before(async () => { ({ api, close } = await startApi()); });
after(() => close());

describe('Seeded attendees', () => {
  test('every interest is a topic tag', async () => {
    const { users, tags } = await api.json('/bootstrap');
    const topics = new Set(tags.filter((t) => t.kind === 'topic').map((t) => t.name));
    assert.ok(topics.size > 0 && users.some((u) => u.interests.length), 'the seed has topics and interests to check');
    const strays = users.flatMap((u) => u.interests.filter((i) => !topics.has(i)).map((i) => `${u.name}: ${i}`));
    assert.deepEqual(strays, []);
  });

  test('user 13 is Wren Okafor, with a truly empty agenda, and the clone cap counts her', async () => {
    const wren = await api.json('/users/13');
    assert.equal(wren.name, 'Wren Okafor');
    assert.equal(wren.company, 'ORBIT Demo Desk');
    assert.equal(wren.speakerId, null);
    assert.equal(wren.reservations.length, 0);
    assert.equal((await api.json('/users/13/schedule')).days.reduce((n, d) => n + d.items.length, 0), 0);
    const curators = await api.json('/users/curators');
    assert.ok(curators.every((c) => c.cloneCap === 3), 'nine non-curators and four curators make ceil(9 / 4) = 3');
  });
});

describe('Curators', () => {
  const NAMES = ['Tinker', 'Tailor', 'Soldier', 'Spy'];
  const agendaOf = async (id) => (await api.json(`/users/${id}/schedule`)).days;

  test('exactly Tinker, Tailor, Soldier and Spy, in that order', async () => {
    const curators = await api.json('/users/curators');
    assert.deepEqual(curators.map((c) => c.name), NAMES);
    assert.ok(curators.every((c) => c.isCurator && c.speakerId === null));
  });

  test('each holds a confirmed seat every day, with no clash and no waitlist', async () => {
    for (const c of await api.json('/users/curators')) {
      const days = await agendaOf(c.id);
      assert.equal(days.length, 4, `${c.name} has an agenda on every day`);
      for (const d of days) {
        assert.deepEqual(d.conflicts, [], `${c.name} has no clash on ${d.date}`);
        assert.ok(d.sessions.every((s) => s.reservation === 'confirmed'), `${c.name} is never waitlisted`);
        assert.ok(d.sessions.length >= 3, `${c.name} has a full day on ${d.date}`);
      }
    }
  });

  test('no session but a keynote is in two curators agendas', async () => {
    const seen = new Map();
    for (const c of await api.json('/users/curators')) {
      for (const d of await agendaOf(c.id)) {
        for (const s of d.sessions) {
          if (s.isKeynote) continue;
          assert.ok(!seen.has(s.id), `${s.title} is in ${seen.get(s.id)} and ${c.name}`);
          seen.set(s.id, c.name);
        }
      }
    }
    assert.ok(seen.size > 40);
  });

  test('they are attendees, not speakers', async () => {
    const list = await api.json('/speakers');
    assert.ok(!list.some((s) => NAMES.includes(s.name)));
  });

  test('the seed is deterministic', () => {
    const dir = mkdtempSync(join(tmpdir(), 'orbit-curators-'));
    try {
      const reservations = ['a', 'b'].map((n) => {
        const path = join(dir, `${n}.db`);
        execFileSync(process.execPath, [join(ROOT, 'server', 'seed.js')], {
          env: { ...process.env, ORBIT_DB: path, ORBIT_START_DATE: '2030-01-07' }, stdio: 'ignore',
        });
        const d = new Database(path, { readonly: true });
        const rows = d.prepare(`SELECT u.name, r.session_id, r.status FROM reservations r
          JOIN users u ON u.id = r.user_id WHERE u.is_curator = 1 ORDER BY u.id, r.session_id`).all();
        d.close();
        return rows;
      });
      assert.ok(reservations[0].length > 40);
      assert.deepEqual(reservations[0], reservations[1]);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});
