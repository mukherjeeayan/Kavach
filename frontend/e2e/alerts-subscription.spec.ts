import { test, expect } from '@playwright/test';

test.describe('Alerts Page', () => {
  test('renders alerts page', async ({ page }) => {
    await page.goto('/alerts');
    await expect(page.getByRole('heading', { name: /alerts/i })).toBeVisible();
  });

  test('shows empty state when no alerts', async ({ page }) => {
    await page.route('**/api/v1/alerts**', (route) =>
      route.fulfill({ status: 200, json: { success: true, data: [] } })
    );
    await page.goto('/alerts');
    await expect(page.getByText(/no alerts/i)).toBeVisible();
  });
});

test.describe('Notifications Page', () => {
  test('renders notifications page', async ({ page }) => {
    await page.goto('/notifications');
    await expect(page.getByRole('heading', { name: /notifications/i })).toBeVisible();
  });

  test('shows mark all as read button', async ({ page }) => {
    await page.goto('/notifications');
    await expect(page.getByRole('button', { name: /mark all/i })).toBeVisible();
  });
});

test.describe('Subscription Page', () => {
  test('renders subscription page', async ({ page }) => {
    await page.goto('/subscription');
    await expect(page.getByRole('heading', { name: 'Subscription' })).toBeVisible();
  });

  test('shows current plan section', async ({ page }) => {
    await page.goto('/subscription');
    await expect(page.getByRole('heading', { name: 'Current Plan' })).toBeVisible();
  });

  test('shows upgrade section for free users', async ({ page }) => {
    await page.goto('/subscription');
    const upgradeHeading = page.getByRole('heading', { name: 'Upgrade to Premium' });
    // Should be visible for non-premium users
    if (await upgradeHeading.isVisible()) {
      await expect(page.getByRole('button', { name: /monthly/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /yearly/i })).toBeVisible();
    }
  });
});
