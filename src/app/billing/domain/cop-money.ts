import { COP_MONEY_PATTERN } from '../model/invoice-contract.generated';

export type CopMoney = string & { readonly copMoney: unique symbol };
const pattern = new RegExp(COP_MONEY_PATTERN);
export function copMoney(value: string): CopMoney {
  if (!pattern.test(value)) throw new Error('Invalid COP money');
  return value as CopMoney;
}
export function formatCopMoney(value: CopMoney): string {
  const [whole, cents] = value.split('.');
  return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(BigInt(whole)) + ',' + cents;
}
