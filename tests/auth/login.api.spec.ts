import { test, expect } from '../../fixtures/test';
import type { ClerkError } from '../../api/AuthApi';
import { getCredentials } from '../../config/env';
import { buildUnknownEmail, buildWrongPassword } from '../../utils/testData';

// Signed-out requests: the saved session's cookies must not influence a fresh login attempt.
test.use({ storageState: { cookies: [], origins: [] } });

/** The single error in a failed Clerk response. */
async function onlyError(response: { json(): Promise<{ errors?: ClerkError[] }> }): Promise<ClerkError> {
  const { errors } = await response.json();
  expect(errors, 'response should contain exactly one error').toHaveLength(1);
  return errors![0];
}

test.describe('Login API', { tag: '@auth' }, () => {
  // One at a time: Clerk rate-limits sign-in attempts that arrive together.
  test.describe.configure({ mode: 'default' });

  test('should sign in and issue an API token when credentials are valid', async ({ authApi }) => {
    const { email, password } = getCredentials();

    const response = await test.step('sign in with the test account', () => authApi.signIn(email, password));
    const { response: signIn } = await response.json();

    try {
      await test.step('responds 200 with a complete sign-in', () => {
        expect(response.status()).toBe(200);
        expect(signIn.status).toBe('complete');
        expect(signIn.created_session_id).toEqual(expect.any(String));
      });
      await test.step('the new session issues a 60-second API token for itself', async () => {
        const tokenResponse = await authApi.requestSessionToken(signIn.created_session_id);
        expect(tokenResponse.status()).toBe(200);

        const { jwt } = await tokenResponse.json();
        const claims = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString());
        expect(claims.sid).toBe(signIn.created_session_id);
        expect(claims.exp - claims.iat).toBe(60);
      });
    } finally {
      if (signIn?.created_session_id) {
        await test.step('sign out', async () => {
          expect((await authApi.signOut(signIn.created_session_id)).status()).toBe(200);
        });
      }
    }
  });

  test('should reject a valid email with a wrong password', async ({ authApi }) => {
    const { email } = getCredentials();

    const response = await test.step('sign in with a wrong password', () =>
      authApi.signIn(email, buildWrongPassword()));

    await test.step('responds 422 "form_password_incorrect"', async () => {
      expect(response.status()).toBe(422);
      const error = await onlyError(response);
      expect(error.code).toBe('form_password_incorrect');
      expect(error.message).toContain('Password is incorrect.');
    });
  });

  test('should reject an unknown email with a wrong password', async ({ authApi }) => {
    const response = await test.step('sign in with an unknown email and a wrong password', () =>
      authApi.signIn(buildUnknownEmail(), buildWrongPassword()));

    await test.step('responds 422 "form_identifier_not_found" on the email', async () => {
      expect(response.status()).toBe(422);
      const error = await onlyError(response);
      expect(error.code).toBe('form_identifier_not_found');
      expect(error.message).toBe("Couldn't find your account.");
      expect(error.meta?.param_name).toBe('identifier');
    });
  });

  test('should reject an unknown email with the real password', async ({ authApi }) => {
    const { password } = getCredentials();

    const response = await test.step('sign in with an unknown email and the real password', () =>
      authApi.signIn(buildUnknownEmail(), password));

    await test.step('responds 422 "form_identifier_not_found"', async () => {
      expect(response.status()).toBe(422);
      const error = await onlyError(response);
      expect(error.code).toBe('form_identifier_not_found');
      expect(error.message).toBe("Couldn't find your account.");
    });
  });

  test('should reject an empty password', async ({ authApi }) => {
    const { email } = getCredentials();

    const response = await test.step('sign in with an empty password', () => authApi.signIn(email, ''));

    await test.step('responds 422 "form_param_nil" "Enter password."', async () => {
      expect(response.status()).toBe(422);
      const error = await onlyError(response);
      expect(error.code).toBe('form_param_nil');
      expect(error.message).toBe('Enter password.');
    });
  });
});
