# Replyn Test Suite

End-to-end tests for the [Replyn](https://beta.replyn.dev) clinic app, written with Playwright and TypeScript.
They cover **login** (valid and invalid credentials), managing **doctors** and **treatments** in the UI
(create, edit, delete, required fields, server errors), and the matching **REST and login APIs**.

## Setup

**1. Install** (needs Node.js 20+):

```bash
npm ci
npx playwright install chromium
```

**2. Configure:** copy `.env.example` to `.env` and fill in the test account:

```text
TEST_USERNAME=your-test-account@example.com
TEST_PASSWORD=your-password
```

Everything else in `.env.example` is optional and defaults to the beta environment.
`.env` is git-ignored, so never commit it. On CI the GitHub secrets `SECRETU` and `SECRETP` provide the account.

**3. Run:**

| What                                          | Command                                                           |
| --------------------------------------------- | ----------------------------------------------------------------- |
| Everything, including Settings → Organization | `npm run test:all`                                                |
| Everything except Settings → Organization     | `npm test`                                                        |
| Smoke test only (is the app up?)              | `npm run test:smoke`                                              |
| UI tests only / API tests only                | `npm run test:ui` / `npm run test:api`                            |
| Login                                         | `npm run test:login`                                              |
| All of Clinic                                 | `npm run test:clinic`                                             |
| One Clinic feature                            | `npm run test:doctors` (or `test:treatments`, `test:departments`) |
| Clinic → Appointments / Billing               | `npm run test:appointments` / `npm run test:billing`              |
| All of Settings (except Organization)         | `npm run test:settings`                                           |
| Settings → Members                            | `npm run test:members`                                            |
| Settings → Organization (runs on its own)     | `npm run test:organization`                                       |
| Contacts                                      | `npm run test:contacts`                                           |
| One file                                      | `npx playwright test tests/clinic/doctors/doctors.spec.ts`        |
| One test, by name                             | `npx playwright test -g "when user deletes it"`                   |
| Headless (no browser window)                  | `npm run test:headless`                                           |
| Headed (watch the browser)                    | `npm run test:headed`                                             |
| UI mode (pick, re-run and debug tests)        | `npm run test:debug`                                              |
| Type-check / format                           | `npm run typecheck` / `npm run format`                            |

Locally the browser window is visible by default. `test:headless` hides it, and accepts the same
options: `npm run test:headless -- tests/clinic/doctors`. You can also set `HEADLESS=true` in `.env`.

**Why Settings → Organization runs on its own:** those tests change the real organization, and some
changes affect the whole app (switching the organization type to E-commerce hides the Clinic menu).
They run only through `npm run test:organization` or `npm run test:all`, one test at a time, and every
test restores the original values. In any other run they show as _skipped_, with that reason.

Every run starts with `tests/setup/auth.setup.ts`, which logs in once and saves the session for the other tests.

## Folder structure

| Folder                    | What's in it                                                                                  |
| ------------------------- | --------------------------------------------------------------------------------------------- |
| `tests/auth/`             | Login: UI (`login.spec.ts`) and API (`login.api.spec.ts`).                                    |
| `tests/clinic/<feature>/` | Doctors, Treatments, Departments, Appointments, Billing: UI and API tests side by side.       |
| `tests/settings/<page>/`  | Settings → Organization (General) and Members: UI and API tests side by side.                 |
| `tests/contacts/`         | Contacts: list, create, row actions, side panel and segments (UI), and the contacts API.      |
| `tests/setup/`            | Logs in once before the other tests and saves the session.                                    |
| `pages/`                  | Page objects (`auth/`, `clinic/`, `settings/`, `contacts/`): _how_ to use each page.          |
| `api/`                    | API clients: one small class per endpoint group, plus the field-name mapping to the UI forms. |
| `fixtures/`               | The `test` that every spec imports, ready-made with page objects, API clients and cleanup.    |
| `config/`                 | `env.ts`: the only place that reads `.env` (URLs, credentials, limits).                       |
| `utils/`                  | Helpers: Faker test data, network recording/mocking, response timing.                         |
| `reporters/`              | Writes a screenshot and plain-text summary of every failed test to `test-results/failures/`.  |
| `scripts/`                | `test-all.mjs`: runs the suite, then Settings → Organization on its own.                      |
| `.github/`                | CI: smoke test, then the full suite, then Settings → Organization, on every push and PR.      |

File names decide how a test runs: `*.api.spec.ts` runs in the `api` project, other `*.spec.ts` files in `ui`.

**Known app issues are marked with `test.fail()`.** Such a test checks the behaviour we expect, and its
reason says what the app does instead and when it was seen. It passes while the issue is there, and fails
(on purpose) once the app is fixed: then delete the `test.fail()` line.

## Adding a test

Import `test` and `expect` from `fixtures/test` (not from `@playwright/test`), ask for the page objects and
clients you need, and describe the behaviour with `test.step()`:

```ts
import { test, expect } from '../../fixtures/test';
import { toDoctorPayload } from '../../api/DoctorsApi';
import { buildDoctor } from '../../utils/testData';

test('should show a new doctor in the doctors list', async ({ doctorsPage, doctorsApi, cleanup }) => {
  // 1. Arrange: create the data this test needs (the API is the fastest way).
  const doctor = await test.step('create a doctor', () =>
    doctorsApi.createRecord(toDoctorPayload(buildDoctor())));
  // 2. Always register cleanup, so the test leaves nothing behind even if it fails.
  cleanup.add(`doctor "${doctor.name}"`, () => doctorsApi.deleteIfExists(doctor.id));

  // 3. Act and assert.
  await test.step('open the doctors list', () => doctorsPage.openList());
  await test.step('the doctor is listed', async () => {
    await expect(doctorsPage.rowFor(doctor.name)).toBeVisible();
  });
});
```

Guidelines:

- **Name tests like sentences:** `should <expected result> when <action>`.
- **Locators belong in page objects.** Prefer `getByRole` > `getByLabel` > `getByPlaceholder` > `getByText` > `getByTestId`.
  Use CSS only when nothing else works, and add a comment explaining why.
- **Never use `waitForTimeout`.** Use `expect(...)` (which retries) or wait for a specific API response
  (`waitForApiResponse` in `utils/network.ts`).
- **Every test creates its own data** with `utils/testData.ts` and cleans it up with `cleanup.add()`.
- A new page? Add a class in `pages/`, register it in `fixtures/test.ts`, and give every public method a short JSDoc.

## Viewing the report

After any run:

```bash
npm run report
```

This opens the HTML report: each test with its steps, and for failures a screenshot, a trace you can
step through, and the error. On CI, download the `smoke-report` / `regression-report` artifact from the
workflow run, unzip it, and run `npx playwright show-report <folder>`.

### Failure screenshots

Every failed test also gets a screenshot and a plain-text summary in `test-results/failures/`, named after
**where** it failed: `<feature folder>__<test name>__<project>__attempt-<n>`. For example:

```text
test-results/failures/
  clinic-doctors__should-save-every-field-when-user-creates-a-doctor__ui__attempt-1.png
  clinic-doctors__should-save-every-field-when-user-creates-a-doctor__ui__attempt-1.txt
```

The `.txt` file holds the error, the test's file and line, and the path of its trace. On CI these are inside the
`*-test-results` artifact. Passing `--reporter=...` on the command line replaces the configured reporters, so
leave it out if you want these files.
