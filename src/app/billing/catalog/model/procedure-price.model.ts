import type { CopMoney } from '../../model/cop-money';

export type ProcedurePriceStatus = 'CURRENT' | 'SCHEDULED' | 'HISTORICAL';

export interface ProcedurePrice {
  id: string;
  procedureCode: string;
  procedureName: string;
  amount: CopMoney;
  currency: 'COP';
  validFrom: string;
  // Null while open-ended; a later version closes it the day before it starts.
  validTo: string | null;
  version: number;
}

export interface CreateProcedurePriceRequest {
  procedureCode: string;
  procedureName: string;
  amount: string;
  validFrom: string;
}
