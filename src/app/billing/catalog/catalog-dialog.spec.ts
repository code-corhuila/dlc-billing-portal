import '@angular/compiler';
import { ElementRef, Injector, runInInjectionContext } from '@angular/core';
import { afterEach, expect, it, vi } from 'vitest';
import { PricingCatalogComponent } from './pages/pricing-catalog/pricing-catalog.component';
import { PricingCatalogService } from './services/pricing-catalog.service';

afterEach(() => vi.useRealTimers());
it('opens the owned dialog for a new price and closes it on cancellation', () => {
  const injector = Injector.create({ providers: [{ provide: PricingCatalogService, useValue: new PricingCatalogService() }] });
  try {
    const page = runInInjectionContext(injector, () => new PricingCatalogComponent());
    const dialog = { showModal: vi.fn(), close: vi.fn() };
    page.priceDialog = new ElementRef(dialog as unknown as HTMLDialogElement);
    page.openForm(); expect(dialog.showModal).toHaveBeenCalledTimes(1);
    page.closeForm(); expect(dialog.close).toHaveBeenCalledTimes(1);
    expect(page.formVisible()).toBe(false);
  } finally { injector.destroy(); }
});

it('prefills the latest price for a new version, preserves history and closes after saving', () => {
  vi.useFakeTimers();
  const injector = Injector.create({ providers: [{ provide: PricingCatalogService, useValue: new PricingCatalogService() }] });
  try {
    const page = runInInjectionContext(injector, () => new PricingCatalogComponent());
    const original = page.prices()[0];
    const dialog = { showModal: vi.fn(), close: vi.fn() };
    page.priceDialog = new ElementRef(dialog as unknown as HTMLDialogElement);
    page.openForPrice(original);
    const focus = vi.fn();
    page.newPriceButton = new ElementRef({ focus } as unknown as HTMLButtonElement);
    expect(page.editing).toBe(true);
    expect(page.form).toMatchObject({ procedureCode: original.procedureCode, amount: original.amount, validFrom: '' });
    page.form.amount = '95000.01'; page.form.validFrom = '2026-10-12';
    page.submitPrice(); page.closeForm(); expect(dialog.close).not.toHaveBeenCalled();
    vi.runAllTimers(); expect(dialog.close).toHaveBeenCalledTimes(1);
    expect(focus).toHaveBeenCalledTimes(1);
    expect(page.prices()[0]).toMatchObject({ amount: '95000.01', version: 2 });
    expect(original.amount).toBe('80000.00');
    page.canManagePrices = false; page.openForPrice(page.prices()[0]);
    page.canManagePrices = true; page.openForPrice(original);
    expect(dialog.showModal).toHaveBeenCalledTimes(1);
  } finally { injector.destroy(); }
});
