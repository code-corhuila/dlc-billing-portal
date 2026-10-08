export type InvoiceStatus = 'DRAFT' | 'ISSUED';

export function canEditInvoice(status: InvoiceStatus): boolean {
  return status === 'DRAFT';
}

export function canIssueInvoice(status: InvoiceStatus): boolean {
  return status === 'DRAFT';
}

export function issueInvoice(status: InvoiceStatus): InvoiceStatus {
  return status === 'DRAFT' ? 'ISSUED' : status;
}

export function calculateInvoiceTotal(chargeAmounts: number[]): number {
  return chargeAmounts.reduce(
    (total, amount) => total + amount,
    0,
  );
}