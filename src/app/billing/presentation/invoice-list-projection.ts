
import type { ReadInvoice } from '../data/invoice-read-adapter';
import type { InvoiceListItem } from '../model/invoice-list-item';

export function projectInvoiceList(
  invoices: readonly ReadInvoice[],
): InvoiceListItem[] {
  return invoices.map((invoice): InvoiceListItem => ({
    id: invoice.id,
    number: invoice.invoiceNumber ?? 'Borrador sin número',
    patientName: invoice.patientId,
    amount: invoice.total,
    status: invoice.status,
  }));
}
