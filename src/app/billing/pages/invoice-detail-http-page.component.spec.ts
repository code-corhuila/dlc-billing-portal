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

it('provides a back event without payment or issuance actions', () => {
  const page = setup();
  const back = vi.fn();

  page.back.subscribe(back);
  page.back.emit();

  expect(back).toHaveBeenCalledOnce();
  expect('pay' in page).toBe(false);
  expect('issue' in page).toBe(false);
});
