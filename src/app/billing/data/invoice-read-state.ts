import type { InvoiceListItem } from '../model/invoice-list-item';

export type InvoiceReadStatus =
  | 'idle'
  | 'loading'
  | 'success'
  | 'error'
  | 'cancelled';

export interface InvoiceReadState {
  status: InvoiceReadStatus;
  invoices: InvoiceListItem[];
}

export function createInvoiceReadState(): InvoiceReadState {
  return {
    status: 'idle',
    invoices: [],
  };
}

export function invoiceReadLoading(
  _previous: InvoiceReadState,
): InvoiceReadState {
  return {
    status: 'loading',
    invoices: [],
  };
}

export function invoiceReadSuccess(
  invoices: readonly InvoiceListItem[],
): InvoiceReadState {
  return {
    status: 'success',
    invoices: [...invoices],
  };
}

export function invoiceReadError(
  _previous: InvoiceReadState,
): InvoiceReadState {
  return {
    status: 'error',
    invoices: [],
  };
}

export function invoiceReadCancelled(
  _previous: InvoiceReadState,
): InvoiceReadState {
  return {
    status: 'cancelled',
    invoices: [],
  };
}