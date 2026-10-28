import 'dotenv/config';

/**
 * Everything the suite reads from the environment: `.env` locally, repository secrets on CI.
 * Defaults point at the beta environment so only credentials are mandatory.
 */
export const env = {
  /** The web app under test. */
  baseUrl: process.env.BASE_URL || 'https://beta.replyn.dev',
  /** The app's REST API. */
  apiUrl: process.env.API_URL || 'https://api.replyn.dev',
  /** Clerk, the service that handles login. Public: it is in the app's own sign-in page. */
  clerkUrl: process.env.CLERK_URL || 'https://expert-albacore-78.clerk.accounts.dev',
  /** Sent as `x-tenant-id` on every API call. */
  tenantId: process.env.TENANT_ID || 'replyn',
  /**
   * Slowest acceptable API response. Normal responses take 100–300 ms; the budget leaves
   * room for network noise so the check only fails on a real slowdown.
   */
  apiResponseBudgetMs: Number(process.env.API_RESPONSE_BUDGET_MS) || 3000,
} as const;

/** Where tests/setup/auth.setup.ts saves the logged-in browser session. */
export const AUTH_FILE = 'playwright/.auth/user.json';

/** Login details of the test account. */
export type Credentials = {
  email: string;
  password: string;
};

/**
 * Read the test account from the environment.
 * Throws inside the test that needs it, so other tests still run when it is missing.
 */
export function getCredentials(): Credentials {
  const email = process.env.TEST_USERNAME;
  const password = process.env.TEST_PASSWORD;
  if (!email || !password) {
    throw new Error('TEST_USERNAME and TEST_PASSWORD must be set in .env');
  }
  return { email, password };
}
