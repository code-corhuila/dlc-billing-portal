import '@angular/compiler';
import { ElementRef, Injector, runInInjectionContext } from '@angular/core';
import { expect, it, vi } from 'vitest';
import { InvoicePaymentPageComponent } from './invoice-payment-page.component';
import { DemoInvoicePayments } from '../data/demo-invoice-payments';
import { dummyInvoiceList } from '../data/invoice-list.dummy';

it('registers a payable invoice once, clears the form and displays local history', () => {
  const injector = Injector.create({ providers: [] });
  try {
    const page = runInInjectionContext(injector, () => new InvoicePaymentPageComponent());
    page.session = new DemoInvoicePayments(dummyInvoiceList); page.invoiceId = 'invoice-001'; page.canPay = true;
    const focus = vi.fn();
    page.paymentHeading = new ElementRef({ focus } as unknown as HTMLElement);
    page.amount = '99999.99'; page.method = 'demo';
    expect(page.dirty).toBe(true); expect(page.canSubmit).toBe(true);
    page.submit(); page.submit();
    expect(focus).toHaveBeenCalledTimes(1);
    expect(page.invoice?.balance).toBe('0.01');
    expect(page.history).toHaveLength(1); expect(page.dirty).toBe(false);
    page.amount = '0.01'; page.method = 'demo'; page.submit();
    expect(page.invoice?.status).toBe('PAID'); expect(page.history).toHaveLength(2);
  } finally { injector.destroy(); }
});

it('retains the same intent for explicit retry and changes it when the draft changes', () => {
  const injector = Injector.create({ providers: [] });
  try {
    const page = runInInjectionContext(injector, () => new InvoicePaymentPageComponent());
    const ledger = new DemoInvoicePayments(dummyInvoiceList);
    const register = vi.fn(() => { throw new Error('Demo failure'); });
    page.session = { read: () => ledger.read(), detail: id => ledger.detail(id), history: id => ledger.history(id), register };
    page.invoiceId = 'invoice-001'; page.canPay = true; page.amount = '1.00'; page.method = 'demo';
    page.submit(); page.submit();
    expect(register.mock.calls[0][3]).toBe(register.mock.calls[1][3]);
    page.amount = '2.00'; page.submit();
    expect(register.mock.calls[2][3]).not.toBe(register.mock.calls[0][3]);
  } finally { injector.destroy(); }
});

it('denies invalid, unauthorized and disposed submissions and permits explicit discard', () => {
  const injector = Injector.create({ providers: [] });
  const page = runInInjectionContext(injector, () => new InvoicePaymentPageComponent());
  page.session = new DemoInvoicePayments(dummyInvoiceList); page.invoiceId = 'invoice-001';
  page.amount = '1.00'; page.method = 'demo'; page.submit(); expect(page.history).toEqual([]);
  page.canPay = true; page.amount = '100000.01'; expect(page.canSubmit).toBe(false);
  page.discard(); expect(page.dirty).toBe(false);
  page.invoiceId = 'invoice-002'; page.amount = '59999.99'; page.method = 'demo'; expect(page.canSubmit).toBe(false);
  page.amount = '60000.00'; expect(page.canSubmit).toBe(true);
  page.invoiceId = 'missing'; expect(page.invoice).toBeUndefined();
  page.invoiceId = 'invoice-001'; page.amount = '1.00'; page.method = 'demo';
  injector.destroy(); page.submit(); expect(page.history).toEqual([]);
});
