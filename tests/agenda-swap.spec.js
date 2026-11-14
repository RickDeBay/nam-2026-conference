import { test, expect } from '@playwright/test';
import { API, visit, momentOn, laneFor, bookableFor, shotForPR } from './helpers.js';

/** A slot the attendee holds nothing in, with two sessions that have room and one that is full. */
async function swapFixture(request, lane) {
  const free = await bookableFor(request, lane.user, lane.day);
  const bySlot = Map.groupBy(free, (s) => s.startsAt);
  for (const [, sessions] of bySlot) {
    const open = sessions.filter((s) => !s.isFull && s.seatsLeft > 3);
    const full = sessions.find((s) => s.isFull);
    if (open.length >= 2 && full) return { from: open[0], to: open[1], full };
  }
  throw new Error('no slot with two open sessions and a full one for this attendee');
}

const hoursOf = (mins) => `${+(mins / 60).toFixed(1)}h`;

async function confirmedMinutes(request, userId) {
  const { days } = await (await request.get(`${API}/users/${userId}/schedule`)).json();
  return days.reduce((n, d) => n + d.totalMinutes, 0);
}

async function seatsTaken(request, id) {
  return (await (await request.get(`${API}/sessions/${id}`)).json()).seatsTaken;
}

test('My Agenda lists seats by day and slot, and swaps within a slot', async ({ page, request }, testInfo) => {
  const lane = await laneFor('agenda.swap', testInfo);
  const { from, to, full } = await swapFixture(request, lane);
  const days = (await (await request.get(`${API}/bootstrap`)).json()).days.map((d) => d.date);
  const reserve = (id, day, time) => request.put(`${API}/users/${lane.user}/reservations/${id}`, { data: { day, time } });
  const row = (title) => page.getByTestId('agenda-row').filter({ hasText: title });
  const at = await momentOn(1, '08:00');

  try {
    expect((await reserve(from.id, days[0], '08:00')).status()).toBe(200);

    // Listed under its day and slot, as a seat; hours count the seat
    await visit(page, '/my-agenda', { as: lane.user, at });
    await expect(page.getByTestId('agenda-day').first()).toBeVisible();
    const slot = page.getByTestId('agenda-slot').filter({ has: row(from.title) });
    await expect(slot).toHaveCount(1);
    await expect(page.getByTestId('agenda-day').filter({ has: row(from.title) })).toHaveCount(1);
    await expect(row(from.title)).toHaveAttribute('data-status', 'confirmed');
    await expect(page.getByTestId('agenda-booked-hours')).toHaveText(hoursOf(await confirmedMinutes(request, lane.user)));

    // Other options: exactly the rest of the slot
    await row(from.title).getByTestId('other-options').click();
    const options = row(from.title).getByTestId('swap-option');
    const everything = await (await request.get(`${API}/sessions?day=${lane.day}`)).json();
    const expected = everything.filter((s) => s.startsAt === from.startsAt && s.id !== from.id).map((s) => s.title).sort();
    await expect(options).toHaveCount(expected.length);
    expect((await options.locator('h4').allInnerTexts()).sort()).toEqual(expected);

    // Swap to a session with room: new one held, old one gone and its seat freed
    const before = await seatsTaken(request, from.id);
    await options.filter({ hasText: to.title }).getByRole('button', { name: /^Swap/ }).click();
    await expect(row(to.title)).toHaveAttribute('data-status', 'confirmed');
    await expect(row(from.title)).toHaveCount(0);
    expect(await seatsTaken(request, from.id)).toBe(before - 1);

    // Swap into a full session: a waitlist place, and the page says so
    await row(to.title).getByTestId('other-options').click();
    await row(to.title).getByTestId('swap-option').filter({ hasText: full.title }).getByRole('button', { name: /^Swap/ }).click();
    await expect(row(full.title)).toHaveAttribute('data-status', 'waitlisted');
    await expect(page.getByTestId('swap-waitlist-note')).toContainText('waitlist');
    await expect(row(to.title)).toHaveCount(0);
    // waitlisted time is shown apart from the booked hours
    const { days: sched } = await (await request.get(`${API}/users/${lane.user}/schedule`)).json();
    const waitlisted = sched.reduce((n, d) => n + d.waitlistedMinutes, 0);
    expect(waitlisted).toBe(full.durationMins);
    await expect(page.getByTestId('agenda-booked-hours')).toHaveText(hoursOf(await confirmedMinutes(request, lane.user)));
    await expect(page.getByTestId('agenda-booked-note')).toContainText(`+${hoursOf(waitlisted)} waitlisted`);
    await shotForPR(page, 'My Agenda after swapping into a full session');

    // Once the day is over, nothing in the slot can be swapped into
    await visit(page, '/my-agenda', { as: lane.user, at: await momentOn(2, '08:00') });
    await row(full.title).getByTestId('other-options').click();
    const late = row(full.title).getByTestId('swap-option').getByRole('button', { name: /^Swap/ });
    await expect(late).toHaveCount(expected.length);
    for (const b of await late.all()) await expect(b).toBeDisabled();
    await expect(row(full.title)).toHaveAttribute('data-status', 'waitlisted');
  } finally {
    for (const id of [from.id, to.id, full.id]) await request.delete(`${API}/users/${lane.user}/reservations/${id}`);
  }
});

test('My Agenda is in the nav, and /my-plan lands on it', async ({ page }, testInfo) => {
  await visit(page, '/');
  if (testInfo.project.name === 'mobile') {
    await page.getByRole('button', { name: 'Open menu' }).click();
    await page.getByRole('navigation', { name: 'Mobile' }).getByRole('link', { name: /My Agenda/ }).click();
  } else {
    await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: /My Agenda/ }).click();
  }
  await expect(page).toHaveURL(/\/my-agenda$/);
  await visit(page, '/my-plan');
  await expect(page).toHaveURL(/\/my-agenda$/);
  await expect(page.getByTestId('agenda-coming-soon')).toHaveCount(0);
});
