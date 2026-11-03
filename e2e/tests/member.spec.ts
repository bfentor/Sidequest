import { expect, test } from '@playwright/test';

import { openEvent, signIn } from './helpers';

test('RSVPs update right away and stick', async ({ page }) => {
  await signIn(page);
  await page.goto('/');
  await openEvent(page, 'Morning run by the lake');

  const interested = page.getByRole('button', { name: 'Interested', exact: true });
  const counts = page.getByText(/going · \d+ interested/).first();
  await expect(counts).toBeVisible();
  const before = Number((await counts.textContent())?.match(/(\d+) interested/)?.[1]);

  await interested.click();
  await expect(counts).toContainText(`${before + 1} interested`);
  await page.reload();
  await expect(page.getByText(/going · \d+ interested/).first()).toContainText(
    `${before + 1} interested`,
  );

  // Undo, so the test can run again.
  await page.getByRole('button', { name: 'Interested', exact: true }).click();
  await expect(page.getByText(/going · \d+ interested/).first()).toContainText(
    `${before} interested`,
  );
});

test('posts with hashtags and mentions', async ({ page }) => {
  const tag = `e2e${Date.now()}`;
  await signIn(page);
  await page.goto('/posts/new');
  await page.getByLabel("What's happening?").fill(`Sauna tonight with @sam #${tag}`);
  await page.getByRole('button', { name: 'Post', exact: true }).click();
  await expect(page).toHaveURL(/following/);

  await page
    .getByRole('link', { name: `#${tag}` })
    .first()
    .click();
  await expect(page).toHaveURL(new RegExp(`/hashtags/${tag}`));
  await expect(page.getByText(`Sauna tonight with`).last()).toBeVisible();
  await page.getByRole('link', { name: '@sam' }).last().click();
  await expect(page).toHaveURL(/profiles\/sam/);
});
