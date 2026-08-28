import { test, expect } from '@playwright/test';

test.describe('Login Page', () => {
  test('renders login form with all elements', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Kavach Parent Portal' })).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Forgot your password?' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Create an account' })).toBeVisible();
  });

  test('shows validation errors on empty submit', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page.getByText('Email is required')).toBeVisible();
    await expect(page.getByText('Password is required')).toBeVisible();
  });

  test('shows validation error for invalid email', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('not-an-email');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page.getByText('Invalid email format')).toBeVisible();
  });

  test('shows validation error for short password', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('user@example.com');
    await page.getByLabel('Password').fill('123');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page.getByText('Password must be at least 8 characters')).toBeVisible();
  });

  test('shows error message for wrong credentials', async ({ page }) => {
    await page.goto('/login');

    await page.route('**/api/v1/auth/login', (route) =>
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Invalid credentials' }),
      })
    );

    await page.getByLabel('Email').fill('user@example.com');
    await page.getByLabel('Password').fill('WrongPass123!');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page.getByRole('alert')).toBeVisible();
  });

  test('navigates to register page', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('link', { name: 'Create an account' }).click();
    await expect(page).toHaveURL(/\/register/);
    await expect(page.getByRole('heading', { name: 'Create Parent Account' })).toBeVisible();
  });

  test('navigates to forgot password page', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('link', { name: 'Forgot your password?' }).click();
    await expect(page).toHaveURL(/\/forgot-password/);
    await expect(page.getByRole('heading', { name: 'Reset Password' })).toBeVisible();
  });
});

test.describe('Register Page', () => {
  test('renders register form with all elements', async ({ page }) => {
    await page.goto('/register');
    await expect(page.getByRole('heading', { name: 'Create Parent Account' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Name', exact: true })).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByText("First Child's Name")).toBeVisible();
    await expect(page.getByText('Birth Date')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create Account' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible();
  });

  test('shows validation errors on empty submit', async ({ page }) => {
    await page.goto('/register');
    await page.getByRole('button', { name: 'Create Account' }).click();
    await expect(page.getByText('Name is required')).toBeVisible();
    await expect(page.getByText('Email is required')).toBeVisible();
    await expect(page.getByText('Password is required')).toBeVisible();
  });

  test('shows validation error for short name', async ({ page }) => {
    await page.goto('/register');
    await page.getByRole('textbox', { name: 'Name', exact: true }).fill('A');
    await page.getByRole('button', { name: 'Create Account' }).click();
    await expect(page.getByText('Name must be at least 2 characters')).toBeVisible();
  });

  test('shows validation error for invalid email', async ({ page }) => {
    await page.goto('/register');
    await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Test User');
    await page.getByLabel('Email').fill('bad-email');
    await page.getByRole('button', { name: 'Create Account' }).click();
    await expect(page.getByText('Invalid email format')).toBeVisible();
  });

  test('shows validation error for short password', async ({ page }) => {
    await page.goto('/register');
    await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Test User');
    await page.getByLabel('Email').fill('test@example.com');
    await page.getByLabel('Password').fill('123');
    await page.getByRole('button', { name: 'Create Account' }).click();
    await expect(page.getByText('Password must be at least 8 characters')).toBeVisible();
  });

  test('shows server error on failed registration', async ({ page }) => {
    await page.goto('/register');

    await page.route('**/api/v1/auth/register', (route) =>
      route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Email already in use' }),
      })
    );

    await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Test User');
    await page.getByLabel('Email').fill('existing@example.com');
    await page.getByLabel('Password').fill('Test1234!');
    await page.getByRole('button', { name: 'Create Account' }).click();
    await expect(page.getByRole('alert')).toBeVisible();
  });

  test('navigates to login page', async ({ page }) => {
    await page.goto('/register');
    await page.getByRole('link', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe('Forgot Password Page', () => {
  test('renders forgot password form', async ({ page }) => {
    await page.goto('/forgot-password');
    await expect(page.getByRole('heading', { name: 'Reset Password' })).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Send Reset Link' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible();
  });

  test('shows success message after submission', async ({ page }) => {
    await page.goto('/forgot-password');

    await page.route('**/api/v1/auth/forgot-password', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Reset link sent' }),
      })
    );

    await page.getByLabel('Email').fill('user@example.com');
    await page.getByRole('button', { name: 'Send Reset Link' }).click();
    await expect(page.getByRole('status')).toBeVisible();
  });

  test('shows error on failed submission', async ({ page }) => {
    await page.goto('/forgot-password');

    await page.route('**/api/v1/auth/forgot-password', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Server error' }),
      })
    );

    await page.getByLabel('Email').fill('user@example.com');
    await page.getByRole('button', { name: 'Send Reset Link' }).click();
    await expect(page.getByRole('alert')).toBeVisible();
  });

  test('navigates to login page', async ({ page }) => {
    await page.goto('/forgot-password');
    await page.getByRole('link', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/login/);
  });
});
