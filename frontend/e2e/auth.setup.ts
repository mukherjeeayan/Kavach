import { test as base, expect } from '@playwright/test';

export const test = base.extend<{ registeredEmail: string; registeredPassword: string }>({
  registeredEmail: async ({}, use) => {
    await use(`test-${Date.now()}@example.com`);
  },
  registeredPassword: async ({}, use) => {
    await use('Test1234!');
  },
});

export { expect };
