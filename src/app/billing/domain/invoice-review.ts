export type InvoiceStatus = 'DRAFT' | 'ISSUED';

export function canEditInvoice(status: InvoiceStatus): boolean {
  return status === 'DRAFT';
}

export function canIssueInvoice(status: InvoiceStatus): boolean {
  return status === 'DRAFT';
}