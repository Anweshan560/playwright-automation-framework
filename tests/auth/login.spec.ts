import { test, expect } from '../../fixtures/test';
import { getCredentials } from '../../config/env';
import { buildUnknownEmail, buildWrongPassword } from '../../utils/testData';

// Start logged out, to exercise the real sign-in form.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Login', { tag: '@auth' }, () => {
  test(
    'should open the dashboard when user logs in with valid credentials',
    { tag: '@smoke' },
    async ({ page, loginPage }) => {
      const { email, password } = getCredentials();

      await test.step('open the sign-in page', () => loginPage.open());
      await test.step('log in with the test account', () => loginPage.logIn(email, password));
      await test.step('the dashboard opens', async () => {
        await expect(page).toHaveURL('/dashboard');
      });
    },
  );

  test('should show "Password is incorrect" when user enters a wrong password', async ({
    page,
    loginPage,
  }) => {
    const { email } = getCredentials();

    await test.step('open the sign-in page', () => loginPage.open());
    await test.step('log in with a wrong password', () => loginPage.logIn(email, buildWrongPassword()));
    await test.step('the password field shows the error and the user stays on sign-in', async () => {
      await expect(loginPage.incorrectPasswordError).toBeVisible();
      await expect(loginPage.passwordInput).toHaveAttribute('aria-invalid', 'true');
      await expect(loginPage.emailInput).not.toHaveAttribute('aria-invalid', 'true');
      await expect(page).toHaveURL('/auth/sign-in');
    });
  });

  test('should show "Couldn\'t find your account" when both email and password are wrong', async ({
    page,
    loginPage,
  }) => {
    await test.step('open the sign-in page', () => loginPage.open());
    await test.step('log in with an unknown email and a wrong password', () =>
      loginPage.logIn(buildUnknownEmail(), buildWrongPassword()));
    await test.step('the email field shows the error and the user stays on sign-in', async () => {
      await expect(loginPage.accountNotFoundError).toBeVisible();
      await expect(loginPage.emailInput).toHaveAttribute('aria-invalid', 'true');
      await expect(page).toHaveURL('/auth/sign-in');
    });
  });

  test('should show "Couldn\'t find your account" when the email is not registered', async ({
    page,
    loginPage,
  }) => {
    const { password } = getCredentials();

    await test.step('open the sign-in page', () => loginPage.open());
    await test.step('log in with an unknown email and the real password', () =>
      loginPage.logIn(buildUnknownEmail(), password));
    await test.step('the email field shows the error and the user stays on sign-in', async () => {
      await expect(loginPage.accountNotFoundError).toBeVisible();
      await expect(loginPage.emailInput).toHaveAttribute('aria-invalid', 'true');
      await expect(page).toHaveURL('/auth/sign-in');
    });
  });
});
