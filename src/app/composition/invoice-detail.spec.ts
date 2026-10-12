import '@angular/compiler';
import { Injector, runInInjectionContext } from '@angular/core';
import { expect, it, vi } from 'vitest';
import { BILLING_CONTEXT, BillingCompositionRoot } from './billing-root.component';
import { provideInvoiceListSource } from '../billing/data/invoice-list-source';
import { dummyInvoiceList } from '../billing/data/invoice-list.dummy';

function setup(localPath = '/invoices/invoice-002') {
  const controller = new AbortController();
  const route = { localPath, basePath: '/app/billing' };
  const navigation = { request: vi.fn().mockResolvedValue({ status: 'applied' }) };
  const source = { read: dummyInvoiceList.read, detail: vi.fn(dummyInvoiceList.detail) };
  const context = { route, navigation, signal: controller.signal, reportFailure: vi.fn(),
    session: { getSnapshot: vi.fn(), subscribe: () => () => {} } };
  const injector = Injector.create({ providers: [provideInvoiceListSource(source),
    { provide: BILLING_CONTEXT, useValue: context }] });
  const frame = runInInjectionContext(injector, () => new BillingCompositionRoot());
  return { frame, injector, source, context, controller };
}

it('selects details through the configured source and reacts to compositor route updates', () => {
  const { frame, source, injector } = setup();
  try {
    expect(frame.isInvoiceDetail()).toBe(true);
    expect(frame.selectedInvoice()?.number).toBe('INV-002');
    expect(source.detail).toHaveBeenCalledWith('invoice-002');
    frame.route.set({ ...frame.route(), localPath: '/invoices/invoice-003' });
    expect(frame.selectedInvoice()?.status).toBe('PAID');
    frame.route.set({ ...frame.route(), localPath: '/' });
    expect(frame.isInvoiceList()).toBe(true);
    expect(frame.selectedInvoice()).toBeUndefined();
  } finally { injector.destroy(); }
});

it.each(['/invoices/missing', '/invoices/%ZZ', '/missing'])(
  'does not substitute a fixed invoice for unavailable route %s', localPath => {
    const { frame, injector } = setup(localPath);
    try { expect(frame.selectedInvoice()).toBeUndefined(); }
    finally { injector.destroy(); }
  },
);

it('selects payment routes and requests payment navigation through the compositor', async () => {
  const { frame, injector, context } = setup('/invoices/invoice-001/payment');
  try {
    frame.session.set({ state: 'authenticated', user: { roles: ['SECRETARY_ASSISTANT'] } } as never);
    expect(frame.isPaymentRoute()).toBe(true); expect(frame.isInvoiceDetail()).toBe(false);
    expect(frame.canRecordPayments()).toBe(true);
    await frame.openPayment('invoice-001');
    expect(context.navigation.request).toHaveBeenCalledWith({ path: '/app/billing/invoices/invoice-001/payment' });
    frame.payments.register('invoice-001', '100000.00', 'demo', 'key');
    expect(frame.selectedInvoice()?.status).toBe('PAID');
    expect(frame.invoices[0].status).toBe('PAID');
  } finally { injector.destroy(); }
});

it('decodes identifiers once and keeps replacement data independent of demo fixture ids', () => {
  const { frame, source, injector } = setup('/invoices/custom%20id');
  source.detail.mockReturnValue({ ...dummyInvoiceList.detail('invoice-001')!, id: 'custom id' });
  try {
    expect(frame.selectedInvoice()?.id).toBe('custom id');
    expect(source.detail).toHaveBeenCalledWith('custom id');
  } finally { injector.destroy(); }
});

it('requests list navigation through the compositor and ignores late refusal after disposal', async () => {
  const { frame, context, injector } = setup();
  let settle!: (result: { status: string }) => void;
  context.navigation.request.mockReturnValue(new Promise(resolve => { settle = resolve; }));
  const pending = frame.backToList();
  await frame.backToList();
  expect(context.navigation.request).toHaveBeenCalledTimes(1);
  expect(context.navigation.request).toHaveBeenCalledWith({ path: '/app/billing' });
  const writes = vi.spyOn(frame.navigationMessage, 'set');
  injector.destroy();
  settle({ status: 'cancelled' });
  await pending;
  expect(writes).not.toHaveBeenCalled();
  await frame.backToList();
  expect(context.navigation.request).toHaveBeenCalledTimes(1);
});
