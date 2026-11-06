import type { Provider } from '@angular/core';
import { dummyInvoiceList } from './invoice-list.dummy';
import { INVOICE_LIST_SOURCE, type InvoiceListSource } from './invoice-list-port';
export { INVOICE_LIST_SOURCE, type InvoiceListSource } from './invoice-list-port';

export function provideInvoiceListSource(source: InvoiceListSource = dummyInvoiceList): Provider {
  return { provide: INVOICE_LIST_SOURCE, useValue: source };
}
