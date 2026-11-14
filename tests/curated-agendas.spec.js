import { test, expect } from '@playwright/test';
import { visit, shotForPR, momentOn } from './helpers.js';

test('curated agendas: reachable from nav and Home, and a curator is grouped by day and slot', async ({ page }) => {
  const at = await momentOn(0, '08:00');
  await visit(page, '/', { at });
  await page.getByTestId('quick-links').getByRole('link', { name: /^Curated agendas/ }).click();
  await expect(page).toHaveURL(/\/curated-agendas$/);

  await visit(page, '/schedule', { at });
  const menu = page.getByRole('button', { name: 'Open menu' });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole('banner').getByRole('link', { name: 'Curated agendas' }).filter({ visible: true }).first().click();
  await expect(page).toHaveURL(/\/curated-agendas$/);

  const cards = page.getByTestId('curator-card');
  await expect(cards).toHaveCount(4);
  for (const n of ['Tinker', 'Tailor', 'Soldier', 'Spy']) {
    await expect(page.getByTestId('curator-card').filter({ hasText: `${n}’s agenda` })).toHaveCount(1);
  }

  await cards.filter({ hasText: 'Spy’s agenda' }).click();
  await expect(page.getByRole('heading', { name: 'Spy’s agenda' })).toBeVisible();
  await expect(page.getByTestId('curator-day')).toHaveCount(4);
  for (const day of await page.getByTestId('curator-day').all()) {
    expect(await day.getByTestId('curator-slot').count()).toBeGreaterThan(2);
  }
  await shotForPR(page, 'Spy’s agenda, grouped by day and time slot');
});
