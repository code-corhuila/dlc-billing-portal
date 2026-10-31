import '@angular/compiler';

import {
  describe,
  beforeEach,
  expect,
  it,
} from 'vitest';

import { BillingListPageComponent } from './billing-list-page.component';
import { dummyInvoiceList } from '../data/invoice-list.dummy';
import { copMoney } from '../model/cop-money';

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
    component.invoices = [
      {
        id: 'external-demo',
        number: 'DEMO-42',
        patientName: 'Demo',
        amount: copMoney('50000.00'),
        status: 'ISSUED',
      },
    ];

    component.updateSearchTerm('DEMO-42');

    expect(component.paginatedInvoices.map(i => i.id)).toEqual([
      'external-demo',
    ]);
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

  it('counts paid and payable rows after payment changes without depending on search', () => {
    component.invoices[0].status = 'PAID';
    component.searchTerm = 'missing';

    expect(component.pendingInvoices).toBe(1);
    expect(component.paidInvoices).toBe(2);

    component.invoices = component.invoices.map(row => ({
      ...row,
      status: 'DRAFT',
    }));

    expect(component.pendingInvoices).toBe(0);

    component.invoices = [];
    expect(component.paidInvoices).toBe(0);
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
    expect(component.filteredInvoices.map(i => i.id)).toEqual([
      'invoice-001',
    ]);

    component.invoices[0].amount = copMoney('1.00');

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
    expect(component.getInvoiceDetailPath('invoice-002')).toBe(
      'invoices/invoice-002',
    );
  });

  it('starts on the first invoice page', () => {
    expect(component.currentPage).toBe(1);
    expect(component.pageSize).toBe(2);

    expect(
      component.paginatedInvoices.map(invoice => invoice.id),
    ).toEqual(['invoice-001', 'invoice-002']);
  });

  it('moves to the next invoice page', () => {
    component.nextPage();

    expect(component.currentPage).toBe(2);
    expect(
      component.paginatedInvoices.map(invoice => invoice.id),
    ).toEqual(['invoice-003']);
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
      component.paginatedInvoices.map(invoice => invoice.id),
    ).toEqual(['invoice-002']);
  });

  it('returns to the first page when the status filter changes', () => {
    component.nextPage();

    component.updateSelectedStatus('ISSUED');

    expect(component.currentPage).toBe(1);
    expect(component.selectedStatus).toBe('ISSUED');

    expect(
      component.paginatedInvoices.map(invoice => invoice.id),
    ).toEqual(['invoice-002']);
  });

  it('uses demo mode by default', () => {
    expect(component.readOnly).toBe(false);
    expect(component.showDemoSummary).toBe(true);
    expect(component.canOpenInvoice).toBe(true);
  });

  it('hides demo financial summaries in read-only mode', () => {
    component.readOnly = true;

    expect(component.showDemoSummary).toBe(false);
  });

  it('prevents demo invoice navigation in read-only mode', () => {
    component.readOnly = true;

    expect(component.canOpenInvoice).toBe(false);
    expect(component.getInvoiceDetailPath('invoice-002')).toBeNull();
  });

  it('allows explicitly enabled HTTP invoice navigation', () => {
    component.readOnly = true;
    component.composed = true;
    component.canNavigateToInvoice = true;

    expect(component.canOpenInvoice).toBe(true);
  });

  it('keeps HTTP invoice navigation disabled by default', () => {
    component.readOnly = true;

    expect(component.canNavigateToInvoice).toBe(false);
    expect(component.canOpenInvoice).toBe(false);
  });

  it('does not reveal demo summaries when HTTP navigation is enabled', () => {
    component.readOnly = true;
    component.composed = true;
    component.canNavigateToInvoice = true;

    expect(component.showDemoSummary).toBe(false);
    expect(component.patientColumnLabel).toBe('ID del paciente');
  });

  it('identifies patient references without claiming they are names', () => {
    component.readOnly = true;
    component.invoices = [
      {
        id: 'real-invoice',
        number: 'INV-REAL',
        patientName: 'patient-001',
        amount: copMoney('150000.00'),
        status: 'ISSUED',
      },
    ];

    expect(component.patientColumnLabel).toBe('ID del paciente');
    expect(component.displayPatient(component.invoices[0])).toBe(
      'patient-001',
    );
  });

  it('keeps demo patient labels unchanged', () => {
    expect(component.patientColumnLabel).toBe('Paciente');
    expect(component.displayPatient(component.invoices[0])).toBe(
      component.invoices[0].patientName,
    );
  });

  it('does not treat HTTP loading as an empty invoice search result', () => {
    component.readOnly = true;
    component.invoices = [];
    component.readStatus = 'loading';

    expect(component.isLoading).toBe(true);
    expect(component.showNoResultsMessage).toBe(false);
  });

  it('presents HTTP errors without displaying an empty-search message', () => {
    component.readOnly = true;
    component.invoices = [];
    component.readStatus = 'error';

    expect(component.readFeedback).toBe('No fue posible consultar las facturas.');
    expect(component.showNoResultsMessage).toBe(false);
  });

  it('presents HTTP cancellation separately from empty results', () => {
    component.readOnly = true;
    component.invoices = [];
    component.readStatus = 'cancelled';

    expect(component.readFeedback).toBe('La consulta de facturas fue cancelada.');
    expect(component.showNoResultsMessage).toBe(false);
  });

  it('identifies a successful HTTP response with no invoices', () => {
    component.readOnly = true;
    component.invoices = [];
    component.readStatus = 'success';

    expect(component.readFeedback).toBe('No hay facturas disponibles.');
    expect(component.showNoResultsMessage).toBe(false);
  });

  it('preserves filter feedback when HTTP invoices have no matches', () => {
    component.readOnly = true;
    component.readStatus = 'success';
    component.updateSearchTerm('invoice-that-does-not-exist');

    expect(component.readFeedback).toBeNull();
    expect(component.showNoResultsMessage).toBe(true);
  });
});
