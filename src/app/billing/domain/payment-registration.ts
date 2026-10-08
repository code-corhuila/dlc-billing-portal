export type PaymentStatus = 'PARTIAL' | 'PAID';

export function isValidPaymentAmount(
  amount: number,
  pendingBalance: number,
): boolean {
  return (
    amount > 0 &&
    amount <= pendingBalance
  );
}

export function calculateRemainingBalance(
  pendingBalance: number,
  paymentAmount: number,
): number {
  return pendingBalance - paymentAmount;
}

export function resolvePaymentStatus(
  remainingBalance: number,
): PaymentStatus {
  return remainingBalance === 0
    ? 'PAID'
    : 'PARTIAL';
}

export function isDuplicatePayment(
  idempotencyKey: string,
  processedKeys: string[],
): boolean {
  return processedKeys.includes(idempotencyKey);
}