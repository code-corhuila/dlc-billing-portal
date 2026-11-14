import type { PortalContext } from '../../../shell-contract';
import { copMoney, type CopMoney } from '../../model/cop-money';

export interface HttpProcedurePrice {
  id: string;
  procedureCode: string;
  name: string;
  basePrice: CopMoney;
  currency: 'COP';
  validFrom?: string;
  validTo?: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  version: number;
}

export interface ProcedurePricePage {
  data: HttpProcedurePrice[];
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
    throw new Error(`Invalid procedure price ${field}`);
  }

  return value;
}

function requireTimestamp(value: unknown, field: string): string {
  if (
    typeof value !== 'string'
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
    || !Number.isFinite(Date.parse(value))
  ) {
    throw new Error(`Invalid procedure price ${field}`);
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
    throw new Error(`Invalid procedure price ${field}`);
  }

  return value as number;
}

export function readProcedurePrice(value: unknown): HttpProcedurePrice {
  if (!isRecord(value)) {
    throw new Error('Invalid procedure price');
  }

  if (value['currency'] !== 'COP') {
    throw new Error('Invalid procedure price currency');
  }

  if (value['status'] !== 'ACTIVE' && value['status'] !== 'INACTIVE') {
    throw new Error('Invalid procedure price status');
  }

  const basePrice = copMoney(value['basePrice']);

  if (BigInt(basePrice.replace('.', '')) <= 0n) {
    throw new Error('Invalid procedure price amount');
  }

  const price: HttpProcedurePrice = {
    id: requireString(value['id'], 'id', 36),
    procedureCode: requireString(value['procedureCode'], 'procedureCode', 80),
    name: requireString(value['name'], 'name', 255),
    basePrice,
    currency: 'COP',
    status: value['status'],
    version: requireInteger(value['version'], 'version', 1),
  };

  if (value['validFrom'] !== undefined) {
    price.validFrom = requireTimestamp(value['validFrom'], 'validFrom');
  }

  if (value['validTo'] !== undefined) {
    price.validTo = value['validTo'] === null
      ? null
      : requireTimestamp(value['validTo'], 'validTo');
  }

  return price;
}

export function readProcedurePricePage(
  value: unknown,
): ProcedurePricePage {
  if (
    !isRecord(value)
    || !Array.isArray(value['data'])
    || !isRecord(value['meta'])
  ) {
    throw new Error('Invalid procedure price page');
  }

  const meta = value['meta'];

  return {
    data: value['data'].map(readProcedurePrice),
    meta: {
      page: requireInteger(meta['page'], 'page', 1),
      limit: requireInteger(meta['limit'], 'limit', 1, 100),
      total: requireInteger(meta['total'], 'total', 0),
      totalPages: requireInteger(meta['totalPages'], 'totalPages', 0),
    },
  };
}

export async function readProcedurePricesHttp(
  context: Pick<PortalContext, 'http' | 'signal'>,
): Promise<ProcedurePricePage> {
  if (context.signal.aborted) {
    throw new Error('Procedure price request cancelled');
  }

  const result = await context.http.request({
    method: 'GET',
    path: '/api/v1/procedure-prices',
    signal: context.signal,
  });

  if (context.signal.aborted) {
    throw new Error('Procedure price request cancelled');
  }

  if (!result.ok) {
    throw new Error('Procedure price request failed');
  }

  return readProcedurePricePage(result.data);
}
