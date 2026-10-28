import type { Locator, Page } from '@playwright/test';

/** The sign-in page at /auth/sign-in. */
export class LoginPage {
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly loginButton: Locator;
  /** Shown under the email field when no account uses that email. */
  readonly accountNotFoundError: Locator;
  /** Shown under the password field when the password is wrong. */
  readonly incorrectPasswordError: Locator;

  constructor(private readonly page: Page) {
    this.emailInput = page.getByRole('textbox', { name: 'Email address' });
    this.passwordInput = page.getByRole('textbox', { name: 'Password' });
    this.loginButton = page.getByRole('button', { name: 'Log in', exact: true });
    this.accountNotFoundError = page.getByText("Couldn't find your account.");
    this.incorrectPasswordError = page.getByText('Password is incorrect.');
  }

  /** Open the sign-in page. */
  async open(): Promise<void> {
    await this.page.goto('/auth/sign-in');
  }

  /** Fill in the email and password and press "Log in". */
  async logIn(email: string, password: string): Promise<void> {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.loginButton.click();
  }
}
