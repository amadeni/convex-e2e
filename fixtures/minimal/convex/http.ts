import { httpRouter } from 'convex/server';
import { httpAction } from './_generated/server';
import { internal } from './_generated/api';

const http = httpRouter();

http.route({
  path: '/.well-known/openid-configuration',
  method: 'GET',
  handler: httpAction(async (_, request) => {
    const url = new URL(request.url);
    const issuer = `${url.protocol}//${url.host}`;
    return new Response(
      JSON.stringify({
        issuer,
        jwks_uri: `${issuer}/jwks.json`,
        authorization_endpoint: `${issuer}/authorize`,
        token_endpoint: `${issuer}/token`,
        response_types_supported: ['id_token'],
        subject_types_supported: ['public'],
        id_token_signing_alg_values_supported: ['RS256'],
      }),
      { headers: { 'Content-Type': 'application/json' } },
    );
  }),
});

http.route({
  path: '/jwks.json',
  method: 'GET',
  handler: httpAction(async ctx => {
    const jwks = await ctx.runAction(internal.testAuth.getJwks);
    if (!jwks) {
      return new Response('JWKS not configured', { status: 500 });
    }
    return new Response(jwks, {
      headers: { 'Content-Type': 'application/json' },
    });
  }),
});

export default http;
