import '@angular/compiler';

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

  it('filters invoices by invoice number or patient name', () => {
    const component = new BillingListPageComponent();

    component.searchTerm = 'INV-002';

    expect(component.filteredInvoices.length).toBe(1);
    expect(component.filteredInvoices[0].number).toBe('INV-002');

    component.searchTerm = 'demostración 3';

    expect(component.filteredInvoices.length).toBe(1);
    expect(component.filteredInvoices[0].id).toBe('invoice-003');
  });

  it('filters invoices by status', () => {
    const component = new BillingListPageComponent();

    component.selectedStatus = 'PAID';

    expect(component.filteredInvoices.length).toBe(1);
    expect(component.filteredInvoices[0].status).toBe('PAID');
  });

  it('combines search and status filters', () => {
    const component = new BillingListPageComponent();

    component.searchTerm = 'Paciente';
    component.selectedStatus = 'ISSUED';

    expect(component.filteredInvoices.length).toBe(1);
    expect(component.filteredInvoices[0].id).toBe('invoice-002');
  });

  it('shows all invoices when no status filter is selected', () => {
    const component = new BillingListPageComponent();

    component.selectedStatus = 'ALL';

    expect(component.filteredInvoices.length).toBe(3);
  });

  it('builds the feature-relative invoice detail path', () => {
    const component = new BillingListPageComponent();

    expect(
      component.getInvoiceDetailPath('invoice-002'),
    ).toBe('invoices/invoice-002');
  });
});