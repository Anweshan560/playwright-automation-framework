# Playwright Automation Framework

## Overview

This repository contains a UI test automation framework built with Playwright and TypeScript. It uses the Page Object Model (POM) to organize page interactions and GitHub Actions to run tests automatically.

## Tech Stack

- Playwright Test
- TypeScript
- Node.js and npm
- GitHub Actions
- Page Object Model (POM)

## Project Structure

```text
.
├── .github/
│   └── workflows/
│       └── playwright.yml      # CI: smoke job, then regression job
├── pages/                      # Page objects
│   ├── LoginPage.ts
│   └── Treatments.ts
├── reporters/
│   └── failure-reporter.ts     # Writes a readable .txt per failed test
├── tests/
│   ├── auth.setup.ts           # Logs in once and saves the session
│   ├── login.spec.ts           # @smoke: login through the UI
│   └── treatments.spec.ts      # Creates a treatment, then deletes it
├── utils/
│   └── auth.ts                 # Credentials and saved-session path
├── .env.example
├── playwright.config.ts
├── package.json
├── tsconfig.json
└── README.md
```

## Prerequisites

- Node.js 20 or a compatible version
- npm
- Git

## Installation

Clone the repository and enter the project directory:

```bash
git clone <your-repository-url>
cd <your-project-directory>
npm ci
npx playwright install
```

## Environment Variables

Copy `.env.example` to `.env` in the project root and fill it in:

```text
BASE_URL=                  # optional, defaults to https://beta.replyn.dev
TEST_USERNAME=your-test-username
TEST_PASSWORD=your-test-password
```

`playwright.config.ts` loads `.env` automatically. `.env` is git-ignored; never commit real credentials.

For GitHub Actions, the repository secrets `SECRETU` and `SECRETP` are mapped to `TEST_USERNAME` and `TEST_PASSWORD` in the workflow.

## Running Tests

Run the complete test suite:

```bash
npx playwright test
```

Run smoke tests:

```bash
npm run test:smoke
```

Run the full regression suite:

```bash
npm run test:regression
```

Run tests in headed mode locally:

```bash
npx playwright test --headed
```

Type-check the project:

```bash
npm run typecheck
```

## How the Suite Is Organised

- **`setup` project** (`tests/auth.setup.ts`) logs in once and saves the session to `playwright/.auth/user.json`.
- **`chromium` project** (regression) depends on `setup` and reuses that session, so tests start already logged in.
- **`smoke` project** runs tests tagged `@smoke` (`test('...', { tag: '@smoke' }, ...)`). The login smoke test starts logged out on purpose.
- Tests that create data delete it afterwards, so beta does not fill up with test records.
- Locally, browsers run headed with `slowMo` so you can watch; on CI they run headless at full speed, and `test.only` fails the build.

## Page Object Model

Page objects keep locators and page actions separate from test scenarios.

For example, `LoginPage.ts` encapsulates the login page's locators and login actions. Tests use the page object to perform login rather than duplicating those actions in every test.

## Continuous Integration

GitHub Actions runs the Playwright suite when changes are pushed to, or a pull request targets, the configured branch.

The workflow:

1. Checks out the repository.
2. Sets up Node.js.
3. Installs dependencies.
4. Installs Playwright browsers.
5. Runs the smoke and regression jobs.
6. Uploads available test reports and results.

## Debugging Failures

1. Open the repository's **Actions** tab.
2. Select the failed workflow run.
3. Inspect the failed job's logs.
4. Download available artifacts, such as the HTML report, screenshots, and traces.
5. Reproduce the failure locally and verify the fix.

Each failed test also gets a plain-text summary (error, screenshot and trace paths) in `test-results/failures/`.

To view a locally generated HTML report:

```bash
npx playwright show-report
```

## Current Scope

The framework covers traditional UI automation fundamentals, including:

- Page Object Model
- Reusable test steps and assertions
- Environment-based configuration
- Smoke and regression test execution
- CI execution and failure artifacts

## Future Improvements

- Expand cross-browser coverage.
- Add API and UI integration tests.
- Improve test data isolation.
- Add more resilient tests for complex workflows.
- Explore AI-assisted test generation and validation.