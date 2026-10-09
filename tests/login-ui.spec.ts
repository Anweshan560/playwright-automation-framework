
import { test, expect } from '@playwright/test';

test('Replyn login page UI validation', async ({ page }) => {

  await test.step('Step 1: Open Replyn login page', async () => {
    await page.goto('https://beta.replyn.dev/auth/sign-in');
  });

  await test.step('Step 2: Verify email field', async () => {
    await expect(
      page.getByPlaceholder('Enter your email')
    ).toBeVisible();
  });

  await test.step('Step 3: Verify login button text', async () => {
    // INTENTIONAL BUG: expecting the wrong button text
    await expect(
      page.getByRole('button', { name: 'Log in' })
    ).toHaveText('Sign in');
  });

  await test.step('Step 4: Verify password field', async () => {
    await expect(
      page.getByPlaceholder('Enter your password')
    ).toBeVisible();
  });

});