import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const release = process.env.BILLING_RELEASE ?? `${version}-demo`;
if (!/^(?!\.+$)[A-Za-z0-9._-]+$/.test(release)) {
  throw new Error('Invalid Billing release');
}

execFileSync(process.execPath, [
  join(root, 'node_modules/@angular/cli/bin/ng.js'),
  'run', 'dlc-billing-portal:build-portal',
], { cwd: root, stdio: 'inherit' });

const target = join(root, 'dist/portals/billing', release);
mkdirSync(target, { recursive: true });
cpSync(join(root, 'dist/billing-composition'), target, { recursive: true });
renameSync(join(target, 'main.js'), join(target, 'entry.js'));
console.log(`Billing release: /portals/billing/${release}/entry.js`);
