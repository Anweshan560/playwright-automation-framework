import { test as base } from '@playwright/test';
import { AuthApi } from '../api/AuthApi';
import { DepartmentsApi } from '../api/DepartmentsApi';
import { DoctorsApi } from '../api/DoctorsApi';
import type { HeadersProvider } from '../api/ResourceApi';
import { TreatmentsApi } from '../api/TreatmentsApi';
import { env } from '../config/env';
import { LoginPage } from '../pages/auth/LoginPage';
import { DepartmentsPage } from '../pages/clinic/DepartmentsPage';
import { DoctorsPage } from '../pages/clinic/DoctorsPage';
import { TreatmentsPage } from '../pages/clinic/TreatmentsPage';

/** Collects clean-up actions and runs them after the test, even when the test failed. */
export type Cleanup = {
  add(description: string, action: () => Promise<void>): void;
};

type Fixtures = {
  loginPage: LoginPage;
  doctorsPage: DoctorsPage;
  treatmentsPage: TreatmentsPage;
  departmentsPage: DepartmentsPage;
  /** Headers for the app's API: a fresh login token plus the tenant and workspace IDs. */
  apiHeaders: HeadersProvider;
  doctorsApi: DoctorsApi;
  treatmentsApi: TreatmentsApi;
  departmentsApi: DepartmentsApi;
  /** Clerk login calls. Needs no browser and no saved session. */
  authApi: AuthApi;
  cleanup: Cleanup;
};

/**
 * The `test` every spec imports. On top of Playwright's built-ins it provides ready-made
 * page objects, API clients and automatic cleanup, so tests only describe behaviour.
 */
export const test = base.extend<Fixtures>({
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },

  doctorsPage: async ({ page }, use) => {
    await use(new DoctorsPage(page));
  },

  treatmentsPage: async ({ page }, use) => {
    await use(new TreatmentsPage(page));
  },

  departmentsPage: async ({ page }, use) => {
    await use(new DepartmentsPage(page));
  },

  apiHeaders: async ({ page }, use) => {
    // The saved session logs the browser in. Open the app once to read the workspace ID from
    // its own API calls, and to reach Clerk, which hands out login tokens.
    const firstApiCall = page.waitForRequest(
      (request) => request.url().startsWith(env.apiUrl) && !!request.headers()['x-workspace-id'],
    );
    await page.goto('/dashboard');
    const workspaceId = (await firstApiCall).headers()['x-workspace-id'];
    await page.waitForFunction(() => (window as any).Clerk?.session);

    await use(async () => ({
      // Tokens expire after 60 seconds, so ask Clerk on every request. It caches them, so this is fast.
      authorization: `Bearer ${await page.evaluate(() => (window as any).Clerk.session.getToken())}`,
      'x-tenant-id': env.tenantId,
      'x-workspace-id': workspaceId,
    }));
  },

  doctorsApi: async ({ request, apiHeaders }, use) => {
    await use(new DoctorsApi(request, apiHeaders));
  },

  treatmentsApi: async ({ request, apiHeaders }, use) => {
    await use(new TreatmentsApi(request, apiHeaders));
  },

  departmentsApi: async ({ request, apiHeaders }, use) => {
    await use(new DepartmentsApi(request, apiHeaders));
  },

  authApi: async ({ request }, use) => {
    await use(new AuthApi(request));
  },

  // Depends on `request` and `apiHeaders` so both are still available while cleanup runs.
  cleanup: async ({ request: _request, apiHeaders: _apiHeaders }, use) => {
    const actions: { description: string; action: () => Promise<void> }[] = [];
    await use({ add: (description, action) => actions.push({ description, action }) });

    for (const { description, action } of actions.reverse()) {
      try {
        await action();
      } catch (error) {
        // Warn instead of failing: the test result should reflect the behaviour under test.
        console.warn(`Cleanup failed (${description}) - remove it manually.`, error);
      }
    }
  },
});

export { expect } from '@playwright/test';
