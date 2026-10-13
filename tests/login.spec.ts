import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { TreatmentsPage } from '../pages/Treatments';

const username = process.env.TEST_USERNAME;
const password = process.env.TEST_PASSWORD;
if (!username || !password) {
  throw new Error('TEST_USERNAME and TEST_PASSWORD must be set in .env');
}


test('[@smoke] user can login to the application', async ({ page }) => {
  const loginPage = new LoginPage(page);

  await loginPage.goto();
  await loginPage.login(username, password);

  await expect(page).toHaveURL(
    'https://beta.replyn.dev/dashboard'
  );

  await page.pause();
});

test('User can navigate to Treatments', async ({ page }) => {
  const loginPage = new LoginPage(page);
  const treatmentsPage = new TreatmentsPage(page);

  await loginPage.goto();

  await loginPage.login(
    username,
    password
  );

  await treatmentsPage.goToTreatments();
  await treatmentsPage.createTreatment();

  await page.pause();
});