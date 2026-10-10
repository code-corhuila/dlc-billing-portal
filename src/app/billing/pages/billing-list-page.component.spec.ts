import {
  describe,
  expect,
  it,
} from 'vitest';

import { BillingListPageComponent } from './billing-list-page.component';

describe('BillingListPageComponent', () => {
  it('exposes the billing summary metrics', () => {
    const component = new BillingListPageComponent();

    expect(component.monthlyIncome).toBe(250000);
    expect(component.pendingInvoices).toBe(2);
    expect(component.paidInvoices).toBe(1);
  });

  it('starts with a billing invoice list', () => {
    const component = new BillingListPageComponent();

    expect(component.invoices.length).toBe(3);

    expect(component.invoices[0]).toEqual({
      id: 'invoice-001',
      number: 'INV-001',
      patientName: 'Paciente de demostración',
      amount: 130000,
      status: 'PARTIAL',
    });
  });
});