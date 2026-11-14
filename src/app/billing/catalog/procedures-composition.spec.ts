import '@angular/compiler';
import { Injector, runInInjectionContext } from '@angular/core';
import { afterEach, expect, it, vi } from 'vitest';
import { PricingCatalogService } from './services/pricing-catalog.service';
import { PricingCatalogComponent } from './pages/pricing-catalog/pricing-catalog.component';

const request = { procedureCode: 'PROC-001', procedureName: 'Demo price', amount: '90000.01', validFrom: '2026-10-12' };
afterEach(() => vi.useRealTimers());

it('preserves exact decimal prices and rejects noncanonical or nonpositive demo amounts', () => {
  const service = new PricingCatalogService();
  expect(service.getFixtures()[0].amount).toBe('80000.00');
  expect(service.createNewVersion(service.getFixtures(), request)[0].amount).toBe('90000.01');
  for (const amount of ['0.00', '-1.00', '1', '1.001', 'NaN', '9999999999999.00']) {
    expect(() => service.createNewVersion([], { ...request, amount })).toThrow();
  }
});

it('does not open or submit a demo price when the composed UI denies management', () => {
  vi.useFakeTimers();
  const injector = Injector.create({ providers: [{ provide: PricingCatalogService, useValue: new PricingCatalogService() }] });
  try {
    const page = runInInjectionContext(injector, () => new PricingCatalogComponent());
    page.canManagePrices = false;
    page.openForm(); page.form = { ...request }; page.submitPrice();
    expect(page.formVisible()).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  } finally { injector.destroy(); }
});

it('discards a pending demo submission when management is revoked', () => {
  vi.useFakeTimers();
  const injector = Injector.create({ providers: [{ provide: PricingCatalogService, useValue: new PricingCatalogService() }] });
  try {
    const page = runInInjectionContext(injector, () => new PricingCatalogComponent());
    page.form = { ...request }; page.submitPrice(); page.canManagePrices = false;
    vi.runAllTimers();
    expect(page.prices()).toHaveLength(3);
    expect(page.submitting()).toBe(false);
  } finally { injector.destroy(); }
});

it('snapshots one submission and retains versions across catalog recreation within a mount', () => {
  vi.useFakeTimers();
  const service = new PricingCatalogService();
  const injector = Injector.create({ providers: [{ provide: PricingCatalogService, useValue: service }] });
  try {
    const page = runInInjectionContext(injector, () => new PricingCatalogComponent());
    page.openForPrice(page.prices()[0]); page.form = { ...request }; page.submitPrice(); page.submitPrice();
    page.form.amount = '1.00';
    vi.runAllTimers();
    const next = runInInjectionContext(injector, () => new PricingCatalogComponent());
    expect(next.prices().filter(price => price.procedureCode === 'PROC-001')).toHaveLength(2);
    expect(next.prices()[0]).toMatchObject({ version: 2, amount: '90000.01' });
    expect(next.formatMoney(next.prices()[0].amount)).toContain('90.000,01');
  } finally { injector.destroy(); }
});

it('cancels its pending demo timer on destruction without updating shared catalog data', () => {
  vi.useFakeTimers();
  const injector = Injector.create({ providers: [{ provide: PricingCatalogService, useValue: new PricingCatalogService() }] });
  const page = runInInjectionContext(injector, () => new PricingCatalogComponent());
  page.form = { ...request }; page.submitPrice();
  const writes = vi.spyOn(page.prices, 'set');
  injector.destroy(); vi.runAllTimers();
  expect(writes).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
});

it('displays HTTP procedure prices instead of fixtures in composed mode', () => {
  const injector = Injector.create({
    providers: [{ provide: PricingCatalogService, useValue: new PricingCatalogService() }],
  });

  try {
    const page = runInInjectionContext(injector, () => new PricingCatalogComponent());
    page.composed = true;
    page.httpPrices = [{
      id: 'real-001',
      procedureCode: 'REAL-001',
      name: 'Real procedure',
      basePrice: '150000.00',
      currency: 'COP',
      status: 'ACTIVE',
      version: 1,
    }];

    expect(page.displayedPrices.map(price => price.id)).toEqual(['real-001']);
    expect(page.displayedPrices[0].basePrice).toBe('150000.00');
  } finally {
    injector.destroy();
  }
});

it('never falls back to demo prices when the HTTP catalog is empty or fails', () => {
  const injector = Injector.create({
    providers: [{ provide: PricingCatalogService, useValue: new PricingCatalogService() }],
  });

  try {
    const page = runInInjectionContext(injector, () => new PricingCatalogComponent());
    page.composed = true;
    page.httpPrices = [];
    page.httpReadStatus = 'success';

    expect(page.displayedPrices).toEqual([]);

    page.httpReadStatus = 'error';
    expect(page.displayedPrices).toEqual([]);
  } finally {
    injector.destroy();
  }
});

it('disables simulated price creation in composed mode', () => {
  vi.useFakeTimers();
  const injector = Injector.create({
    providers: [{ provide: PricingCatalogService, useValue: new PricingCatalogService() }],
  });

  try {
    const page = runInInjectionContext(injector, () => new PricingCatalogComponent());
    page.composed = true;
    page.canManagePrices = true;

    page.openForm();
    page.form = { ...request };
    page.submitPrice();

    expect(page.formVisible()).toBe(false);
    expect(page.submitting()).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  } finally {
    injector.destroy();
  }
});