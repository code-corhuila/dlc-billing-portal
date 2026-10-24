
import type { ReadInvoice } from './invoice-read-adapter';
import type { InvoiceReadStatus } from './invoice-read-state';

export interface InvoiceDetailReadState {
  status: InvoiceReadStatus;
  invoice: ReadInvoice | undefined;
}

export function createInvoiceDetailReadState(): InvoiceDetailReadState {
  return {
    status: 'idle',
    invoice: undefined,
  };
}

export function invoiceDetailReadLoading(
  _previous: InvoiceDetailReadState,
): InvoiceDetailReadState {
  return {
    status: 'loading',
    invoice: undefined,
  };
}

export function invoiceDetailReadSuccess(
  invoice: ReadInvoice,
): InvoiceDetailReadState {
  return {
    status: 'success',
    invoice,
  };
}

export function invoiceDetailReadError(
  _previous: InvoiceDetailReadState,
): InvoiceDetailReadState {
  return {
    status: 'error',
    invoice: undefined,
  };
}

export function invoiceDetailReadCancelled(
  _previous: InvoiceDetailReadState,
): InvoiceDetailReadState {
  return {
    status: 'cancelled',
    invoice: undefined,
  };
}
