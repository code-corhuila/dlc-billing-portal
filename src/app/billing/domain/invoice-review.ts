export type InvoiceStatus = 'DRAFT' | 'ISSUED';

export function canEditInvoice(status: InvoiceStatus): boolean {
  return status === 'DRAFT';
}

export function canIssueInvoice(
  status: InvoiceStatus,
  chargeAmounts: number[],
): boolean {
  return status === 'DRAFT' && chargeAmounts.length > 0;
}

export function issueInvoice(
  status: InvoiceStatus,
  chargeAmounts: number[],
): InvoiceStatus {
  return canIssueInvoice(status, chargeAmounts)
    ? 'ISSUED'
    : status;
}

export function calculateInvoiceTotal(chargeAmounts: number[]): number {
  return chargeAmounts.reduce(
    (total, amount) => total + amount,
    0,
  );
}

export function canDownloadInvoicePdf(status: InvoiceStatus): boolean {
  return status === 'ISSUED';
}