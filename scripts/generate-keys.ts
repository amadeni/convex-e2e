import { generateKeyPairSync, createPublicKey } from 'crypto';
import { writeFileSync } from 'fs';
import path from 'path';

const projectRoot = process.env.E2E_PROJECT_ROOT || process.cwd();

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

writeFileSync(path.join(projectRoot, 'test-private.pem'), privateKey);

const pubKeyObj = createPublicKey(publicKey);
const jwk = pubKeyObj.export({ format: 'jwk' });
const jwkWithMeta = { ...jwk, kid: 'test-key-1', alg: 'RS256', use: 'sig' };
const jwks = JSON.stringify({ keys: [jwkWithMeta] });

writeFileSync(path.join(projectRoot, 'test-jwks.json'), jwks);

process.stdout.write('Generated test-private.pem and test-jwks.json\n');
