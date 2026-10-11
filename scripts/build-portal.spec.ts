import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';

const script = resolve('scripts/build-portal.mjs');
const run = (release: string) => execFileSync(process.execPath, [script], {
  encoding: 'utf8', timeout: 120000, stdio: 'pipe',
  env: { ...process.env, BILLING_RELEASE: release },
});

it('builds a self-contained, inert composition-v1 browser release', () => {
  const release = `test-${randomUUID()}`;
  run(release);
  const entry = resolve('dist/portals/billing', release, 'entry.js');
  const audit = `
    import assert from 'node:assert/strict';
    import { readFileSync } from 'node:fs';
    import { SourceTextModule, createContext } from 'node:vm';
    import { pathToFileURL } from 'node:url';
    import { performance } from 'node:perf_hooks';
    const forbidden = () => { throw new Error('Import side effect'); };
    const context = createContext({
      performance, document: { createElement: forbidden, addEventListener: forbidden },
      fetch: forbidden, XMLHttpRequest: forbidden, addEventListener: forbidden,
      setTimeout: forbidden, setInterval: forbidden,
      history: { pushState: forbidden, replaceState: forbidden },
    });
    const modules = new Map();
    async function load(url) {
      if (modules.has(url.href)) return modules.get(url.href);
      const module = new SourceTextModule(readFileSync(url, 'utf8'), {
        context, identifier: url.href,
      });
      modules.set(url.href, module);
      await module.link((specifier, parent) => {
        assert.ok(specifier.startsWith('./'), 'Bare or external import');
        return load(new URL(specifier, parent.identifier));
      });
      return module;
    }
    const module = await load(pathToFileURL(process.argv[1]));
    await module.evaluate();
    assert.equal(module.namespace.portalId, 'billing');
    assert.equal(module.namespace.contractVersion, 1);
    assert.equal(typeof module.namespace.mount, 'function');
  `;
  expect(() => execFileSync(process.execPath, [
    '--experimental-vm-modules', '--input-type=module', '-e', audit, entry,
  ], { encoding: 'utf8', stdio: 'pipe' })).not.toThrow();
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  expect(pkg.scripts['build:portal']).toBe('node scripts/build-portal.mjs');
}, 120000);

it.each(['../escape', '.', 'a/b', 'demo?x=1'])('rejects unsafe release %s', (release) => {
  try { run(release); } catch (error) {
    expect(String((error as { stderr: string }).stderr)).toContain('Invalid Billing release');
    return;
  }
  throw new Error('Unsafe release accepted');
});

it('rejects an existing release without changing its files', () => {
  const release = `test-${randomUUID()}`;
  const target = resolve('dist/portals/billing', release);
  mkdirSync(target, { recursive: true });
  writeFileSync(resolve(target, 'entry.js'), 'retained published artifact');
  for (let attempt = 0; attempt < 2; attempt++) {
    expect(() => run(release)).toThrow(/Billing release already exists/);
    expect(readFileSync(resolve(target, 'entry.js'), 'utf8')).toBe('retained published artifact');
    expect(readdirSync(target)).toEqual(['entry.js']);
  }
});
