import '@angular/compiler';
import { Injector, runInInjectionContext } from '@angular/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PricingCatalogService } from './services/pricing-catalog.service';
import { PricingCatalogComponent } from './pages/pricing-catalog/pricing-catalog.component';
import { ExtraChargeRulesComponent } from './pages/extra-charge-rules/extra-charge-rules.component';
import { copMoney } from '../model/cop-money';

// Regression evidence for existing dummy behavior; these are not API or DOM tests.
const priceRequest = { procedureCode: 'PROC-001', procedureName: 'Updated price', amount: '90000.00', validFrom: '2026-10-11' };
const ruleRequest = { code: 'EXTRA-MATERIAL-001', name: 'Updated material', description: 'Dummy charge', type: 'MATERIAL' as const, amount: 25000, validFrom: '2026-10-11' };
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('Pricing service regression', () => {
  const service = new PricingCatalogService();
  it('isolates fixture objects between callers', () => {
    const prices = service.getFixtures();
    prices[0].amount = copMoney('1.00');
    expect(service.getFixtures()[0].amount).toBe('80000.00');
  });
  it('normalizes search and matches names, codes, empty and missing results', () => {
    const prices = service.getFixtures();
    expect(service.filterPrices(prices, '  ')).toEqual(prices);
    expect(service.filterPrices(prices, ' PROFILAXIS ')).toEqual([prices[0]]);
    expect(service.filterPrices(prices, 'proc-002')).toEqual([prices[1]]);
    expect(service.filterPrices(prices, 'absent')).toEqual([]);
  });
  it('versions a price without mutating existing history or unrelated procedures', () => {
    const prices = service.getFixtures();
    const result = service.createNewVersion(prices, { ...priceRequest, procedureCode: ' PROC-001 ', procedureName: ' Updated price ' });
    expect(result[0]).toMatchObject({ ...priceRequest, version: 2, active: true, currency: 'COP' });
    expect(result.find(p => p.id === prices[0].id)?.active).toBe(false);
    expect(prices[0].active).toBe(true);
    expect(result.find(p => p.id === prices[1].id)).toEqual(prices[1]);
    const next = service.createNewVersion(result, priceRequest);
    expect(next[0].version).toBe(3);
    expect(next.filter(p => p.procedureCode === 'PROC-001' && p.active)).toHaveLength(1);
    expect(service.createNewVersion([], priceRequest)[0].version).toBe(1);
  });
});

describe('Pricing page regression', () => {
  let page: PricingCatalogComponent;
  beforeEach(() => {
    const injector = Injector.create({ providers: [{ provide: PricingCatalogService, useValue: new PricingCatalogService() }] });
    page = runInInjectionContext(injector, () => new PricingCatalogComponent());
  });
  it('searches, displays COP amounts and restores empty/error fixture states', () => {
    page.searchTerm = 'proc-001';
    expect(page.filteredPrices).toHaveLength(1);
    expect(page.formatMoney(copMoney('80000.00'))).toContain('80.000');
    page.simulateError();
    expect(page.prices()).toEqual([]);
    expect(page.errorMessage()).not.toBe('');
    page.simulateEmpty();
    expect(page.errorMessage()).toBe('');
    page.restoreFixtures();
    expect(page.prices()).toHaveLength(3);
  });
  it.each([{ procedureCode: ' ' }, { procedureName: ' ' }, { amount: '0.00' }, { validFrom: '' }])('rejects invalid price fields %j', invalid => {
    page.form = { ...priceRequest, ...invalid };
    page.submitPrice();
    expect(page.submitting()).toBe(false);
    expect(page.prices()).toHaveLength(3);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('keeps the form open while pending and completes a simulated version', () => {
    page.openForm();
    page.form = { ...priceRequest };
    page.submitPrice();
    expect(page.submitting()).toBe(true);
    page.closeForm();
    expect(page.formVisible()).toBe(true);
    vi.advanceTimersByTime(900);
    expect(page.submitting()).toBe(false);
    expect(page.formVisible()).toBe(false);
    expect(page.prices()[0]).toMatchObject({ version: 2, amount: '90000.00' });
    expect(page.successMessage()).not.toBe('');
    page.openForm();
    expect(page.form.amount).toBe('');
    expect(page.successMessage()).toBe('');
    page.closeForm();
    expect(page.formVisible()).toBe(false);
  });
});

describe('Extra-charge rules regression', () => {
  let page: ExtraChargeRulesComponent;
  beforeEach(() => { page = new ExtraChargeRulesComponent(); });
  it('searches names/codes and restores empty/error states', () => {
    expect(page.filteredRules).toHaveLength(3);
    page.searchTerm = ' MATERIAL ';
    expect(page.filteredRules).toHaveLength(1);
    page.searchTerm = 'extra-proc-001';
    expect(page.filteredRules[0].type).toBe('ADDITIONAL_PROCEDURE');
    page.searchTerm = 'absent';
    expect(page.filteredRules).toEqual([]);
    expect(page.formatMoney(25000)).toContain('25.000');
    expect(['MATERIAL', 'COMPLEXITY', 'ADDITIONAL_PROCEDURE', 'OTHER'].map(type => page.getTypeLabel(type as 'MATERIAL')))
      .toEqual(['Material', 'Complejidad', 'Procedimiento adicional', 'Otro']);
    page.simulateError();
    expect(page.rules()).toEqual([]);
    expect(page.errorMessage()).not.toBe('');
    page.simulateEmpty();
    expect(page.errorMessage()).toBe('');
    page.restoreFixtures();
    expect(page.rules()).toHaveLength(3);
  });
  it.each([{ amount: null }, { amount: -1 }, { code: ' ' }, { name: ' ' }, { description: ' ' }, { validFrom: '' }])('rejects invalid rule fields %j', invalid => {
    page.form = { ...ruleRequest, ...invalid };
    page.submitRule();
    expect(page.submitting()).toBe(false);
    expect(page.rules()).toHaveLength(3);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('versions a rule while preserving historical and unrelated entries', () => {
    const original = page.rules()[0];
    for (const version of [2, 3]) {
      page.openForm();
      page.form = { ...ruleRequest, code: ' EXTRA-MATERIAL-001 ' };
      page.submitRule();
      page.closeForm();
      expect(page.formVisible()).toBe(true);
      vi.advanceTimersByTime(900);
      expect(page.rules()[0]).toMatchObject({ ...ruleRequest, version, active: true, currency: 'COP' });
      expect(page.rules().filter(r => r.code === original.code && r.active)).toHaveLength(1);
      expect(page.rules().find(r => r.id === original.id)?.active).toBe(false);
      expect(page.submitting()).toBe(false);
      expect(page.formVisible()).toBe(false);
      expect(page.successMessage()).not.toBe('');
    }
    expect(original.active).toBe(true);
    expect(page.rules().find(r => r.code === 'EXTRA-COMPLEXITY-001')?.active).toBe(true);
    page.openForm();
    expect(page.form.amount).toBeNull();
    expect(page.successMessage()).toBe('');
    page.closeForm();
    expect(page.formVisible()).toBe(false);
  });
});
