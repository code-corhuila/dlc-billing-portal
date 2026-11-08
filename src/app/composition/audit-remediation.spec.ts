import '@angular/compiler';
import { Injector, runInInjectionContext } from '@angular/core';
import { expect, it, vi } from 'vitest';
import { BILLING_CONTEXT, BillingCompositionRoot } from './billing-root.component';
import { provideInvoiceListSource } from '../billing/data/invoice-list-source';
import { PricingCatalogService } from '../billing/catalog/services/pricing-catalog.service';
import { PricingCatalogComponent } from '../billing/catalog/pages/pricing-catalog/pricing-catalog.component';
import { InvoicePaymentHttpPageComponent } from '../billing/pages/invoice-payment-http-page.component';
import { invoiceDetailReadSuccess } from '../billing/data/invoice-detail-read-state';
import { readInvoiceDetail } from '../billing/data/invoice-read-adapter';
import { BillingListPageComponent } from '../billing/pages/billing-list-page.component';

const id = '11111111-1111-4111-8111-111111111111';
const patient = '22222222-2222-4222-8222-222222222222';
const meta = { page: 2, limit: 20, total: 41, totalPages: 3 };
const invoice = { id, patientId: patient, items: [], total: '10.01', balance: '10.01', currency: 'COP', status: 'ISSUED', version: 2 };
const price = { id, procedureCode: 'P1', name: 'Price', basePrice: '10.01' as const, currency: 'COP' as const,
  status: 'ACTIVE' as const, version: 1, validFrom: '2026-11-01T00:00:00Z' };

function setup(path = '/') {
  let listener!: (value: any) => void;
  let session = { state: 'authenticated', user: { id: 'actor-a', roles: ['ADMINISTRATOR'] }, permissions: [] };
  const request = vi.fn();
  const context = { signal: new AbortController().signal, http: { request },
    route: { localPath: path, basePath: '/app/billing', query: {} },
    navigation: { request: vi.fn().mockResolvedValue({ status: 'applied' }) }, reportFailure: vi.fn(),
    session: { getSnapshot: () => session, subscribe: (fn: typeof listener) => { listener = fn; return () => {}; } } };
  const injector = Injector.create({ providers: [provideInvoiceListSource(),
    { provide: PricingCatalogService, useValue: new PricingCatalogService() },
    { provide: BILLING_CONTEXT, useValue: context }] });
  const root = runInInjectionContext(injector, () => new BillingCompositionRoot());
  root.invoiceListMode.set('http');
  return { root, injector, request, changeActor: () => {
    session = { ...session, user: { ...session.user, id: 'actor-b' } }; listener(session);
  } };
}

it('discards old reads and metadata and clears drafts on a same-role actor change', async () => {
  const { root, injector, request, changeActor } = setup();
  try {
    let resolve!: (value: unknown) => void;
    request.mockReturnValue(new Promise(done => { resolve = done; }));
    const page = runInInjectionContext(injector, () => new InvoicePaymentHttpPageComponent());
    page.amount = '5.01'; page.method = 'CASH';
    vi.spyOn(root, 'httpPaymentPage').mockReturnValue(page);
    const pending = root.loadInvoices(2);
    changeActor();
    resolve({ ok: true, data: { data: [invoice], meta } }); await pending;
    expect(root.invoiceReadState()).toEqual({ status: 'idle', invoices: [] });
    expect(root.invoiceMeta()).toBeNull();
    expect(page.dirty).toBe(false);
  } finally { injector.destroy(); }
});

it('does not apply price-creation results from an earlier actor', async () => {
  const { root, injector, request, changeActor } = setup('/procedures');
  try {
    let resolve!: (value: unknown) => void;
    request.mockReturnValue(new Promise(done => { resolve = done; }));
    const pending = root.createPriceVersion({ procedureCode: 'P1', name: 'Price', basePrice: '10.01', validFrom: price.validFrom }, crypto.randomUUID());
    changeActor(); resolve({ ok: true, status: 201, data: price }); await pending;
    expect(root.createdPrice()).toBeNull();
    expect(request).toHaveBeenCalledTimes(1);
    expect(root.priceVersionMessage()).toBe('');
    expect(root.creatingPriceVersion()).toBe(false);
  } finally { injector.destroy(); }
});

it('loads server pages and retains their authoritative navigation metadata', async () => {
  const { root, injector, request } = setup();
  try {
    request.mockResolvedValue({ ok: true, data: { data: [invoice], meta } });
    await root.loadInvoices(2);
    expect(request.mock.calls[0][0].path).toBe('/api/v1/invoices');
    expect(request.mock.calls[0][0].query).toEqual({ page: ['2'], limit: ['20'] });
    expect(root.invoiceMeta()).toEqual(meta);
    root.route.set({ ...root.route(), localPath: '/procedures' });
    request.mockResolvedValue({ ok: true, data: { data: [price], meta } });
    await root.loadProcedurePrices(2);
    expect(request.mock.lastCall?.[0].path).toBe('/api/v1/procedure-prices');
    expect(request.mock.lastCall?.[0].query).toEqual({ page: ['2'], limit: ['20'] });
    expect(root.priceMeta()).toEqual(meta);
  } finally { injector.destroy(); }
});

it('retains a price key after ambiguous failure and closes a confirmed save even when reload fails', async () => {
  const { root, injector, request } = setup('/procedures');
  try {
    const page = runInInjectionContext(injector, () => new PricingCatalogComponent());
    page.composed = true; page.openForm();
    vi.spyOn(root, 'catalog').mockReturnValue(page);
    const input = { procedureCode: 'P1', name: 'Price', basePrice: '10.01' as const, validFrom: price.validFrom };
    request.mockRejectedValueOnce(new Error('timeout'));
    root.requestPriceVersionCreation(input);
    await vi.waitFor(() => expect(root.creatingPriceVersion()).toBe(false));
    const key = request.mock.calls[0][0].headers['Idempotency-Key'];
    request.mockResolvedValueOnce({ ok: true, status: 201, data: price }).mockRejectedValueOnce(new Error('offline'));
    root.requestPriceVersionCreation(input);
    await vi.waitFor(() => expect(root.creatingPriceVersion()).toBe(false));
    expect(request.mock.calls[1][0].headers['Idempotency-Key']).toBe(key);
    expect(page.formVisible()).toBe(false);
    expect(root.canLeave()).toBe(true);
    expect(root.createdPrice()?.id).toBe(id);
    expect(root.priceVersionMessage()).toContain('Precio registrado');
  } finally { injector.destroy(); }
});

it('versions HTTP prices without changing code or name and requires a later date', () => {
  const { injector } = setup();
  try {
    const page = runInInjectionContext(injector, () => new PricingCatalogComponent());
    page.composed = true; page.httpReadStatus = 'success'; page.httpPrices = [price];
    const emit = vi.spyOn(page.createPrice, 'emit');
    page.openForHttpPrice(price);
    expect(page.editing).toBe(true);
    expect(page.form.procedureCode).toBe('P1');
    page.form.validFrom = '2026-11-01'; page.submitPrice(); expect(emit).not.toHaveBeenCalled();
    page.form.validFrom = '2026-11-02'; page.submitPrice();
    expect(emit).toHaveBeenCalledWith(expect.objectContaining({ procedureCode: 'P1', name: 'Price', validFrom: '2026-11-02T00:00:00Z' }));
    page.savedHttpPrice = price;
    expect(page.formVisible()).toBe(false);
  } finally { injector.destroy(); }
});

it('requires the exact rounded 50 percent first payment and allows a later cent', () => {
  const { injector } = setup();
  try {
    const page = runInInjectionContext(injector, () => new InvoicePaymentHttpPageComponent());
    page.readState = invoiceDetailReadSuccess(readInvoiceDetail(invoice)); page.canRecordPayments = true; page.method = 'CASH';
    page.amount = '5.00'; expect(page.canSubmit).toBe(false);
    page.amount = '5.01'; expect(page.canSubmit).toBe(true);
    page.readState = invoiceDetailReadSuccess(readInvoiceDetail({ ...invoice, balance: '5.00', status: 'PARTIALLY_PAID', version: 3 }));
    page.amount = '0.01'; expect(page.canSubmit).toBe(true);
  } finally { injector.destroy(); }
});

it('uses server page controls without slicing the received page again', () => {
  const page = new BillingListPageComponent();
  page.remoteMeta = meta; page.invoices = Array.from({ length: 20 }, (_, n) => ({ id: `${n}`, number: `${n}`, patientName: patient, amount: '10.01' as const, status: 'ISSUED' as const }));
  const emit = vi.spyOn(page.pageChange, 'emit');
  expect(page.paginatedInvoices).toHaveLength(20);
  page.nextPage(); page.previousPage();
  expect(emit.mock.calls).toEqual([[3], [1]]);
});
