import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { Reporter, TestCase, TestResult } from '@playwright/test/reporter';

type Attachment = TestResult['attachments'][number];

/** Lower-case words joined by dashes, safe for file names on every OS. */
function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * A readable file name that says where the failure happened, e.g.
 * "clinic-doctors__should-save-every-field-when-user-creates-a-doctor__ui__attempt-1".
 */
function failureName(test: TestCase, result: TestResult): string {
  const project = test.parent.project()!;
  // The feature folder, e.g. tests/clinic/doctors -> "clinic-doctors".
  const folder = path.relative(project.testDir, path.dirname(test.location.file));
  const area =
    slug(folder) || slug(path.basename(test.location.file).replace(/\.(api\.)?spec\.ts$|\.ts$/, ''));
  // Keep the whole name well under the 255-character file-name limit.
  return [area, slug(test.title).slice(0, 120), slug(project.name), `attempt-${result.retry + 1}`]
    .filter(Boolean)
    .join('__');
}

/**
 * For every failed test attempt (retries included), write to test-results/failures/:
 * - `<name>.txt`: the error, where the test lives, and the paths of its screenshot and trace
 * - `<name>.png`: a copy of the failure screenshot, named after the test
 * Playwright's own screenshot names are shortened and end in a random hash; these say where it failed.
 */
export default class FailureReporter implements Reporter {
  onTestEnd(test: TestCase, result: TestResult): void {
    if (!['failed', 'timedOut', 'interrupted'].includes(result.status)) return;

    const project = test.parent.project()!;
    const directory = path.join(project.outputDir, 'failures');
    mkdirSync(directory, { recursive: true });
    const name = failureName(test, result);

    const screenshots = result.attachments.filter(
      (attachment) => attachment.contentType.startsWith('image/') && attachment.path,
    );
    const namedScreenshots = this.copyScreenshots(screenshots, directory, name);
    const traces = result.attachments.filter((attachment) => attachment.name === 'trace' && attachment.path);
    const reportPath = path.join(directory, `${name}.txt`);

    writeFileSync(reportPath, this.report(test, result, namedScreenshots, traces), 'utf8');
    result.attachments.push({ name: 'failure-details', contentType: 'text/plain', path: reportPath });
  }

  /** Copy each screenshot next to the report under the readable name; returns the new paths. */
  private copyScreenshots(screenshots: Attachment[], directory: string, name: string): string[] {
    return screenshots.map((screenshot, index) => {
      const extension = path.extname(screenshot.path!) || '.png';
      // Most failures have one screenshot; number any extra ones.
      const target = path.join(directory, `${name}${index ? `-${index + 1}` : ''}${extension}`);
      copyFileSync(screenshot.path!, target);
      return target;
    });
  }

  /** The plain-text failure summary. */
  private report(test: TestCase, result: TestResult, screenshots: string[], traces: Attachment[]): string {
    // Remove terminal colour codes so the report is readable in any text editor.
    const errors = result.errors
      .map((error) =>
        (error.stack || error.message || error.value || 'Unknown error').replace(/\u001b\[[0-9;]*m/g, ''),
      )
      .join('\n\n');

    return [
      `Test: ${test.titlePath().filter(Boolean).join(' > ')}`,
      `Project: ${test.parent.project()!.name}`,
      `Source: ${test.location.file}:${test.location.line}:${test.location.column}`,
      `Status: ${result.status}`,
      `Attempt: ${result.retry + 1}`,
      `Started: ${result.startTime.toISOString()}`,
      `Duration: ${result.duration} ms`,
      '',
      'Error details:',
      errors || 'No error details were provided by Playwright (the run may have been interrupted).',
      '',
      'Screenshots:',
      screenshots.length
        ? screenshots.join('\n')
        : 'None: API-only tests have no page, or the page closed before the screenshot.',
      '',
      'Traces (open with: npx playwright show-trace <path>):',
      traces.length ? traces.map((attachment) => attachment.path).join('\n') : 'No trace available.',
      '',
    ].join('\n');
  }
}
