import type { APIRequestContext, APIResponse } from '@playwright/test';
import { env } from '../config/env';
import { sendTimed } from '../utils/timing';

/** Clerk's error body: `{ errors: [{ code, message, meta: { param_name } }] }`. */
export type ClerkError = {
  code: string;
  message: string;
  meta?: { param_name?: string };
};

const MAX_RATE_LIMIT_RETRIES = 3;
const MAX_RETRY_WAIT_SECONDS = 10;

/**
 * Login goes through Clerk, not the app's API. This client sends the same Clerk calls the
 * sign-in form makes, directly and without a browser.
 */
export class AuthApi {
  private devBrowserToken: string | undefined;

  constructor(private readonly request: APIRequestContext) {}

  /** Try to sign in with an email and password. Retries if Clerk rate-limits the attempt. */
  async signIn(email: string, password: string): Promise<APIResponse> {
    const url = await this.clerkUrl('/v1/client/sign_ins');
    const send = (): Promise<APIResponse> =>
      sendTimed(() =>
        this.request.post(url, {
          headers: this.headers(),
          form: { strategy: 'password', identifier: email, password },
        }),
      );

    let response = await send();
    for (let attempt = 1; response.status() === 429 && attempt <= MAX_RATE_LIMIT_RETRIES; attempt++) {
      // Not a UI wait: Clerk answered 429 "too many requests" and says how long to back off.
      await sleep(retryAfterSeconds(response, attempt));
      response = await send();
    }
    return response;
  }

  /** Ask a session for an API login token (a JWT that is valid for 60 seconds). */
  async requestSessionToken(sessionId: string): Promise<APIResponse> {
    return this.request.post(await this.clerkUrl(`/v1/client/sessions/${sessionId}/tokens`), {
      headers: this.headers(),
    });
  }

  /** Sign out, so test runs don't pile up active sessions on the account. */
  async signOut(sessionId: string): Promise<APIResponse> {
    return this.request.post(await this.clerkUrl(`/v1/client/sessions/${sessionId}/end`), {
      headers: this.headers(),
    });
  }

  /**
   * Clerk development instances identify each "browser" by a token instead of cookies.
   * Get one on first use and add it to every URL.
   */
  private async clerkUrl(path: string): Promise<string> {
    if (!this.devBrowserToken) {
      const response = await this.request.post(`${env.clerkUrl}/v1/dev_browser`, { headers: this.headers() });
      if (!response.ok()) throw new Error(`Could not start a Clerk dev browser: ${response.status()}`);
      this.devBrowserToken = (await response.json()).token;
    }
    return `${env.clerkUrl}${path}?__clerk_db_jwt=${this.devBrowserToken}`;
  }

  /** Send the app's origin, as the sign-in page in a browser does. */
  private headers(): Record<string, string> {
    return { origin: env.baseUrl };
  }
}

/** Seconds to wait before retrying: Clerk's Retry-After header, capped to stay within test timeouts. */
function retryAfterSeconds(response: APIResponse, attempt: number): number {
  const requested = Number(response.headers()['retry-after']) || 2 * attempt;
  return Math.min(requested, MAX_RETRY_WAIT_SECONDS);
}

function sleep(seconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}
