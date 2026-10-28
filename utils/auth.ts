/** Where the logged-in session is saved by tests/auth.setup.ts. */
export const AUTH_FILE = 'playwright/.auth/user.json';

/** Read the test account from the environment, failing only the test that needs it. */
export function getCredentials(): { username: string; password: string } {
  const username = process.env.TEST_USERNAME;
  const password = process.env.TEST_PASSWORD;
  if (!username || !password) {
    throw new Error('TEST_USERNAME and TEST_PASSWORD must be set in .env');
  }
  return { username, password };
}
