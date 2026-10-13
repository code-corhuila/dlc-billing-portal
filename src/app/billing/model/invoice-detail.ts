import type { InvoiceListItem } from './invoice-list-item';
import type { CopMoney } from './cop-money';

// Read-only demo projection, not an owner Invoice DTO or clinical history.
export interface InvoiceDetail extends InvoiceListItem {
  paidTotal: CopMoney;
  balance: CopMoney;
  charges: { description: string; amount: CopMoney }[];
}
