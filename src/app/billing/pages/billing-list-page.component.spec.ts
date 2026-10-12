import '@angular/compiler';

import {
  describe,
  beforeEach,
  expect,
  it,
} from 'vitest';

import { BillingListPageComponent } from './billing-list-page.component';
import { dummyInvoiceList } from '../data/invoice-list.dummy';

describe('BillingListPageComponent', () => {
  let component: BillingListPageComponent;
  beforeEach(() => {
    component = new BillingListPageComponent();
    component.invoices = dummyInvoiceList.read();
  });
  it('does not choose a data source before receiving rows', () => {
    expect(new BillingListPageComponent().invoices).toEqual([]);
  });
  it('uses supplied invoice rows instead of default fixtures (regression)', () => {
    component.invoices = [{ id: 'external-demo', number: 'DEMO-42', patientName: 'Demo', amount: 50000, status: 'ISSUED' }];
    component.updateSearchTerm('DEMO-42');
    expect(component.paginatedInvoices.map(i => i.id)).toEqual(['external-demo']);
    expect(component.totalPages).toBe(1);
  });
  it('emits a selected invoice for composed navigation without owning a router', () => {
    const selected: string[] = [];
    component.openInvoice.subscribe(id => selected.push(id));
    component.openInvoice.emit('invoice-002');
    expect(selected).toEqual(['invoice-002']);
  });
  it('exposes the billing summary metrics', () => {

    expect(component.monthlyIncome).toBe('250000.00');
    expect(component.pendingInvoices).toBe(2);
    expect(component.paidInvoices).toBe(1);
  });

  it('starts with a billing invoice list', () => {

    expect(component.invoices.length).toBe(3);

    expect(component.invoices[0]).toEqual({
      id: 'invoice-001',
      number: 'INV-001',
      patientName: 'Paciente de demostración',
      amount: '130000.00',
      status: 'PARTIALLY_PAID',
    });
  });

  it('filters the contract partial-payment state and isolates dummy data between instances', () => {
    component.updateSelectedStatus('PARTIALLY_PAID');
    expect(component.selectedStatus).toBe('PARTIALLY_PAID');
    expect(component.filteredInvoices.map(i => i.id)).toEqual(['invoice-001']);
    component.invoices[0].amount = 1;
    const other = new BillingListPageComponent();
    other.invoices = dummyInvoiceList.read();
    expect(other.invoices[0].amount).toBe('130000.00');
  });

  it('filters invoices by invoice number or patient name', () => {

    component.searchTerm = 'INV-002';

    expect(component.filteredInvoices.length).toBe(1);
    expect(component.filteredInvoices[0].number).toBe('INV-002');

    component.searchTerm = 'demostración 3';

    expect(component.filteredInvoices.length).toBe(1);
    expect(component.filteredInvoices[0].id).toBe('invoice-003');
  });

  it('filters invoices by status', () => {

    component.selectedStatus = 'PAID';

    expect(component.filteredInvoices.length).toBe(1);
    expect(component.filteredInvoices[0].status).toBe('PAID');
  });

  it('combines search and status filters', () => {

    component.searchTerm = 'Paciente';
    component.selectedStatus = 'ISSUED';

    expect(component.filteredInvoices.length).toBe(1);
    expect(component.filteredInvoices[0].id).toBe('invoice-002');
  });

  it('shows all invoices when no status filter is selected', () => {

    component.selectedStatus = 'ALL';

    expect(component.filteredInvoices.length).toBe(3);
  });

  it('builds the feature-relative invoice detail path', () => {

    expect(
      component.getInvoiceDetailPath('invoice-002'),
    ).toBe('invoices/invoice-002');
  });

  it('starts on the first invoice page', () => {

    expect(component.currentPage).toBe(1);
    expect(component.pageSize).toBe(2);
    expect(
      component.paginatedInvoices.map((invoice) => invoice.id),
    ).toEqual([
      'invoice-001',
      'invoice-002',
    ]);
  });

  it('moves to the next invoice page', () => {

    component.nextPage();

    expect(component.currentPage).toBe(2);
    expect(
      component.paginatedInvoices.map((invoice) => invoice.id),
    ).toEqual([
      'invoice-003',
    ]);
  });

  it('does not move past the last invoice page', () => {

    component.nextPage();
    component.nextPage();

    expect(component.currentPage).toBe(2);
  });

  it('moves back to the previous invoice page', () => {

    component.nextPage();
    component.previousPage();

    expect(component.currentPage).toBe(1);
  });

  it('does not move before the first invoice page', () => {

    component.previousPage();

    expect(component.currentPage).toBe(1);
  });

  it('returns to the first page when the search changes', () => {

    component.nextPage();

    expect(component.currentPage).toBe(2);

    component.updateSearchTerm('INV-002');

    expect(component.currentPage).toBe(1);
    expect(component.searchTerm).toBe('INV-002');
    expect(
      component.paginatedInvoices.map((invoice) => invoice.id),
    ).toEqual([
      'invoice-002',
    ]);
  });

  it('returns to the first page when the status filter changes', () => {

    component.nextPage();

    expect(component.currentPage).toBe(2);

    component.updateSelectedStatus('ISSUED');

    expect(component.currentPage).toBe(1);
    expect(component.selectedStatus).toBe('ISSUED');
    expect(
      component.paginatedInvoices.map((invoice) => invoice.id),
    ).toEqual([
      'invoice-002',
    ]);
  });
});
