import { InjectionToken } from '@angular/core';
import type { InvoiceListItem } from '../model/invoice-list-item';
import type { InvoiceDetail } from '../model/invoice-detail';

export interface InvoiceListSource {
  read(): InvoiceListItem[];
  detail(id: string): InvoiceDetail | undefined;
}
export const INVOICE_LIST_SOURCE = new InjectionToken<InvoiceListSource>('billing.invoice-list-source');
