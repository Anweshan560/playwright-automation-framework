import { test as setup, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { AUTH_FILE, getCredentials } from '../utils/auth';

setup('log in and save session', async ({ page }) => {
  const { username, password } = getCredentials();
  const loginPage = new LoginPage(page);

  await loginPage.goto();
  await loginPage.login(username, password);
  await expect(page).toHaveURL('/dashboard');

  await page.context().storageState({ path: AUTH_FILE });
});
