import { test, expect } from '@playwright/test';

const API = '**/api/v1';

test.describe('Route Protection', () => {
  test('redirects unauthenticated user from /dashboard to /login', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForURL(/\/login/);
    await expect(page).toHaveURL(/\/login/);
  });

  test('redirects unauthenticated user from /settings to /login', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForURL(/\/login/);
    await expect(page).toHaveURL(/\/login/);
  });

  test('shows 404 page for unknown routes', async ({ page }) => {
    await page.goto('/nonexistent-page');
    await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
    await expect(page.getByText("The page you're looking for doesn't exist")).toBeVisible();
    await expect(page.getByRole('link', { name: 'Go to Dashboard' })).toBeVisible();
  });

  test('404 page link navigates to login when unauthenticated', async ({ page }) => {
    await page.goto('/nonexistent-page');
    await page.getByRole('link', { name: 'Go to Dashboard' }).click();
    await page.waitForURL(/\/login/);
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe('Login Page Navigation', () => {
  test('login page renders with correct layout', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('text=Keeping children safe online')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Create an account' })).toHaveAttribute('href', '/register');
    await expect(page.getByRole('link', { name: 'Forgot your password?' })).toHaveAttribute('href', '/forgot-password');
  });
});

test.describe('Register Page Navigation', () => {
  test('register page renders with correct layout', async ({ page }) => {
    await page.goto('/register');
    await expect(page.locator('text=Keeping children safe online')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
  });
});

test.describe('Forgot Password Page Navigation', () => {
  test('forgot password page renders with correct layout', async ({ page }) => {
    await page.goto('/forgot-password');
    await expect(page.getByRole('heading', { name: 'Reset Password' })).toBeVisible();
    await expect(page.getByText("Enter your email address and we'll send you a link to reset your password.")).toBeVisible();
    await expect(page.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
  });
});

test.describe('Authenticated Dashboard Access', () => {
  test('allows authenticated user to access dashboard', async ({ page }) => {
    await page.goto('/login');

    await page.route(`${API}/auth/login`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            token: 'mock-access-token',
            user: { id: '1', name: 'Test User', email: 'test@example.com', role: 'parent' },
            child: null,
          },
        }),
      })
    );

    await page.route(`${API}/auth/refresh-token`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { token: 'mock-access-token' } }),
      })
    );

    await page.route(`${API}/children`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { children: [] } }),
      })
    );

    await page.getByLabel('Email').fill('test@example.com');
    await page.getByLabel('Password').fill('Test1234!');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForURL(/\/dashboard/);
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('allows authenticated user to access settings', async ({ page }) => {
    await page.goto('/login');

    await page.route(`${API}/auth/login`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            token: 'mock-access-token',
            user: { id: '1', name: 'Test User', email: 'test@example.com', role: 'parent' },
            child: null,
          },
        }),
      })
    );

    await page.route(`${API}/auth/refresh-token`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { token: 'mock-access-token' } }),
      })
    );

    await page.route(`${API}/children`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { children: [] } }),
      })
    );

    await page.getByLabel('Email').fill('test@example.com');
    await page.getByLabel('Password').fill('Test1234!');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForURL(/\/dashboard/);

    await page.goto('/settings');
    await expect(page).toHaveURL(/\/settings/);
  });
});
