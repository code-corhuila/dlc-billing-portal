import type { PortalContext } from '../../../shell-contract';
import { copMoney, type CopMoney } from '../../model/cop-money';

export type ExtraChargeItemType =
  | 'ADDITIONAL_MATERIAL'
  | 'ADDITIONAL_PROCEDURE'
  | 'COMPLEXITY_ADJUSTMENT'
  | 'OTHER_AUTHORIZED_CHARGE';

export interface HttpExtraChargeRule {
  id: string;
  code: string;
  itemType: ExtraChargeItemType;
  unitPrice: CopMoney;
  requiresApproval: boolean;
  validFrom: string;
  version: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ExtraChargeRulePage {
  data: HttpExtraChargeRule[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object'
    && value !== null
    && !Array.isArray(value);
}

function requireString(
  value: unknown,
  field: string,
  maxLength: number,
): string {
  if (
    typeof value !== 'string'
    || value.trim().length === 0
    || value.length > maxLength
  ) {
    throw new Error(`Invalid extra charge rule ${field}`);
  }

  return value;
}

function requireTimestamp(value: unknown, field: string): string {
  if (
    typeof value !== 'string'
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
    || !Number.isFinite(Date.parse(value))
  ) {
    throw new Error(`Invalid extra charge rule ${field}`);
  }

  return value;
}

function requireInteger(
  value: unknown,
  field: string,
  minimum: number,
  maximum = Number.MAX_SAFE_INTEGER,
): number {
  if (
    !Number.isSafeInteger(value)
    || (value as number) < minimum
    || (value as number) > maximum
  ) {
    throw new Error(`Invalid extra charge rule ${field}`);
  }

  return value as number;
}

export function readExtraChargeRule(
  value: unknown,
): HttpExtraChargeRule {
  if (!isRecord(value)) {
    throw new Error('Invalid extra charge rule');
  }

  const itemTypes: ExtraChargeItemType[] = [
    'ADDITIONAL_MATERIAL',
    'ADDITIONAL_PROCEDURE',
    'COMPLEXITY_ADJUSTMENT',
    'OTHER_AUTHORIZED_CHARGE',
  ];

  if (!itemTypes.includes(value['itemType'] as ExtraChargeItemType)) {
    throw new Error('Invalid extra charge rule itemType');
  }

  if (typeof value['requiresApproval'] !== 'boolean') {
    throw new Error('Invalid extra charge rule requiresApproval');
  }

  const unitPrice = copMoney(value['unitPrice']);

  if (BigInt(unitPrice.replace('.', '')) <= 0n) {
    throw new Error('Invalid extra charge rule unitPrice');
  }

  const result: HttpExtraChargeRule = {
    id: requireString(value['id'], 'id', 36),
    code: requireString(value['code'], 'code', 80),
    itemType: value['itemType'] as ExtraChargeItemType,
    unitPrice,
    requiresApproval: value['requiresApproval'],
    validFrom: requireTimestamp(value['validFrom'], 'validFrom'),
    version: requireInteger(value['version'], 'version', 1),
  };

  if (value['createdAt'] !== undefined) {
    result.createdAt = requireTimestamp(value['createdAt'], 'createdAt');
  }

  if (value['updatedAt'] !== undefined) {
    result.updatedAt = requireTimestamp(value['updatedAt'], 'updatedAt');
  }

  return result;
}

export function readExtraChargeRulePage(
  value: unknown,
): ExtraChargeRulePage {
  if (
    !isRecord(value)
    || !Array.isArray(value['data'])
    || !isRecord(value['meta'])
  ) {
    throw new Error('Invalid extra charge rule page');
  }

  const meta = value['meta'];

  return {
    data: value['data'].map(readExtraChargeRule),
    meta: {
      page: requireInteger(meta['page'], 'page', 1),
      limit: requireInteger(meta['limit'], 'limit', 1, 100),
      total: requireInteger(meta['total'], 'total', 0),
      totalPages: requireInteger(meta['totalPages'], 'totalPages', 0),
    },
  };
}

export async function readExtraChargeRulesHttp(
  context: Pick<PortalContext, 'http' | 'signal'>,
): Promise<ExtraChargeRulePage> {
  if (context.signal.aborted) {
    throw new Error('Extra charge rules request cancelled');
  }

  const result = await context.http.request({
    method: 'GET',
    path: '/api/v1/additional-price-rules',
    signal: context.signal,
  });

  if (context.signal.aborted) {
    throw new Error('Extra charge rules request cancelled');
  }

  if (!result.ok) {
    throw new Error('Extra charge rules request failed');
  }

  return readExtraChargeRulePage(result.data);
}
