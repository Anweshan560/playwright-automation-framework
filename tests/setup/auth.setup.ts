import { test as setup, expect } from '../../fixtures/test';
import { AUTH_FILE, getCredentials } from '../../config/env';

// Runs once before the UI and API tests: log in and save the session,
// so those tests start already logged in instead of logging in every time.
setup('log in and save the session', async ({ page, loginPage }) => {
  const { email, password } = getCredentials();

  await loginPage.open();
  await loginPage.logIn(email, password);
  await expect(page).toHaveURL('/dashboard');

  await page.context().storageState({ path: AUTH_FILE });
});
