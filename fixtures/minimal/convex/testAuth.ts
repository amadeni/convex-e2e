'use node';

import { internalAction } from './_generated/server';
import { v } from 'convex/values';
import { createSign } from 'crypto';

function base64url(input: string): string {
  return Buffer.from(input).toString('base64url');
}

function signJwt(
  payload: Record<string, unknown>,
  privateKeyPem: string,
): string {
  const header = { alg: 'RS256', typ: 'JWT', kid: 'test-key-1' };
  const segments = [
    base64url(JSON.stringify(header)),
    base64url(JSON.stringify(payload)),
  ];
  const signingInput = segments.join('.');

  const sign = createSign('RSA-SHA256');
  sign.update(signingInput);
  const signature = sign.sign(privateKeyPem, 'base64url');

  return `${signingInput}.${signature}`;
}

export const getJwks = internalAction({
  args: {},
  handler: async () => {
    return process.env.JWKS ?? null;
  },
});

export const createTestSession = internalAction({
  args: { email: v.string() },
  handler: async (_ctx, args) => {
    const privateKey = process.env.JWT_PRIVATE_KEY;
    if (!privateKey) {
      throw new Error('JWT_PRIVATE_KEY env var not set');
    }

    const now = Math.floor(Date.now() / 1000);
    const userId = `user-${args.email.split('@')[0]}`;

    const token = signJwt(
      {
        sub: userId,
        email: args.email,
        iat: now,
        exp: now + 3600,
        iss: 'http://127.0.0.1:3211',
        aud: 'convex',
      },
      privateKey,
    );

    return { userId, token };
  },
});
