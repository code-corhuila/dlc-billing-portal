import { copMoney, type CopMoney } from '../model/cop-money';

export function minimumPayment(total: CopMoney, paid: CopMoney): CopMoney {
  if (BigInt(paid.replace('.', '')) > 0n) return copMoney('0.01');
  const minimum = (BigInt(total.replace('.', '')) + 1n) / 2n;
  return copMoney(`${minimum / 100n}.${(minimum % 100n).toString().padStart(2, '0')}`);
}
