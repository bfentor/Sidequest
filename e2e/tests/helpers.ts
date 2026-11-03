import { expect, type Page } from '@playwright/test';

// Created by `manage.py seed_demo`.
export const DEMO = { email: 'demo@sidequest.test', password: 'sidequest-demo' };

export async function signIn(page: Page) {
  await page.goto('/sign-in');
  await page.getByLabel('Email').fill(DEMO.email);
  await page.getByLabel('Password').fill(DEMO.password);
  await page.getByRole('button', { name: 'Sign in' }).last().click();
  // Back on the page signing in started from, signed in.
  await expect(page).not.toHaveURL(/sign-in/);
}

/** Opens an event from the feed as its own page (wide screens show a side panel first). */
export async function openEvent(page: Page, title: string) {
  await page.getByText(title).first().click();
  const openPage = page.getByRole('link', { name: 'Open as a page' });
  if ((page.viewportSize()?.width ?? 0) >= 1200) {
    await openPage.click();
  }
  await expect(page).toHaveURL(/\/events\/\d+/);
  await expect(page.getByRole('heading', { name: title }).first()).toBeVisible();
}
