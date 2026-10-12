import { signal } from '@angular/core';
import { copMoney } from '../model/cop-money';
import type { InvoicePaymentSession, DemoPayment } from '../model/invoice-payment-session';
import type { InvoiceListSource } from './invoice-list-source';
import type { InvoiceDetail } from '../model/invoice-detail';

const cents = (amount: string) => BigInt(copMoney(amount).replace('.', ''));
const money = (value: bigint) => copMoney(`${value / 100n}.${(value % 100n).toString().padStart(2, '0')}`);

// Owned by one demo mount. No persistence, concurrency authority or published events.
export class DemoInvoicePayments implements InvoicePaymentSession {
  private readonly payments = signal<(DemoPayment & { invoiceId: string })[]>([]);
  constructor(private readonly source: InvoiceListSource) {}
  read() {
    return this.source.read().map(row => ({ ...row, status: this.detail(row.id)?.status ?? row.status }));
  }
  detail(id: string): InvoiceDetail | undefined {
    const invoice = this.source.detail(id);
    if (!invoice) return undefined;
    const paid = this.history(id).reduce((sum, payment) => sum + cents(payment.amount), cents(invoice.paidTotal));
    const balance = cents(invoice.amount) - paid;
    const status = this.history(id).length ? (balance === 0n ? 'PAID' : 'PARTIALLY_PAID') : invoice.status;
    return { ...invoice, paidTotal: money(paid), balance: money(balance), status };
  }
  history(id: string): DemoPayment[] {
    return this.payments().filter(payment => payment.invoiceId === id).map(payment => ({ ...payment }));
  }
  register(id: string, rawAmount: string, rawMethod: string, key: string): void {
    const amount = copMoney(rawAmount), method = rawMethod.trim();
    const previous = this.history(id).find(payment => payment.key === key);
    if (previous) {
      if (previous.amount !== amount || previous.method !== method) throw new Error('Demo intent conflict');
      return;
    }
    const invoice = this.detail(id);
    if (!invoice || !['ISSUED', 'PARTIALLY_PAID'].includes(invoice.status)) throw new Error('Demo invoice not payable');
    if (!key || !method || method.length > 40 || cents(amount) <= 0n || cents(amount) > cents(invoice.balance)) {
      throw new Error('Invalid demo payment');
    }
    this.payments.update(payments => [...payments, { invoiceId: id, amount, method, key }]);
  }
}
