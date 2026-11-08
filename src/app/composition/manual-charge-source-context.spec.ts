import '@angular/compiler';
import { Injector, runInInjectionContext } from '@angular/core';
import { expect, it } from 'vitest';
import { BILLING_CONTEXT, BillingCompositionRoot } from './billing-root.component';
import { provideInvoiceListSource } from '../billing/data/invoice-list-source';
import { dummyInvoiceList } from '../billing/data/invoice-list.dummy';
import { ManualChargeFormComponent } from '../billing/pages/manual-charge-form.component';

const source = {
  patientId: '11111111-1111-4111-8111-111111111111',
  appointmentId: '22222222-2222-4222-8222-222222222222',
  procedureId: '33333333-3333-4333-8333-333333333333',
  sourceRecordId: '44444444-4444-4444-8444-444444444444',
};
const query = Object.fromEntries(Object.entries(source).map(([key, value]) => [key, [value]]));
function setup(input: Record<string, readonly string[]> = query) {
  const controller = new AbortController();
  const route = { compositionId: 'c', basePath: '/app/billing', globalPath: '/app/billing/manual-charges/new',
    localPath: '/manual-charges/new', query: input, fragment: '' };
  const injector = Injector.create({ providers: [provideInvoiceListSource(dummyInvoiceList), {
    provide: BILLING_CONTEXT, useValue: { route, signal: controller.signal,
      session: { getSnapshot: () => ({ state: 'authenticated', user: { roles: ['DENTIST'] } }), subscribe: () => () => {} },
      http: { request: () => Promise.reject(new Error('No HTTP in context tests')) }, navigation: {}, reportFailure: () => {} },
  }] });
  const root = runInInjectionContext(injector, () => new BillingCompositionRoot());
  root.invoiceListMode.set('http');
  return { root, injector };
}
it('initializes manual source hints from the existing compositor query', () => {
  const { root, injector } = setup();
  try { expect(root.manualChargeContext()).toEqual(source); expect(root.canSubmitManualCharge()).toBe(true); }
  finally { injector.destroy(); }
});
it.each([
  {}, { ...query, patientId: [] }, { ...query, patientId: [source.patientId, source.patientId] },
  { ...query, sourceRecordId: ['1-1-1-1-1'] }, { ...query, unitPrice: ['1.00'] },
  { ...query, actorId: [source.patientId] },
])('fails closed on missing, duplicate, invalid or authority/price query fields %#', input => {
  const { root, injector } = setup(input);
  try { expect(root.manualChargeContext()).toBeNull(); expect(root.canSubmitManualCharge()).toBe(false); }
  finally { injector.destroy(); }
});
it('updates a source and clears it on leaving the manual route', () => {
  const { root, injector } = setup();
  const next = '55555555-5555-4555-8555-555555555555';
  try {
    root.setRoute({ ...root.route(), query: { ...query, sourceRecordId: [next] } });
    expect(root.manualChargeContext()?.sourceRecordId).toBe(next);
    root.setRoute({ ...root.route(), localPath: '/invoices' });
    expect(root.manualChargeContext()).toBeNull();
  } finally { injector.destroy(); }
});
it('keeps the same source identity and retry intent for an equivalent query update', () => {
  const { root, injector } = setup();
  try {
    const before = root.manualChargeContext();
    root.setRoute({ ...root.route(), query: { ...query } });
    expect(root.manualChargeContext()).toBe(before);
  } finally { injector.destroy(); }
});
it('clears protected draft fields when a new source replaces the old form context', () => {
  const { injector } = setup();
  try {
    const form = runInInjectionContext(injector, () => new ManualChargeFormComponent());
    form.concept = 'Prior source'; form.quantity = '1'; form.unitPrice = '12.34'; form.justification = 'Protected reason';
    form.recording = true;
    form.resetForSource();
    expect([form.concept, form.quantity, form.unitPrice, form.justification]).toEqual(['', '', '', '']);
  } finally { injector.destroy(); }
});
