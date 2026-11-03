import { expect, test } from '@playwright/test';

import { openEvent } from './helpers';

test('visitors see what Sidequest is, and upcoming events', async ({ page }) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Every student event, in one place' }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Upcoming', level: 1 })).toBeVisible();
  await expect(page.getByText('Board game night').first()).toBeVisible();
});

test('event pages work on their own and carry link preview tags', async ({ page, request }) => {
  await page.goto('/');
  await openEvent(page, 'Board game night');

  // Crawlers don't run JavaScript: the tags must be in the server-rendered HTML.
  const html = await (await request.get(page.url())).text();
  expect(html).toContain('<meta property="og:title" content="Board game night"');
});
