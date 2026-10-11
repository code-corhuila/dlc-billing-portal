import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { publishRelease } from './release-output.mjs';

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
