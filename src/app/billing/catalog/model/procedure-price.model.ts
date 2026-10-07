export interface ProcedurePrice {
  id: string;
  procedureCode: string;
  procedureName: string;
  amount: number;
  currency: 'COP';
  validFrom: string;
  version: number;
  active: boolean;
}

export interface CreateProcedurePriceRequest {
  procedureCode: string;
  procedureName: string;
  amount: number;
  validFrom: string;
}