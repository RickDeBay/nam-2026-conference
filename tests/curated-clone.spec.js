import { test, expect } from '@playwright/test';
import { visit, shotForPR, momentOn, laneFor, ATTENDEES, API } from './helpers.js';


test('clone a curated agenda: offered only when empty, then a summary of seats, waitlist and skips', async ({ page, request }, testInfo) => {
  const lane = await laneFor('clone.ui', testInfo);
  const at = await momentOn(0, '10:30');

  // Jonas holds seats, so the clone button is not offered to him.
  await visit(page, `/curated-agendas/${lane.curator}`, { as: ATTENDEES.jonas, at });
  await expect(page.getByTestId('curator-day')).toHaveCount(4);
  await expect(page.getByTestId('clone-agenda')).toHaveCount(0);

  await visit(page, `/curated-agendas/${lane.curator}`, { as: lane.user, at });
  await expect(page.getByTestId('curator-day')).toHaveCount(4);
  await page.getByTestId('clone-agenda').click();

  const summary = page.getByTestId('clone-summary');
  await expect(summary).toBeVisible();
  await expect(summary.getByTestId('clone-seats')).toContainText(/Seats taken: [1-9]/);
  await expect(summary.getByTestId('clone-waitlisted')).toContainText('Waitlisted: 0');
  // Day 1's morning is over at 10:30, so those sessions are skipped, not booked
  await expect(summary.getByTestId('clone-skipped')).toContainText(/Skipped \(already over\): [1-9]/);
  await expect(page.getByTestId('clone-agenda')).toHaveCount(0);
  await shotForPR(page, 'Summary after cloning a curated agenda');

  // give the seats back so the shared seat counts are as they were
  const { reservations } = await (await request.get(`${API}/users/${lane.user}`)).json();
  for (const r of reservations) await request.delete(`${API}/users/${lane.user}/reservations/${r.sessionId}`);
});
