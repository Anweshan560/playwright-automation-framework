import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { TreatmentsPage } from '../pages/Treatments';


test('user can login to the application', async ({ page }) => {
  const loginPage = new LoginPage(page);

  await loginPage.goto();

  await loginPage.login(
    'anweshan2000+new@gmail.com',
    'Adminanweshan@123'
  );

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
    'anweshan2000+new@gmail.com',
    'Adminanweshan@123'
  );

  await treatmentsPage.goToTreatments();
  await treatmentsPage.createTreatment();

  await page.pause();  
});