
import { describe, expect, it } from 'vitest';
import {
  createInvoiceDetailReadState,
  invoiceDetailReadLoading,
  invoiceDetailReadSuccess,
  invoiceDetailReadError,
  invoiceDetailReadCancelled,
} from './invoice-detail-read-state';
import { readInvoiceDetail } from './invoice-read-adapter';

describe('invoice detail read state', () => {
  const invoice = readInvoiceDetail({
    id: '11111111-1111-4111-8111-111111111111',
    patientId: '22222222-2222-4222-8222-222222222222',
    items: [],
    total: '150000.00',
    balance: '75000.00',
    currency: 'COP',
    status: 'PARTIALLY_PAID',
    version: 3,
  });

  it('starts idle without an invoice', () => {
    expect(createInvoiceDetailReadState()).toEqual({
      status: 'idle',
      invoice: undefined,
    });
  });

  it('enters loading without retaining the previous invoice', () => {
    const previous = invoiceDetailReadSuccess(invoice);

    expect(invoiceDetailReadLoading(previous)).toEqual({
      status: 'loading',
      invoice: undefined,
    });
  });

  it('stores a successfully loaded invoice with its version', () => {
    const state = invoiceDetailReadSuccess(invoice);

    expect(state).toEqual({
      status: 'success',
      invoice,
    });

    expect(state.invoice?.version).toBe(3);
    expect(state.invoice?.total).toBe('150000.00');
    expect(state.invoice?.balance).toBe('75000.00');
  });

  it('does not expose a previous invoice after an error', () => {
    const previous = invoiceDetailReadSuccess(invoice);

    expect(invoiceDetailReadError(previous)).toEqual({
      status: 'error',
      invoice: undefined,
    });
  });

  it('does not expose a previous invoice after cancellation', () => {
    const previous = invoiceDetailReadSuccess(invoice);

    expect(invoiceDetailReadCancelled(previous)).toEqual({
      status: 'cancelled',
      invoice: undefined,
    });
  });

  it('does not mutate the input invoice', () => {
    const originalItems = invoice.items;
    const originalVersion = invoice.version;

    invoiceDetailReadSuccess(invoice);

    expect(invoice.items).toBe(originalItems);
    expect(invoice.version).toBe(originalVersion);
  });
});
