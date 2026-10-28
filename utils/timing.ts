import type { APIResponse } from '@playwright/test';

const responseTimes = new WeakMap<APIResponse, number>();

/**
 * Send an API request and remember how long the server took to answer.
 * Only the HTTP call is timed, so preparing headers (e.g. fetching a login token) never counts.
 */
export async function sendTimed(send: () => Promise<APIResponse>): Promise<APIResponse> {
  const start = performance.now();
  const response = await send();
  responseTimes.set(response, Math.round(performance.now() - start));
  return response;
}

/** How long the server took to answer `response`, in milliseconds. */
export function responseTimeMs(response: APIResponse): number {
  const durationMs = responseTimes.get(response);
  if (durationMs === undefined) throw new Error('This response was not sent through sendTimed().');
  return durationMs;
}

/**
 * Send the same request several times in a row and return each response time.
 * One sample is too noisy on a shared test environment; several give a fair picture.
 * Throws if any response is not successful, so a fast error never counts as a fast answer.
 */
export async function measureResponseTimes(
  send: () => Promise<APIResponse>,
  samples: number,
): Promise<number[]> {
  const durations: number[] = [];
  for (let i = 0; i < samples; i++) {
    const response = await send();
    if (!response.ok()) throw new Error(`Request ${i + 1} failed with ${response.status()}`);
    durations.push(responseTimeMs(response));
  }
  return durations;
}

/** The middle value: half the samples were faster, half slower. Ignores single spikes. */
export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}
