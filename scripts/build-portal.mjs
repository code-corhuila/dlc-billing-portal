import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const release = process.env.BILLING_RELEASE ?? `${version}-demo`;
if (!/^(?!\.+$)[A-Za-z0-9._-]+$/.test(release)) {
  throw new Error('Invalid Billing release');
}
const releases = join(root, 'dist/portals/billing');
const target = join(releases, release);
if (existsSync(target)) throw new Error('Billing release already exists; choose a new release');

execFileSync(process.execPath, [
  join(root, 'node_modules/@angular/cli/bin/ng.js'),
  'run', 'dlc-billing-portal:build-portal',
], { cwd: root, stdio: 'inherit' });

mkdirSync(releases, { recursive: true });
// Exclusive creation also rejects a destination created during compilation.
mkdirSync(target);
cpSync(join(root, 'dist/billing-composition'), target, { recursive: true, force: false, errorOnExist: true });
renameSync(join(target, 'main.js'), join(target, 'entry.js'));
console.log(`Billing release: /portals/billing/${release}/entry.js`);
