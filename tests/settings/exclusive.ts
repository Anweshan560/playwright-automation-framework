import { test } from '../../fixtures/test';
import { env } from '../../config/env';

/**
 * Call inside a test.describe whose tests change settings the other tests rely on (hours,
 * lifecycle stages, assignment rules, AI, the workspace itself). They are skipped unless they run
 * on their own: `npm run test:exclusive`, or last in `npm run test:all`.
 */
export function runOnlyOnItsOwn(): void {
  test.skip(
    !env.runExclusiveTests,
    'Changes settings other tests rely on, so it must run on its own: npm run test:exclusive',
  );
}
