import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { Reporter, TestCase, TestResult } from '@playwright/test/reporter';

/** Write one readable error report per failed test attempt, including retries. */
export default class FailureReporter implements Reporter {
  onTestEnd(test: TestCase, result: TestResult): void {
    if (!['failed', 'timedOut', 'interrupted'].includes(result.status)) return;

    const project = test.parent.project()!;
    const directory = path.join(project.outputDir, 'failures');
    mkdirSync(directory, { recursive: true });
    const title = test.title.replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 80);
    const reportPath = path.join(directory, `${title}-${test.id}-retry-${result.retry}.txt`);
    const screenshots = result.attachments.filter(attachment =>
      attachment.contentType.startsWith('image/') && attachment.path);
    const traces = result.attachments.filter(attachment => attachment.name === 'trace' && attachment.path);
    // Remove terminal color codes so the report is readable in any text editor.
    const errors = result.errors.map(error =>
      (error.stack || error.message || error.value || 'Unknown error')
        .replace(/\u001b\[[0-9;]*m/g, '')).join('\n\n');

    writeFileSync(reportPath, [
      `Test: ${test.titlePath().filter(Boolean).join(' > ')}`,
      `Browser/project: ${project.name}`,
      `Source: ${test.location.file}:${test.location.line}:${test.location.column}`,
      `Status: ${result.status}`,
      `Expected status: ${test.expectedStatus}`,
      `Attempt: ${result.retry + 1}`,
      `Started: ${result.startTime.toISOString()}`,
      `Duration: ${result.duration} ms`,
      '',
      'Error details:',
      errors || 'No error details were provided by Playwright (the run may have been interrupted).',
      '',
      'Screenshots:',
      screenshots.length ? screenshots.map(attachment => attachment.path).join('\n')
        : 'Unavailable: the page may not have opened, may have closed, or screenshot capture may have failed.',
      '',
      'Traces:',
      traces.length ? traces.map(attachment => attachment.path).join('\n') : 'No trace available.',
      '',
    ].join('\n'), 'utf8');

    result.attachments.push({
      name: 'failure-details',
      contentType: 'text/plain',
      path: reportPath,
    });
  }
}
