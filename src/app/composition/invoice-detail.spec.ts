import '@angular/compiler';
import { Injector, runInInjectionContext } from '@angular/core';
import { expect, it, vi } from 'vitest';
import { BILLING_CONTEXT, BillingCompositionRoot } from './billing-root.component';
import { provideInvoiceListSource } from '../billing/data/invoice-list-source';
import { dummyInvoiceList } from '../billing/data/invoice-list.dummy';
import { InvoicePaymentPageComponent } from '../billing/pages/invoice-payment-page.component';
import { invoiceDetailReadSuccess } from '../billing/data/invoice-detail-read-state';
import { readInvoiceDetail } from '../billing/data/invoice-read-adapter';

function setup(localPath = '/invoices/invoice-002') {
  const controller = new AbortController();
  const route = { localPath, basePath: '/app/billing' };
  const navigation = { request: vi.fn().mockResolvedValue({ status: 'applied' }) };
  const request = vi.fn();
  const source = { read: dummyInvoiceList.read, detail: vi.fn(dummyInvoiceList.detail) };
  const context = {
    route,
    navigation,
    http: { request },
    signal: controller.signal,
    reportFailure: vi.fn(),
    session: { getSnapshot: vi.fn(), subscribe: () => () => {} },
  };
  const injector = Injector.create({ providers: [
    provideInvoiceListSource(source),
    { provide: BILLING_CONTEXT, useValue: context },
  ] });
  const frame = runInInjectionContext(injector, () => new BillingCompositionRoot());
  return { frame, injector, source, context, controller, request };
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
    const page = runInInjectionContext(injector, () => new InvoicePaymentPageComponent());
    vi.spyOn(frame, 'paymentPage').mockReturnValue(page);
    page.amount = '1.00';
    expect(frame.canLeave()).toBe(false);
    page.discard(); expect(frame.canLeave()).toBe(true);
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

const apiInvoice = {
  id: '11111111-1111-4111-8111-111111111111',
  patientId: '22222222-2222-4222-8222-222222222222',
  items: [],
  total: '150000.00',
  balance: '75000.00',
  currency: 'COP',
  status: 'PARTIALLY_PAID',
  version: 3,
};

it('loads invoice detail explicitly without changing demo selection', async () => {
  const { frame, injector, request, context } = setup();
  try {
    request.mockResolvedValue({ ok: true, data: apiInvoice });

    expect(frame.invoiceDetailReadState()).toEqual({
      status: 'idle',
      invoice: undefined,
    });

    await frame.loadInvoiceDetail(apiInvoice.id);

    expect(request).toHaveBeenCalledExactlyOnceWith({
      method: 'GET',
      path: `/api/v1/invoices/${apiInvoice.id}`,
      signal: context.signal,
    });
    expect(frame.invoiceDetailReadState().status).toBe('success');
    expect(frame.invoiceDetailReadState().invoice).toMatchObject({
      id: apiInvoice.id,
      version: 3,
      total: '150000.00',
      balance: '75000.00',
    });
    expect(frame.selectedInvoice()?.number).toBe('INV-002');
  } finally { injector.destroy(); }
});

it('publishes loading before the invoice detail request finishes', async () => {
  const { frame, injector, request } = setup();
  try {
    let resolveRequest!: (value: unknown) => void;
    request.mockReturnValue(new Promise(resolve => {
      resolveRequest = resolve;
    }));

    const pending = frame.loadInvoiceDetail(apiInvoice.id);

    expect(frame.invoiceDetailReadState()).toEqual({
      status: 'loading',
      invoice: undefined,
    });

    resolveRequest({ ok: true, data: apiInvoice });
    await pending;

    expect(frame.invoiceDetailReadState().status).toBe('success');
  } finally { injector.destroy(); }
});

it('ignores stale invoice detail responses', async () => {
  const { frame, injector, request } = setup();
  try {
    const pendingRequests: Array<(value: unknown) => void> = [];
    request.mockImplementation(() => new Promise(resolve => {
      pendingRequests.push(resolve);
    }));

    const first = frame.loadInvoiceDetail(apiInvoice.id);
    const newerId = '33333333-3333-4333-8333-333333333333';
    const second = frame.loadInvoiceDetail(newerId);

    pendingRequests[1]({
      ok: true,
      data: { ...apiInvoice, id: newerId, version: 4 },
    });
    await second;

    pendingRequests[0]({ ok: true, data: apiInvoice });
    await first;

    expect(frame.invoiceDetailReadState().invoice?.id).toBe(newerId);
    expect(frame.invoiceDetailReadState().invoice?.version).toBe(4);
  } finally { injector.destroy(); }
});

it('does not publish invoice detail after disposal', async () => {
  const { frame, injector, request } = setup();
  let resolveRequest!: (value: unknown) => void;
  request.mockReturnValue(new Promise(resolve => {
    resolveRequest = resolve;
  }));

  const pending = frame.loadInvoiceDetail(apiInvoice.id);
  const stateWrites = vi.spyOn(frame.invoiceDetailReadState, 'set');

  injector.destroy();

  resolveRequest({ ok: true, data: apiInvoice });
  await pending;

  expect(stateWrites).not.toHaveBeenCalled();
});

it('uses the demo invoice presentation by default', () => {
  const { frame, injector, request } = setup();
  try {
    expect(frame.invoiceListMode()).toBe('demo');
    expect(frame.useHttpInvoiceDetail()).toBe(false);
    expect(frame.selectedInvoice()?.number).toBe('INV-002');
    expect(request).not.toHaveBeenCalled();
  } finally { injector.destroy(); }
});

it('selects HTTP detail presentation using the existing invoice mode', () => {
  const { frame, injector, request } = setup();
  try {
    frame.invoiceListMode.set('http');

    expect(frame.useHttpInvoiceDetail()).toBe(true);
    expect(frame.invoiceDetailReadState().status).toBe('idle');
    expect(request).not.toHaveBeenCalled();
  } finally { injector.destroy(); }
});

it('exposes the validated HTTP detail state independently of demo data', () => {
  const { frame, injector } = setup();
  try {
    const invoice = readInvoiceDetail(apiInvoice);
    frame.invoiceDetailReadState.set(invoiceDetailReadSuccess(invoice));
    frame.invoiceListMode.set('http');

    expect(frame.useHttpInvoiceDetail()).toBe(true);
    expect(frame.invoiceDetailReadState().invoice?.id).toBe(apiInvoice.id);
    expect(frame.selectedInvoice()?.number).toBe('INV-002');
  } finally { injector.destroy(); }
});

it('does not use the HTTP detail presentation for payment or list routes', () => {
  const { frame, injector } = setup('/invoices/invoice-001/payment');
  try {
    frame.invoiceListMode.set('http');
    expect(frame.useHttpInvoiceDetail()).toBe(false);

    frame.route.set({ ...frame.route(), localPath: '/' });
    expect(frame.useHttpInvoiceDetail()).toBe(false);
  } finally { injector.destroy(); }
});

it('shows HTTP invoice details only when the route identifier matches', () => {
  const { frame, injector } = setup(`/invoices/${apiInvoice.id}`);
  try {
    frame.invoiceListMode.set('http');
    const invoice = readInvoiceDetail(apiInvoice);
    frame.invoiceDetailReadState.set(invoiceDetailReadSuccess(invoice));

    expect(frame.displayedInvoiceDetailReadState()).toEqual({
      status: 'success',
      invoice,
    });
  } finally { injector.destroy(); }
});

it('hides previously loaded HTTP invoice data after navigating to another invoice', () => {
  const { frame, injector, request } = setup(`/invoices/${apiInvoice.id}`);
  try {
    frame.invoiceListMode.set('http');
    frame.invoiceDetailReadState.set(
      invoiceDetailReadSuccess(readInvoiceDetail(apiInvoice)),
    );

    frame.route.set({
      ...frame.route(),
      localPath: '/invoices/33333333-3333-4333-8333-333333333333',
    });

    expect(frame.displayedInvoiceDetailReadState()).toEqual({
      status: 'idle',
      invoice: undefined,
    });
    expect(request).not.toHaveBeenCalled();
  } finally { injector.destroy(); }
});

it('does not expose unrelated HTTP invoice data on a route with an invalid identifier', () => {
  const { frame, injector } = setup('/invoices/%ZZ');
  try {
    frame.invoiceListMode.set('http');
    frame.invoiceDetailReadState.set(
      invoiceDetailReadSuccess(readInvoiceDetail(apiInvoice)),
    );

    expect(frame.displayedInvoiceDetailReadState()).toEqual({
      status: 'idle',
      invoice: undefined,
    });
  } finally { injector.destroy(); }
});

it('keeps demo invoice selection independent of HTTP route consistency', () => {
  const { frame, injector } = setup('/invoices/invoice-002');
  try {
    frame.invoiceDetailReadState.set(
      invoiceDetailReadSuccess(readInvoiceDetail(apiInvoice)),
    );

    expect(frame.invoiceListMode()).toBe('demo');
    expect(frame.selectedInvoice()?.number).toBe('INV-002');
    expect(frame.displayedInvoiceDetailReadState().invoice).toBeUndefined();
  } finally { injector.destroy(); }
});
