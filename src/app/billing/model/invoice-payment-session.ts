import type { InvoiceDetail } from './invoice-detail';
import type { InvoiceListItem } from './invoice-list-item';
import type { CopMoney } from './cop-money';

export interface DemoPayment { readonly amount: CopMoney; readonly method: string; readonly key: string; }
// Synchronous demo coordination; not an asynchronous owner API adapter or Payment DTO.
export interface InvoicePaymentSession {
  read(): InvoiceListItem[];
  detail(id: string): InvoiceDetail | undefined;
  history(id: string): DemoPayment[];
  register(id: string, amount: string, method: string, key: string): void;
}
