import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { publishRelease } from './release-output.mjs';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'billing-release-'));
  mkdirSync(join(root, 'dist/billing-composition'), { recursive: true });
  writeFileSync(join(root, 'dist/billing-composition/main.js'), 'complete artifact');
});
afterEach(() => {
  expect(dirname(root)).toBe(tmpdir());
  rmSync(root, { recursive: true });
});
const releases = () => join(root, 'dist/portals/billing');

it.each(['compile', 'copy', 'entry'])('cleans up after %s failure and permits retry', (failure) => {
  const build = () => { if (failure === 'compile') throw new Error('compiler failed'); };
  const copy = (source: string, destination: string) => {
    if (failure === 'copy') {
      writeFileSync(join(destination, 'partial.js'), 'partial');
      throw new Error('disk full');
    }
    cpSync(source, destination, { recursive: true });
    if (failure === 'entry') rmSync(join(destination, 'main.js'));
  };
  expect(() => publishRelease(root, 'demo', build, copy)).toThrow();
  expect(readdirSync(releases())).toEqual([]);
  publishRelease(root, 'demo', () => {});
  expect(readFileSync(join(releases(), 'demo/entry.js'), 'utf8')).toBe('complete artifact');
  expect(readdirSync(releases())).toEqual(['demo']);
});

it('keeps the final destination absent until the complete artifact is published', () => {
  publishRelease(root, 'demo', () => {
    expect(existsSync(join(releases(), 'demo'))).toBe(false);
  }, (source: string, stage: string) => {
    cpSync(source, stage, { recursive: true });
    expect(existsSync(join(releases(), 'demo'))).toBe(false);
  });
  expect(readdirSync(join(releases(), 'demo'))).toEqual(['entry.js']);
});

it('rejects concurrent builds before they can touch shared compiler output', () => {
  publishRelease(root, 'demo', () => {
    expect(() => publishRelease(root, 'other', () => {
      throw new Error('must not compile');
    })).toThrow(/Billing build already in progress/);
  });
  expect(readdirSync(releases())).toEqual(['demo']);
});

it('preserves an existing release and does not start compilation', () => {
  publishRelease(root, 'demo', () => {});
  expect(() => publishRelease(root, 'demo', () => {
    throw new Error('must not compile');
  })).toThrow(/Billing release already exists/);
  expect(readFileSync(join(releases(), 'demo/entry.js'), 'utf8')).toBe('complete artifact');
});

it('records abrupt termination and permits confirmed offline recovery', () => {
  const module = pathToFileURL(resolve('scripts/release-output.mjs')).href;
  const program = `import { publishRelease } from ${JSON.stringify(module)};
    publishRelease(process.argv[1], 'demo', () => process.exit(7));`;
  expect(() => execFileSync(process.execPath, ['--input-type=module', '-e', program, root])).toThrow();
  const lock = join(releases(), '.build-lock');
  const owner = JSON.parse(readFileSync(join(lock, 'owner.json'), 'utf8'));
  expect(owner.pid).toBeGreaterThan(0);
  expect(owner.pid).not.toBe(process.pid);
  expect(owner.host).toBeTruthy();
  expect(() => publishRelease(root, 'demo', () => {})).toThrow(/already in progress/);
  // execFileSync has waited for this fixture's child to exit; no contender is running.
  expect(dirname(owner.stage)).toBe(releases());
  rmSync(owner.stage, { recursive: true });
  rmSync(lock, { recursive: true });
  publishRelease(root, 'demo', () => {});
  expect(readdirSync(releases())).toEqual(['demo']);
});
