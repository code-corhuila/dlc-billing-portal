import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import type { AddressInfo } from 'node:net';
import { expect, it } from 'vitest';

async function withServer(check: (origin: string) => Promise<void>) {
  const { createPortalServer } = await import('./serve-portal.mjs');
  const parent = resolve(tmpdir());
  const root = mkdtempSync(join(parent, 'billing-static-'));
  mkdirSync(join(root, '0.1.0-demo'));
  writeFileSync(join(root, '0.1.0-demo/entry.js'), 'export const portalId = "billing";');
  writeFileSync(join(root, '0.1.0-demo/entry.css'), '.bil-frame { color: teal; }');
  const server = createPortalServer(root);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as AddressInfo).port;
  try { await check(`http://127.0.0.1:${port}`); } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    expect(dirname(root)).toBe(parent);
    rmSync(root, { recursive: true });
  }
}

it('serves the entry and sibling assets with their content types and no-store', async () => {
  await withServer(async (origin) => {
    const entry = await fetch(`${origin}/portals/billing/0.1.0-demo/entry.js`);
    expect(entry.status).toBe(200);
    expect(entry.headers.get('content-type')).toContain('javascript');
    expect(entry.headers.get('cache-control')).toBe('no-store');
    expect(await entry.text()).toContain('export const portalId');
    const css = await fetch(`${origin}/portals/billing/0.1.0-demo/entry.css`);
    expect(css.headers.get('content-type')).toContain('text/css');
    await css.text();
  });
});

it('answers HEAD probes without returning a response body', async () => {
  await withServer(async (origin) => {
    const response = await fetch(`${origin}/portals/billing/0.1.0-demo/entry.js`, { method: 'HEAD' });
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.text()).toBe('');
  });
});

it('returns real 404 responses for missing assets and paths outside Billing', async () => {
  await withServer(async (origin) => {
    for (const path of ['/portals/billing/0.1.0-demo/missing.js', '/app/billing',
      '/portals/clinical/entry.js', '/portals/billing/%2e%2e%2fpackage.json']) {
      const response = await fetch(origin + path);
      expect(response.status).toBe(404);
      expect(await response.text()).not.toContain('<html');
    }
  });
});

it('rejects writes to the static service', async () => {
  await withServer(async (origin) => {
    const response = await fetch(`${origin}/portals/billing/0.1.0-demo/entry.js`, { method: 'POST' });
    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe('GET, HEAD');
    await response.text();
  });
});
