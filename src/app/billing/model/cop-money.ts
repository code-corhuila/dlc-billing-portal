import { COP_MONEY_PATTERN } from './generated/invoice-contract.generated';

// Contract representation only; financial business rules remain owner-controlled.
export type CopMoney = string & { readonly copMoney: unique symbol };
const pattern = new RegExp(COP_MONEY_PATTERN);
export function copMoney(value: unknown): CopMoney {
  if (typeof value !== 'string' || pattern.exec(value)?.[0] !== value) throw new Error('Invalid COP money');
  return value as CopMoney;
}
