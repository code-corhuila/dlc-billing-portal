export type InvoiceStatus = 'DRAFT' | 'ISSUED';

export function canEditInvoice(status: InvoiceStatus): boolean {
  return status === 'DRAFT';
}

export function canIssueInvoice(
  status: InvoiceStatus,
  chargeAmounts: number[],
  hasPendingApproval = false,
): boolean {
  return (
    status === 'DRAFT' &&
    chargeAmounts.length > 0 &&
    !hasPendingApproval
  );
}

export function issueInvoice(
  status: InvoiceStatus,
  chargeAmounts: number[],
  hasPendingApproval = false,
): InvoiceStatus {
  return canIssueInvoice(
    status,
    chargeAmounts,
    hasPendingApproval,
  )
    ? 'ISSUED'
    : status;
}

export function calculateInvoiceTotal(
  chargeAmounts: number[],
): number {
  return chargeAmounts.reduce(
    (total, amount) => total + amount,
    0,
  );
}

export function canDownloadInvoicePdf(
  status: InvoiceStatus,
): boolean {
  return status === 'ISSUED';
}