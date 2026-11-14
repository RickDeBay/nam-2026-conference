import { test, expect } from '@playwright/test';
import { API, visit, momentOn, laneFor, bookableFor, shotForPR } from './helpers.js';

test('My Agenda clears in one confirmed step and then points at Curated agendas', async ({ page, request }, testInfo) => {
  // Wren is the only empty attendee this lane can own; mobile has none to spare
  test.skip(testInfo.project.name === 'mobile', 'no second empty attendee for the mobile pane');
  const lane = await laneFor('agenda.clear', testInfo);
  const at = await momentOn(1, '08:00');
  const rows = page.getByTestId('agenda-row');
  const mine = async () => (await (await request.get(`${API}/users/${lane.user}`)).json()).reservations;

  try {
    // An empty agenda has nothing to clear
    await visit(page, '/my-agenda', { as: lane.user, at });
    await expect(page.getByText('Nothing on your agenda yet')).toBeVisible();
    await expect(page.getByTestId('clear-agenda')).toHaveCount(0);

    const free = await bookableFor(request, lane.user, lane.day);
    const first = free[0];
    const second = free.find((s) => s.startsAt >= first.endsAt);
    for (const s of [first, second]) {
      expect((await request.put(`${API}/users/${lane.user}/reservations/${s.id}`, { data: { day: lane.day, time: '08:00' } })).status()).toBe(200);
    }

    // Cancel (button, then Escape) changes nothing
    await visit(page, '/my-agenda', { as: lane.user, at });
    await expect(rows).toHaveCount(2);
    const hours = await page.getByTestId('agenda-booked-hours').innerText();
    await page.getByTestId('clear-agenda').click();
    await expect(page.getByTestId('clear-dialog')).toBeVisible();
    await shotForPR(page, 'The Clear my agenda confirmation on My Agenda');
    await page.getByTestId('clear-cancel').click();
    await expect(page.getByTestId('clear-dialog')).toHaveCount(0);
    await page.getByTestId('clear-agenda').click();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('clear-dialog')).toHaveCount(0);
    await expect(rows).toHaveCount(2);
    await expect(page.getByTestId('agenda-booked-hours')).toHaveText(hours);
    expect(await mine()).toHaveLength(2);

    // Confirm: nothing held, the button is gone, the empty state links on
    await page.getByTestId('clear-agenda').click();
    await page.getByTestId('clear-confirm').click();
    await expect(rows).toHaveCount(0);
    await expect(page.getByText('Nothing on your agenda yet')).toBeVisible();
    await expect(page.getByTestId('clear-agenda')).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Browse curated agendas' })).toHaveAttribute('href', '/curated-agendas');
    expect(await mine()).toEqual([]);
  } finally {
    await request.delete(`${API}/users/${lane.user}/reservations`);
  }
});
