import '@angular/compiler';
import { createApplication } from '@angular/platform-browser';
import { expect, it, vi } from 'vitest';

vi.mock('@angular/platform-browser', () => ({ createApplication: vi.fn() }));

it('exports the Billing v1 identity without starting an application', async () => {
  const entry = await import('../../portal-entry');
  expect(entry.portalId).toBe('billing');
  expect(entry.contractVersion).toBe(1);
  expect(createApplication).not.toHaveBeenCalled();
});
