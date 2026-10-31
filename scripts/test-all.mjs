// Runs the whole suite in two parts:
//   1. every test except Settings → Organization, in parallel
//   2. the Settings → Organization tests, on their own (they change the whole organization)
// Part 2 runs even if part 1 failed, and the exit code is non-zero if either part failed.
// Extra arguments are passed to both parts, e.g. `npm run test:all -- --headed`.
import { spawnSync } from 'node:child_process';

const extraArgs = process.argv.slice(2);

function run(label, args, env = {}) {
  console.log(`\n=== ${label} ===\n`);
  const result = spawnSync('npx', ['playwright', 'test', ...args, ...extraArgs], {
    stdio: 'inherit',
    shell: true, // needed on Windows to find npx
    env: { ...process.env, ...env },
  });
  return result.status ?? 1;
}

const main = run('All tests except Settings → Organization', []);
const organization = run('Settings → Organization (on its own)', ['--project=organization'], {
  ORGANIZATION_TESTS: 'true',
});

process.exit(main || organization);
