import '@angular/compiler';
import { Injector, runInInjectionContext } from '@angular/core';
import { expect, it } from 'vitest';
import { PricingCatalogComponent } from './pages/pricing-catalog/pricing-catalog.component';
import { PricingCatalogService } from './services/pricing-catalog.service';

it('starts with current prices and combines the current-only filter with search without changing history', () => {
  const service = new PricingCatalogService();
  service.demoPrices.set(service.createNewVersion(service.getFixtures(), {
    procedureCode: 'PROC-001', procedureName: 'Profilaxis actualizada', amount: '90000.01', validFrom: '2026-10-12',
  }));
  const injector = Injector.create({ providers: [{ provide: PricingCatalogService, useValue: service }] });
  try {
    const page = runInInjectionContext(injector, () => new PricingCatalogComponent());
    expect(page.onlyActive).toBe(true);
    expect(page.filteredPrices).toHaveLength(3);
    page.searchTerm = 'proc-001';
    expect(page.filteredPrices.map(price => price.version)).toEqual([2]);
    page.onlyActive = false;
    expect(page.filteredPrices.map(price => price.version)).toEqual([2, 1]);
    expect(service.demoPrices()).toHaveLength(4);
    page.onlyActive = true;
    page.searchTerm = 'absent';
    expect(page.filteredPrices).toEqual([]);
  } finally { injector.destroy(); }
});
