import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { getCredentials } from '../utils/auth';

// Starts logged out so it exercises the real login form.
test.use({ storageState: { cookies: [], origins: [] } });

test('user can login to the application', { tag: '@smoke' }, async ({ page }) => {
  const { username, password } = getCredentials();
  const loginPage = new LoginPage(page);

  await loginPage.goto();
  await loginPage.login(username, password);

  await expect(page).toHaveURL('/dashboard');
});
