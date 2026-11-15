import '@angular/compiler';
import { ChangeDetectorRef, Injector, runInInjectionContext } from '@angular/core';
import { expect, it, vi } from 'vitest';
import { InvoiceDraftPageComponent } from './invoice-draft-page.component';
import { createInvoiceDraftHttp, readUnbilledItemsHttp } from '../data/invoice-draft-http';
import type { PortalContext } from '../../shell-contract';
import { readBillableItem } from '../data/invoice-read-adapter';

const patientId = '22222222-2222-4222-8222-222222222222';
const itemId = '33333333-3333-4333-8333-333333333333';
const invoiceId = '44444444-4444-4444-8444-444444444444';
const item = { id: itemId, patientId, procedureId: '55555555-5555-4555-8555-555555555555',
  description: 'Financial charge', quantity: '1.0000', unitPrice: '10.01', currency: 'COP', status: 'UNBILLED', version: 1 };
const meta = { page: 1, limit: 20, total: 1, totalPages: 1 };
const draft = { id: invoiceId, patientId, items: [item], total: '10.01', balance: '10.01', currency: 'COP', status: 'DRAFT', version: 1 };

function setup() {
  const injector = Injector.create({ providers: [] });
  const request = vi.fn();
  const context = { signal: new AbortController().signal, http: { request }, session: {
    getSnapshot: () => ({ state: 'authenticated', user: { id: 'actor-a', roles: ['ADMINISTRATOR'] }, permissions: [] }),
  } } as unknown as PortalContext;
  const page = runInInjectionContext(injector, () => new InvoiceDraftPageComponent());
  page.context = context; page.canCreate = true; page.patientId = patientId;
  return { page, context, injector, request };
}

it('reads patient-filtered pages and exposes only pending financial items', async () => {
  const { request, page, injector } = setup();
  try {
    request.mockResolvedValue({ ok: true, data: { data: [item, { ...item, id: invoiceId, status: 'BILLED' }], meta } });
    await page.load(1);
    expect(request.mock.calls[0][0].path).toBe('/api/v1/billable-items');
    expect(request.mock.calls[0][0].query).toEqual({ page: ['1'], limit: ['20'], patientId: [patientId] });
    expect(page.items).toHaveLength(1);
    page.toggle(page.items[0]); expect(page.dirty).toBe(true); expect(page.canSubmit).toBe(true);
  } finally { injector.destroy(); }
});

it('creates an amount-free draft and allows navigation only after confirmed success', async () => {
  const { request, page, injector } = setup();
  try {
    page.toggle(readBillableItem(item));
    request.mockResolvedValue({ ok: true, status: 201, data: draft });
    const emit = vi.spyOn(page.created, 'emit').mockImplementation(() => expect(page.dirty).toBe(false));
    await page.submit();
    expect(request.mock.calls[0][0].body).toEqual({ patientId, billableItemIds: [itemId] });
    expect(emit).toHaveBeenCalledWith(invoiceId);
    await page.submit(); expect(request).toHaveBeenCalledTimes(1);
  } finally { injector.destroy(); }
});

it('blocks duplicate sends and preserves the same key after uncertainty', async () => {
  const { request, page, injector } = setup();
  try {
    page.toggle(readBillableItem(item));
    let reject!: (reason: unknown) => void;
    request.mockReturnValueOnce(new Promise((_, fail) => { reject = fail; }));
    const pending = page.submit(); await page.submit();
    expect(request).toHaveBeenCalledTimes(1); expect(page.dirty).toBe(true);
    reject(new Error('timeout')); await pending;
    const first = request.mock.calls[0][0].headers['Idempotency-Key'];
    request.mockResolvedValueOnce({ ok: true, status: 201, data: draft });
    await page.submit();
    expect(request.mock.calls[1][0].headers['Idempotency-Key']).toBe(first);
  } finally { injector.destroy(); }
});

it('invalidates a previous patient read and selection when the source changes', async () => {
  const { request, page, injector } = setup();
  try {
    let resolve!: (response: unknown) => void;
    request.mockReturnValueOnce(new Promise(done => { resolve = done; }));
    const pending = page.load(1);
    page.changePatient(invoiceId);
    resolve({ ok: true, data: { data: [item], meta } }); await pending;
    expect(page.items).toEqual([]); expect(page.loaded).toBe(false);
  } finally { injector.destroy(); }
});

it('rejects different-patient responses, malformed pagination and invalid input before writing', async () => {
  const { request, context, injector } = setup();
  try {
    request.mockResolvedValue({ ok: true, data: { data: [{ ...item, patientId: invoiceId }], meta } });
    await expect(readUnbilledItemsHttp(context, patientId)).rejects.toThrow('Patient mismatch');
    request.mockResolvedValue({ ok: true, data: { data: [item], meta: {} } });
    await expect(readUnbilledItemsHttp(context, patientId)).rejects.toThrow('Invalid pagination');
    request.mockClear();
    await expect(createInvoiceDraftHttp(context, { patientId, billableItemIds: [itemId, itemId] }, crypto.randomUUID())).rejects.toThrow();
    expect(request).not.toHaveBeenCalled();
  } finally { injector.destroy(); }
});

it('does not retain an obsolete creation result after resetting the session', async () => {
  const { request, page, injector } = setup();
  try {
    page.toggle(readBillableItem(item));
    let resolve!: (response: unknown) => void;
    request.mockReturnValueOnce(new Promise(done => { resolve = done; }));
    const emit = vi.spyOn(page.created, 'emit');
    const pending = page.submit(); page.resetForSession();
    resolve({ ok: true, status: 201, data: draft }); await pending;
    expect(emit).not.toHaveBeenCalled(); expect(page.createdId).toBe(''); expect(page.dirty).toBe(false);
  } finally { injector.destroy(); }
});

it('keeps selection for conflict review and denies unauthorized creation', async () => {
  const { request, page, injector } = setup();
  try {
    page.toggle(readBillableItem(item)); request.mockResolvedValue({ ok: false, status: 409 });
    await page.submit(); expect(page.message).toContain('Conflicto'); expect(page.selected.size).toBe(1);
    page.canCreate = false; await page.submit(); expect(request).toHaveBeenCalledTimes(1);
  } finally { injector.destroy(); }
});

it('finds the patient by name or document instead of asking for the raw identifier', async () => {
  const { page, request, injector } = setup();
  try {
    page.resetForSession();
    request.mockResolvedValueOnce({ ok: true, data: { data: [
      { id: patientId, name: 'Laura Front', documentType: 'CC', documentNumber: '1075000003', status: 'ACTIVE', version: 1 },
    ], meta } });
    await page.searchPatients('  laura ');
    expect(request.mock.calls[0][0]).toMatchObject({ method: 'GET', path: '/api/v1/patients',
      query: { search: ['laura'], status: ['ACTIVE'], page: ['1'], limit: ['10'] } });
    expect(page.patientResults).toEqual([{ id: patientId, label: 'Laura Front — CC 1075000003' }]);

    request.mockResolvedValueOnce({ ok: true, data: { data: [item], meta } });
    await page.selectPatient(page.patientResults[0]);
    expect(page.patientId).toBe(patientId);
    expect(page.patientLabel).toBe('Laura Front — CC 1075000003');
    expect(page.patientResults).toEqual([]);
    expect(request.mock.calls[1][0].query).toEqual({ page: ['1'], limit: ['20'], patientId: [patientId] });
    expect(page.items).toHaveLength(1);
  } finally { injector.destroy(); }
});

it('needs two characters to search and reports a failed search', async () => {
  const { page, request, injector } = setup();
  try {
    await page.searchPatients('l');
    expect(request).not.toHaveBeenCalled();
    request.mockResolvedValueOnce({ ok: false, status: 503 });
    await page.searchPatients('laura');
    expect(page.patientResults).toEqual([]);
    expect(page.message).toBe('No fue posible buscar pacientes. Puede reintentar.');
  } finally { injector.destroy(); }
});

it('asks Angular to render search and charge results in the zoneless portal', async () => {
  const markForCheck = vi.fn();
  const injector = Injector.create({ providers: [{ provide: ChangeDetectorRef, useValue: { markForCheck } }] });
  const request = vi.fn().mockResolvedValue({ ok: true, data: { data: [item], meta } });
  const page = runInInjectionContext(injector, () => new InvoiceDraftPageComponent());
  page.context = { signal: new AbortController().signal, http: { request }, session: {
    getSnapshot: () => ({ state: 'authenticated', user: { id: 'actor-a', roles: ['ADMINISTRATOR'] }, permissions: [] }),
  } } as unknown as PortalContext;
  page.canCreate = true; page.patientId = patientId;
  try {
    await page.load(1);
    expect(markForCheck).toHaveBeenCalled();
  } finally { injector.destroy(); }
});
