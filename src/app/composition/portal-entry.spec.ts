import '@angular/compiler';
import { createApplication } from '@angular/platform-browser';
import { signal } from '@angular/core';
import { beforeEach, expect, it, vi } from 'vitest';

vi.mock('@angular/platform-browser', () => ({ createApplication: vi.fn() }));

const route = (localPath = '/') => ({
  compositionId: 'composition-1', globalPath: `/app/billing${localPath}`,
  basePath: '/app/billing', localPath, query: {}, fragment: '',
});
let controller: AbortController;
const root = { route: signal(route()) };
const child = { remove: vi.fn() };
const host = {
  ownerDocument: { createElement: vi.fn(() => child) }, appendChild: vi.fn(),
} as unknown as HTMLElement;
const app = { bootstrap: vi.fn(() => ({ instance: root })), destroy: vi.fn() };
const context = () => ({
  contractVersion: 1 as const, portalId: 'billing' as const,
  mountId: 'mount-1', compositionId: 'composition-1', route: route(),
  signal: controller.signal, navigation: { request: vi.fn() },
  session: { getSnapshot: vi.fn(), subscribe: vi.fn() },
  http: { request: vi.fn() }, reportFailure: vi.fn(),
});
const mount = async () => (await import('../../portal-entry')).mount(host, context());

beforeEach(() => {
  vi.clearAllMocks();
  controller = new AbortController();
  root.route.set(route());
  app.bootstrap.mockImplementation(() => ({ instance: root }));
  vi.mocked(createApplication).mockResolvedValue(app as never);
});

it('exports the Billing v1 identity without starting an application', async () => {
  const entry = await import('../../portal-entry');
  expect(entry.portalId).toBe('billing');
  expect(entry.contractVersion).toBe(1);
  expect(createApplication).not.toHaveBeenCalled();
});

it('bootstraps inside an owned child and leaves shared capabilities unused', async () => {
  const capabilities = context();
  const entry = await import('../../portal-entry');
  await entry.mount(host, capabilities);
  expect(host.appendChild).toHaveBeenCalledWith(child);
  expect(app.bootstrap).toHaveBeenCalledWith(expect.any(Function), child);
  expect(capabilities.http.request).not.toHaveBeenCalled();
  expect(capabilities.session.subscribe).not.toHaveBeenCalled();
});

it('destroys only the owned application and child, once', async () => {
  const handle = await mount();
  await handle.unmount();
  await handle.unmount();
  expect(app.destroy).toHaveBeenCalledTimes(1);
  expect(child.remove).toHaveBeenCalledTimes(1);
});

it('cleans a partial mount when bootstrap fails', async () => {
  app.bootstrap.mockImplementationOnce(() => { throw new Error('bootstrap failed'); });
  await expect(mount()).rejects.toThrow('bootstrap failed');
  expect(app.destroy).toHaveBeenCalledTimes(1);
  expect(child.remove).toHaveBeenCalledTimes(1);
});

it('cleans the owned child when application creation fails', async () => {
  vi.mocked(createApplication).mockRejectedValueOnce(new Error('creation failed'));
  await expect(mount()).rejects.toThrow('creation failed');
  expect(child.remove).toHaveBeenCalledTimes(1);
  expect(app.destroy).not.toHaveBeenCalled();
});

it('rejects an already cancelled mount without allocating resources', async () => {
  controller.abort();
  await expect(mount()).rejects.toThrow('CANCELLED');
  expect(createApplication).not.toHaveBeenCalled();
  expect(host.appendChild).not.toHaveBeenCalled();
});

it('destroys a late application after cancellation during creation', async () => {
  vi.mocked(createApplication).mockImplementationOnce(async () => {
    controller.abort();
    return app as never;
  });
  await expect(mount()).rejects.toThrow('CANCELLED');
  expect(app.bootstrap).not.toHaveBeenCalled();
  expect(app.destroy).toHaveBeenCalledTimes(1);
  expect(child.remove).toHaveBeenCalledTimes(1);
});

it('cleans a mounted application when the compositor aborts its context', async () => {
  const handle = await mount();
  controller.abort();
  await handle.unmount();
  expect(app.destroy).toHaveBeenCalledTimes(1);
  expect(child.remove).toHaveBeenCalledTimes(1);
});

it('removes the abort listener and owned child even if destruction fails', async () => {
  const removeListener = vi.spyOn(controller.signal, 'removeEventListener');
  const handle = await mount();
  app.destroy.mockImplementationOnce(() => { throw new Error('cleanup failed'); });
  await expect(handle.unmount()).rejects.toThrow('cleanup failed');
  expect(removeListener).toHaveBeenCalledWith('abort', expect.any(Function));
  expect(child.remove).toHaveBeenCalledTimes(1);
  controller.abort();
  expect(app.destroy).toHaveBeenCalledTimes(1);
});
