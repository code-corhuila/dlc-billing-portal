import '@angular/compiler';
import { expect, it, vi } from 'vitest';
import { InvoiceDetailHttpPageComponent } from './invoice-detail-http-page.component';
import {
  createInvoiceDetailReadState,
  invoiceDetailReadSuccess,
  type InvoiceDetailReadState,
} from '../data/invoice-detail-read-state';
import type { ReadInvoice } from '../data/invoice-read-adapter';
import { copMoney } from '../model/cop-money';

const invoice: ReadInvoice = {
  id: '11111111-1111-4111-8111-111111111111',
  patientId: '22222222-2222-4222-8222-222222222222',
  appointmentId: '33333333-3333-4333-8333-333333333333',
  invoiceNumber: 'INV-2026-001',
  items: [{ description: 'Unverified procedure' }],
  total: copMoney('150000.00'),
  balance: copMoney('75000.00'),
  currency: 'COP',
  status: 'PARTIALLY_PAID',
  version: 3,
};

function setup(state: InvoiceDetailReadState = createInvoiceDetailReadState()) {
  const page = new InvoiceDetailHttpPageComponent();
  page.readState = state;
  return page;
}

it('starts idle without selecting a demo invoice', () => {
  const page = setup();

  expect(page.readState.status).toBe('idle');
  expect(page.selectedInvoice).toBeUndefined();
  expect(page.statusMessage).toBe('No se ha consultado una factura.');
});

it('reports loading without exposing stale invoice data', () => {
  const page = setup({
    status: 'loading',
    invoice: undefined,
  });

  expect(page.selectedInvoice).toBeUndefined();
  expect(page.statusMessage).toBe('Consultando factura...');
});

it('presents only validated invoice fields and exact COP amounts', () => {
  const page = setup(invoiceDetailReadSuccess(invoice));

  expect(page.selectedInvoice).toBe(invoice);
  expect(page.displayNumber).toBe('INV-2026-001');
  expect(page.statusLabel).toBe('Pago parcial');
  expect(page.formattedTotal).toBe('150.000,00');
  expect(page.formattedBalance).toBe('75.000,00');
  expect(page.selectedInvoice?.version).toBe(3);
  expect(page.selectedInvoice?.patientId).toBe(invoice.patientId);
  expect(page.selectedInvoice?.appointmentId).toBe(invoice.appointmentId);
});

it('uses the invoice identifier when the optional number is absent', () => {
  const page = setup(invoiceDetailReadSuccess({
    ...invoice,
    invoiceNumber: undefined,
    appointmentId: undefined,
  }));

  expect(page.displayNumber).toBe(invoice.id);
  expect(page.selectedInvoice?.appointmentId).toBeUndefined();
});

it('reports errors without presenting stale invoice data', () => {
  const page = setup({
    status: 'error',
    invoice: undefined,
  });

  expect(page.selectedInvoice).toBeUndefined();
  expect(page.statusMessage).toBe('No fue posible consultar la factura.');
});

it('reports cancellation without presenting invoice data', () => {
  const page = setup({
    status: 'cancelled',
    invoice: undefined,
  });

  expect(page.selectedInvoice).toBeUndefined();
  expect(page.statusMessage).toBe('La consulta de la factura fue cancelada.');
});

it('provides a back event without payment actions', () => {
  const page = setup();
  const back = vi.fn();

  page.back.subscribe(back);
  page.back.emit();

  expect(back).toHaveBeenCalledOnce();
  expect('pay' in page).toBe(false);
});

it('does not allow issuance by default', () => {
  const page = setup(invoiceDetailReadSuccess({
    ...invoice,
    status: 'DRAFT',
  }));

  expect(page.canIssue).toBe(false);
});

it('allows authorized issuance only for a loaded DRAFT invoice', () => {
  const page = setup(invoiceDetailReadSuccess({
    ...invoice,
    status: 'DRAFT',
  }));

  page.canIssueInvoices = true;

  expect(page.canIssue).toBe(true);
});

it('does not allow issuance of an already issued invoice', () => {
  const page = setup(invoiceDetailReadSuccess({
    ...invoice,
    status: 'ISSUED',
  }));

  page.canIssueInvoices = true;

  expect(page.canIssue).toBe(false);
});

it('does not allow issuance of a partially paid invoice', () => {
  const page = setup(invoiceDetailReadSuccess(invoice));
  page.canIssueInvoices = true;

  expect(page.canIssue).toBe(false);
});

it('does not allow issuance without a successful invoice read', () => {
  const page = setup();
  page.canIssueInvoices = true;

  expect(page.canIssue).toBe(false);
});

it('emits the loaded invoice id and version without changing invoice data', () => {
  const draft = {
    ...invoice,
    status: 'DRAFT' as const,
  };

  const page = setup(invoiceDetailReadSuccess(draft));
  page.canIssueInvoices = true;

  const issue = vi.fn();
  page.issue.subscribe(issue);

  page.requestIssuance();

  expect(issue).toHaveBeenCalledExactlyOnceWith({
    invoiceId: draft.id,
    expectedVersion: draft.version,
  });

  expect(draft.status).toBe('DRAFT');
  expect(draft.version).toBe(3);
});

it('does not emit an issuance event when unauthorized', () => {
  const page = setup(invoiceDetailReadSuccess({
    ...invoice,
    status: 'DRAFT',
  }));

  const issue = vi.fn();
  page.issue.subscribe(issue);

  page.requestIssuance();

  expect(issue).not.toHaveBeenCalled();
});

it('does not emit duplicate issuance intents while submitting', () => {
  const page = setup(invoiceDetailReadSuccess({
    ...invoice,
    status: 'DRAFT',
  }));

  page.canIssueInvoices = true;
  page.issuing = true;

  const issue = vi.fn();
  page.issue.subscribe(issue);

  page.requestIssuance();

  expect(page.canIssue).toBe(false);
  expect(issue).not.toHaveBeenCalled();
});
