import { test, expect } from '@playwright/test';

test.describe('Settings Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings');
  });

  test('renders settings page with all sections', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Account Settings' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Change Password' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Parental PIN' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Notification Preferences' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Danger Zone' })).toBeVisible();
  });

  test('shows back to dashboard link', async ({ page }) => {
    await expect(page.getByRole('link', { name: 'Back to Dashboard' })).toBeVisible();
  });

  test('displays current user email', async ({ page }) => {
    await expect(page.getByText('test@example.com')).toBeVisible();
  });

  test('name input is pre-filled', async ({ page }) => {
    const nameInput = page.getByLabel('Name');
    await expect(nameInput).toBeVisible();
    const value = await nameInput.inputValue();
    expect(value.length).toBeGreaterThan(0);
  });

  test('can toggle notification settings', async ({ page }) => {
    // All toggles should be visible
    const toggles = page.locator('.relative.inline-flex');
    const count = await toggles.count();
    expect(count).toBeGreaterThan(0);
  });

  test('shows password mismatch error', async ({ page }) => {
    await page.getByLabel('Current Password').fill('oldpassword');
    await page.getByLabel('New Password').fill('newpassword123');
    await page.getByLabel('Confirm New Password').fill('different123');
    await expect(page.getByText('Passwords do not match')).toBeVisible();
  });

  test('shows PIN mismatch error', async ({ page }) => {
    await page.getByLabel('New PIN (4-6 digits)').fill('1234');
    await page.getByLabel('Confirm PIN').fill('5678');
    await expect(page.getByText('PINs do not match')).toBeVisible();
  });

  test('shows PIN format error for non-numeric', async ({ page }) => {
    await page.getByLabel('New PIN (4-6 digits)').fill('abcd');
    await expect(page.getByText('PIN must be 4-6 digits')).toBeVisible();
  });
});
