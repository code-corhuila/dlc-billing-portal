import { InjectionToken, Provider } from '@angular/core';
import { dummyInvoiceList } from './invoice-list.dummy';
import type { InvoiceListItem } from './invoice-list.dummy';

export interface InvoiceListSource { read(): InvoiceListItem[]; }
export const INVOICE_LIST_SOURCE = new InjectionToken<InvoiceListSource>('billing.invoice-list-source');
export function provideInvoiceListSource(source: InvoiceListSource = dummyInvoiceList): Provider {
  return { provide: INVOICE_LIST_SOURCE, useValue: source };
}
