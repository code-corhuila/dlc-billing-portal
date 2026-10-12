import type { CopMoney } from './cop-money';
import type { InvoiceStatus } from './invoice-contract.generated';

export type InvoiceListStatus = InvoiceStatus;
// Presentation projection, not the owner Invoice DTO; patient labels are fictional.
export interface InvoiceListItem {
  id: string;
  number: string;
  patientName: string;
  amount: CopMoney;
  status: InvoiceListStatus;
}
