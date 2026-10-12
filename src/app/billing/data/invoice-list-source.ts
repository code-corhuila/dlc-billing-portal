import { InjectionToken, Provider } from '@angular/core';
import { dummyInvoiceList } from './invoice-list.dummy';
import type { InvoiceListItem } from '../model/invoice-list-item';
import type { InvoiceDetail } from '../model/invoice-detail';

export interface InvoiceListSource {
  read(): InvoiceListItem[];
  detail(id: string): InvoiceDetail | undefined;
}
export const INVOICE_LIST_SOURCE = new InjectionToken<InvoiceListSource>('billing.invoice-list-source');
export function provideInvoiceListSource(source: InvoiceListSource = dummyInvoiceList): Provider {
  return { provide: INVOICE_LIST_SOURCE, useValue: source };
}
