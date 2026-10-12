import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { publishRelease } from './release-output.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const release = process.env.BILLING_RELEASE ?? `${version}-demo`;
if (!/^(?!\.+$)[A-Za-z0-9._-]+$/.test(release)) {
  throw new Error('Invalid Billing release');
}
publishRelease(root, release, () => execFileSync(process.execPath, [
  join(root, 'node_modules/@angular/cli/bin/ng.js'),
  'run', 'dlc-billing-portal:build-portal',
], { cwd: root, stdio: 'inherit' }));
console.log(`Billing release: /portals/billing/${release}/entry.js`);
