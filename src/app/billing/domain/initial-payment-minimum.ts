import { copMoney, type CopMoney } from '../model/cop-money';

export function minimumPayment(total: CopMoney, paid: CopMoney): CopMoney {
  if (BigInt(paid.replace('.', '')) > 0n) return copMoney('0.01');
  const minimum = (BigInt(total.replace('.', '')) + 1n) / 2n;
  return copMoney(`${minimum / 100n}.${(minimum % 100n).toString().padStart(2, '0')}`);
}

// Total and balance are authoritative Billing values; no Number conversion.
export function minimumPaymentForBalance(total: CopMoney, balance: CopMoney): CopMoney {
  return BigInt(total.replace('.', '')) > BigInt(balance.replace('.', ''))
    ? copMoney('0.01') : minimumPayment(total, copMoney('0.00'));
}
