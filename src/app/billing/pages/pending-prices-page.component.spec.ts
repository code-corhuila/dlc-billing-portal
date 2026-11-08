import '@angular/compiler';
import { Injector, runInInjectionContext } from '@angular/core';
import { expect, it, vi } from 'vitest';
import { PendingPricesPageComponent } from './pending-prices-page.component';
import type { PortalContext } from '../../shell-contract';

const account = {
  encounterAccountId: '11111111-1111-4111-8111-111111111111',
  patientId: '22222222-2222-4222-8222-222222222222',
  appointmentId: '33333333-3333-4333-8333-333333333333',
  declaredAt: '2026-11-08T13:31:30Z',
  missingSources: [{
    sourceRecordId: '44444444-4444-4444-8444-444444444444',
    procedureId: '55555555-5555-4555-8555-555555555555',
    itemType: 'ADDITIONAL_MATERIAL', code: 'MAT-ADH', quantity: '2.0000', completedAt: '2026-11-08T13:30:55Z',
  }],
};
const meta = { page: 1, limit: 20, total: 1, totalPages: 1 };

function setup() {
  const injector = Injector.create({ providers: [] });
  const request = vi.fn();
  const context = { signal: new AbortController().signal, http: { request } } as unknown as PortalContext;
  const page = runInInjectionContext(injector, () => new PendingPricesPageComponent());
  page.context = context;
  return { page, request, injector };
}

it('lists encounters waiting for a price with the missing codes from Billing', async () => {
  const { page, request, injector } = setup();
  try {
    request.mockResolvedValue({ ok: true, status: 200, data: { data: [account], meta } });
    await page.load(1);
    expect(request.mock.calls[0][0]).toMatchObject({ method: 'GET',
      path: '/api/v1/encounter-accounts/pending-prices', query: { page: ['1'], limit: ['20'] } });
    expect(page.accounts).toHaveLength(1);
    expect(page.accounts[0].missingSources[0]).toMatchObject({ code: 'MAT-ADH', itemType: 'ADDITIONAL_MATERIAL' });
    expect(page.itemTypeLabel('ADDITIONAL_MATERIAL')).toBe('Material adicional');
    expect(page.quantity('2.0000')).toBe('2');
    expect(page.message).toBe('');
  } finally { injector.destroy(); }
});

it('says so when nothing is pending and when Billing cannot answer', async () => {
  const { page, request, injector } = setup();
  try {
    request.mockResolvedValueOnce({ ok: true, status: 200, data: { data: [], meta: { ...meta, total: 0, totalPages: 0 } } });
    await page.load(1);
    expect(page.message).toBe('No hay atenciones esperando precio.');
    request.mockResolvedValueOnce({ ok: false, status: 503 });
    await page.load(1);
    expect(page.accounts).toEqual([]);
    expect(page.message).toBe('No fue posible consultar las atenciones pendientes. Puede reintentar.');
    request.mockResolvedValueOnce({ ok: true, status: 200, data: { data: [{ ...account, missingSources: 'x' }], meta } });
    await page.load(1);
    expect(page.message).toBe('No fue posible consultar las atenciones pendientes. Puede reintentar.');
  } finally { injector.destroy(); }
});
