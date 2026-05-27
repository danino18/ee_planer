/**
 * Set or remove the admin custom claim on a Firebase user.
 *
 * Usage:
 *   npm run set-admin -- <uid-or-email>          # grant admin
 *   npm run set-admin -- <uid-or-email> --revoke  # revoke admin
 *
 * Requires service-account.json at the project root (or GOOGLE_APPLICATION_CREDENTIALS).
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SA_PATH = path.join(ROOT, 'service-account.json');

if (!getApps().length) {
  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS ?? SA_PATH;
  initializeApp({ credential: cert(credPath) });
}

const auth = getAuth();

async function resolveUid(identifier: string): Promise<string> {
  if (identifier.includes('@')) {
    const user = await auth.getUserByEmail(identifier);
    return user.uid;
  }
  return identifier;
}

async function main() {
  const args = process.argv.slice(2);
  const identifier = args.find((a) => !a.startsWith('--'));
  const revoke = args.includes('--revoke');

  if (!identifier) {
    console.error('Usage: npm run set-admin -- <uid-or-email> [--revoke]');
    process.exit(1);
  }

  const uid = await resolveUid(identifier);
  const claim = revoke ? {} : { admin: true };
  await auth.setCustomUserClaims(uid, claim);

  const action = revoke ? 'revoked from' : 'granted to';
  console.log(`✓ Admin claim ${action} ${identifier} (uid: ${uid})`);
  console.log('  The user must sign out and sign back in for the new claim to take effect.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
