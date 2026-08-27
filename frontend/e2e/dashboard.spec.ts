import { test, expect } from '@playwright/test';

const API = '**/api/v1';

function mockLogin(route: any, overrides: Record<string, unknown> = {}) {
  return route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      success: true,
      data: {
        token: 'mock-access-token',
        user: { id: '1', name: 'Test Parent', email: 'parent@example.com', role: 'parent' },
        child: null,
        ...overrides,
      },
    }),
  });
}

const ok = (data: unknown = null) =>
  JSON.stringify({ success: true, data });

const CHILD_ENDPOINTS = [
  'screen-time/summary',
  'screen-time',
  'alerts',
  'locations/current',
  'locations/history',
  'devices',
  'apps/blocked',
  'apps/unblock-requests',
  'contacts',
  'locks',
  'sos',
  'url-filters',
  'geofences',
  'communications',
  'keyword-alerts',
  'reports/latest',
  'mood',
  'rewards/points',
  'self-harm-alerts',
  'voice-commands',
  'predictions',
];

test.describe('Dashboard Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');

    await page.route(`${API}/auth/login`, (route) => mockLogin(route));
    await page.route(`${API}/auth/refresh-token`, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: ok({ token: 'mock-access-token' }) })
    );
    await page.route(`${API}/auth/logout`, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: ok({}) })
    );

    await page.route(`${API}/children`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            children: [
              { id: 'child-1', name: 'Aarav', birth_date: '2015-06-01', daily_screen_time_limit_minutes: 120 },
              { id: 'child-2', name: 'Priya', birth_date: '2018-03-15', daily_screen_time_limit_minutes: 90 },
            ],
          },
        }),
      })
    );

    for (const ep of CHILD_ENDPOINTS) {
      await page.route(`${API}/children/child-1/${ep}*`, (route) =>
        route.fulfill({ status: 200, contentType: 'application/json', body: ok() })
      );
      await page.route(`${API}/children/child-2/${ep}*`, (route) =>
        route.fulfill({ status: 200, contentType: 'application/json', body: ok() })
      );
    }
    await page.route(`${API}/rewards/catalog`, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: ok([]) })
    );
    await page.route(`${API}/integrations`, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: ok([]) })
    );

    await page.getByLabel('Email').fill('parent@example.com');
    await page.getByLabel('Password').fill('Test1234!');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForURL(/\/dashboard/);
  });

  test('displays header with user info and logout', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'SafeGuard' })).toBeVisible();
    await expect(page.getByText('Test Parent')).toBeVisible();
    await expect(page.getByRole('button', { name: /log out/i })).toBeVisible();
  });

  test('shows children section with child buttons', async ({ page }) => {
    await expect(page.getByText('Aarav')).toBeVisible();
    await expect(page.getByText('Priya')).toBeVisible();
  });

  test('shows PIN gate section', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Parent verification' })).toBeVisible();
    await expect(page.getByPlaceholder('PIN')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Unlock' })).toBeVisible();
  });

  test('shows error for incorrect PIN', async ({ page }) => {
    await page.route(`${API}/auth/pin/verify`, (route) =>
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, error: 'Invalid PIN' }),
      })
    );

    await page.getByPlaceholder('PIN').fill('0000');
    await page.getByRole('button', { name: 'Unlock' }).click();
    await expect(page.getByText('Incorrect PIN')).toBeVisible();
  });

  test('unlocks dashboard sections with correct PIN', async ({ page }) => {
    await page.route(`${API}/auth/pin/verify`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { valid: true } }),
      })
    );

    await page.getByPlaceholder('PIN').fill('1234');
    await page.getByRole('button', { name: 'Unlock' }).click();

    await expect(page.getByRole('heading', { name: 'Parent verification' })).not.toBeVisible();
  });

  test('shows screen time section after PIN unlock', async ({ page }) => {
    await page.route(`${API}/auth/pin/verify`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { valid: true } }),
      })
    );

    await page.getByPlaceholder('PIN').fill('1234');
    await page.getByRole('button', { name: 'Unlock' }).click();

    await expect(page.getByRole('heading', { name: 'Parent verification' })).not.toBeVisible();
    await expect(page.getByRole('heading', { name: 'Screen Time' })).toBeVisible();
  });

  test('logs out and redirects to login', async ({ page }) => {
    await page.getByRole('button', { name: /log out/i }).click();
    await page.waitForURL(/\/login/);
    await expect(page.getByRole('heading', { name: 'SafeGuard Parent Portal' })).toBeVisible();
  });
});
