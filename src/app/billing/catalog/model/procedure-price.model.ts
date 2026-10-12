import type { CopMoney } from '../../model/cop-money';

export interface ProcedurePrice {
  id: string;
  procedureCode: string;
  procedureName: string;
  amount: CopMoney;
  currency: 'COP';
  validFrom: string;
  version: number;
  active: boolean;
}

export interface CreateProcedurePriceRequest {
  procedureCode: string;
  procedureName: string;
  amount: string;
  validFrom: string;
}
