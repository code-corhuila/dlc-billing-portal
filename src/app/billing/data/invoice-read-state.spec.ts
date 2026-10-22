import { describe, expect, it } from 'vitest';

import {
  createInvoiceReadState,
  invoiceReadLoading,
  invoiceReadSuccess,
  invoiceReadError,
  invoiceReadCancelled,
} from './invoice-read-state';

import type { InvoiceListItem } from '../model/invoice-list-item';
import { copMoney } from '../model/cop-money';

describe('invoice read state', () => {
  const invoice: InvoiceListItem = {
    id: 'invoice-001',
    number: 'INV-001',
    patientName: 'patient-001',
    amount: copMoney('150000.00'),
    status: 'ISSUED',
  };

  it('starts idle without invoices', () => {
    expect(createInvoiceReadState()).toEqual({
      status: 'idle',
      invoices: [],
    });
  });

  it('enters loading without retaining previous invoices', () => {
    const previous = invoiceReadSuccess([invoice]);

    expect(invoiceReadLoading(previous)).toEqual({
      status: 'loading',
      invoices: [],
    });
  });

  it('stores successfully loaded invoices', () => {
    expect(invoiceReadSuccess([invoice])).toEqual({
      status: 'success',
      invoices: [invoice],
    });
  });

  it('accepts an empty successful response', () => {
    expect(invoiceReadSuccess([])).toEqual({
      status: 'success',
      invoices: [],
    });
  });

  it('does not expose previous or demo invoices on error', () => {
    const previous = invoiceReadSuccess([invoice]);

    expect(invoiceReadError(previous)).toEqual({
      status: 'error',
      invoices: [],
    });
  });

  it('does not expose invoices after cancellation', () => {
    const previous = invoiceReadSuccess([invoice]);

    expect(invoiceReadCancelled(previous)).toEqual({
      status: 'cancelled',
      invoices: [],
    });
  });

  it('does not mutate the input invoice collection', () => {
    const invoices = [invoice];

    invoiceReadSuccess(invoices);

    expect(invoices).toEqual([invoice]);
  });
});