export type ExtraChargeRuleType =
  | 'MATERIAL'
  | 'COMPLEXITY'
  | 'ADDITIONAL_PROCEDURE'
  | 'OTHER';

export interface ExtraChargeRule {
  id: string;
  code: string;
  name: string;
  description: string;
  type: ExtraChargeRuleType;
  amount: number;
  currency: 'COP';
  validFrom: string;
  version: number;
  active: boolean;
}

export interface CreateExtraChargeRuleRequest {
  code: string;
  name: string;
  description: string;
  type: ExtraChargeRuleType;
  amount: number;
  validFrom: string;
}