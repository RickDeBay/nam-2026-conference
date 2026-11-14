import { test, expect } from '@playwright/test';
import { visit, shotForPR, momentOn, laneFor, ATTENDEES, API } from './helpers.js';


test('clone a curated agenda: offered only when empty, then a summary of seats, waitlist and skips', async ({ page, request }, testInfo) => {
  const lane = await laneFor('clone.ui', testInfo);
  const at = await momentOn(0, '10:30');

  // Jonas holds seats, so the clone button is not offered to him.
  await visit(page, `/curated-agendas/${lane.curator}`, { as: ATTENDEES.jonas, at });
  await expect(page.getByTestId('curator-day')).toHaveCount(4);
  await expect(page.getByTestId('clone-agenda')).toHaveCount(0);
  await expect(page.getByTestId('clone-unavailable')).toBeVisible();
  await expect(page.getByTestId('clone-unavailable').getByRole('link')).toHaveAttribute('href', '/my-agenda');
  await shotForPR(page, 'Explanation shown instead of the clone button');

  await visit(page, `/curated-agendas/${lane.curator}`, { as: lane.user, at });
  await expect(page.getByTestId('curator-day')).toHaveCount(4);
  await expect(page.getByTestId('clone-agenda')).toBeVisible();
  await expect(page.getByTestId('clone-unavailable')).toHaveCount(0);
  await page.getByTestId('clone-agenda').click();

  const summary = page.getByTestId('clone-summary');
  await expect(summary).toBeVisible();
  await expect(summary.getByTestId('clone-seats')).toContainText(/Seats taken: [1-9]/);
  await expect(summary.getByTestId('clone-waitlisted')).toContainText('Waitlisted: 0');
  // Day 1's morning is over at 10:30, so those sessions are skipped, not booked
  await expect(summary.getByTestId('clone-skipped')).toContainText(/Skipped \(already over\): [1-9]/);
  await expect(page.getByTestId('clone-agenda')).toHaveCount(0);
  await expect(page.getByTestId('clone-unavailable')).toHaveCount(0);
  await shotForPR(page, 'Summary after cloning a curated agenda');

  // give the seats back so the shared seat counts are as they were
  const { reservations } = await (await request.get(`${API}/users/${lane.user}`)).json();
  for (const r of reservations) await request.delete(`${API}/users/${lane.user}/reservations/${r.sessionId}`);
});

test('a full curator shows only its Full notice, not the explanation', async ({ page }) => {
  const at = await momentOn(0, '10:30');
  await page.route('**/api/users/curators', async (route) => {
    const res = await route.fetch();
    const curators = await res.json();
    await route.fulfill({ response: res, json: curators.map((c) => ({ ...c, isFull: true })) });
  });
  const curators = await (await page.request.get(`${API}/users/curators`)).json();
  await visit(page, `/curated-agendas/${curators[0].id}`, { as: ATTENDEES.jonas, at });
  await expect(page.getByTestId('curator-full')).toBeVisible();
  await expect(page.getByTestId('clone-unavailable')).toHaveCount(0);
  await expect(page.getByTestId('clone-agenda')).toHaveCount(0);
});
