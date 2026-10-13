import '@angular/compiler';
import { ElementRef, Injector, runInInjectionContext } from '@angular/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PricingCatalogComponent } from './pages/pricing-catalog/pricing-catalog.component';
import { PricingCatalogService } from './services/pricing-catalog.service';

const today = '2026-10-13';
afterEach(() => vi.useRealTimers());

describe('Procedure catalog versioning rules', () => {
  const service = new PricingCatalogService();

  it('creates a new procedure as version 1 and rejects existing codes regardless of case', () => {
    const created = service.createProcedure(service.getFixtures(), {
      procedureCode: ' proc-010 ', procedureName: ' Resina ', amount: '150000.00', validFrom: '2026-10-20',
    });
    expect(created[0]).toMatchObject({ procedureCode: 'PROC-010', procedureName: 'Resina', version: 1, validTo: null });
    expect(() => service.createProcedure(service.getFixtures(), {
      procedureCode: 'proc-001', procedureName: 'Duplicado', amount: '1.00', validFrom: '2026-10-20',
    })).toThrow();
  });

  it('closes the previous validity the day before a new version starts and keeps the name', () => {
    const prices = service.getFixtures();
    const next = service.createNewVersion(prices, {
      procedureCode: 'proc-001', procedureName: 'Ignorado', amount: '95000.00', validFrom: '2026-12-01',
    });
    expect(next[0]).toMatchObject({ procedureCode: 'PROC-001', procedureName: 'Profilaxis dental', version: 2, validTo: null });
    expect(next.find(p => p.id === prices[0].id)?.validTo).toBe('2026-11-30');
    expect(prices[0].validTo).toBeNull();
  });

  it('rejects versions for unknown procedures or starting on or before the latest version', () => {
    const prices = service.getFixtures();
    const request = { procedureCode: 'PROC-001', procedureName: 'x', amount: '1.00', validFrom: '2026-09-01' };
    expect(() => service.createNewVersion(prices, request)).toThrow();
    expect(() => service.createNewVersion(prices, { ...request, procedureCode: 'PROC-999', validFrom: '2026-12-01' })).toThrow();
    expect(service.minVersionDate(prices, 'proc-001')).toBe('2026-09-02');
  });

  it('derives current, scheduled and historical status from validity dates', () => {
    const next = service.createNewVersion(service.getFixtures(), {
      procedureCode: 'PROC-001', procedureName: 'x', amount: '95000.00', validFrom: '2026-12-01',
    });
    expect(service.priceStatus(next[0], today)).toBe('SCHEDULED');
    expect(service.priceStatus(next[1], today)).toBe('CURRENT');
    expect(service.priceStatus(next[1], '2026-12-01')).toBe('HISTORICAL');
  });
});

describe('Procedure catalog page modes', () => {
  function mount() {
    const injector = Injector.create({ providers: [{ provide: PricingCatalogService, useValue: new PricingCatalogService() }] });
    const page = runInInjectionContext(injector, () => new PricingCatalogComponent());
    page.today = today;
    page.priceDialog = new ElementRef({ showModal: vi.fn(), close: vi.fn() } as unknown as HTMLDialogElement);
    return { injector, page };
  }

  it('blocks a duplicated code in creation mode instead of silently versioning it', () => {
    vi.useFakeTimers();
    const { injector, page } = mount();
    try {
      page.openForm();
      page.form = { procedureCode: 'proc-001', procedureName: 'Otra', amount: '1.00', validFrom: '2026-10-20' };
      expect(page.duplicateCode).toBe(true);
      page.submitPrice();
      expect(vi.getTimerCount()).toBe(0);
      expect(page.prices()).toHaveLength(3);
    } finally { injector.destroy(); }
  });

  it('keeps a scheduled version out of the current price until its start date', () => {
    vi.useFakeTimers();
    const { injector, page } = mount();
    try {
      page.openForPrice(page.prices()[0]);
      expect(page.minValidFrom).toBe('2026-09-02');
      page.form.amount = '95000.00'; page.form.validFrom = '2026-09-01';
      page.submitPrice(); expect(vi.getTimerCount()).toBe(0);
      page.form.validFrom = '2026-12-01';
      page.submitPrice(); vi.runAllTimers();
      const versions = page.prices().filter(p => p.procedureCode === 'PROC-001');
      expect(versions.map(p => page.statusOf(p))).toEqual(['SCHEDULED', 'CURRENT']);
      expect(page.canVersion(versions[1])).toBe(false);
      expect(page.canVersion(versions[0])).toBe(true);
    } finally { injector.destroy(); }
  });
});
