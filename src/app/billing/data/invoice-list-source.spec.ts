import '@angular/compiler';
import { Injector, runInInjectionContext } from '@angular/core';
import { expect, it, vi } from 'vitest';
import { dummyInvoiceList } from './invoice-list.dummy';

it('uses one configured source for composed and standalone invoice rows', async () => {
  const { provideInvoiceListSource } = await import('./invoice-list-source');
  const { BILLING_CONTEXT, BillingCompositionRoot } = await import('../../composition/billing-root.component');
  const { BILLING_ROUTES } = await import('../billing.routes');
  const rows = [{ ...dummyInvoiceList.read()[0], id: 'replacement-demo' }];
  const source = { read: vi.fn(() => rows.map(row => ({ ...row }))), detail: vi.fn() };
  const injector = Injector.create({ providers: [provideInvoiceListSource(source), {
    provide: BILLING_CONTEXT, useValue: { route: { localPath: '/' }, signal: new AbortController().signal },
  }] });
  try {
    const frame = runInInjectionContext(injector, () => new BillingCompositionRoot());
    const resolve = BILLING_ROUTES.find(route => route.path === '')!.resolve!['invoices'] as () => typeof rows;
    const standalone = runInInjectionContext(injector, resolve);
    expect(frame.invoices).toEqual(rows);
    expect(standalone).toEqual(rows);
    expect(source.read).toHaveBeenCalledTimes(2);
    standalone[0].id = 'local-change';
    expect(frame.invoices[0].id).toBe('replacement-demo');
  } finally { injector.destroy(); }
});
