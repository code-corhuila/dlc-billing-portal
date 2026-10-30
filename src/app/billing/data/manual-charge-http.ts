import type { PortalContext } from '../../shell-contract';
import { copMoney, type CopMoney } from '../model/cop-money';

type ManualChargeContext = Pick<PortalContext, 'http' | 'signal'>;

export type ManualChargeItemType =
  | 'BASE_PROCEDURE'
  | 'ADDITIONAL_MATERIAL'
  | 'ADDITIONAL_PROCEDURE'
  | 'COMPLEXITY_ADJUSTMENT'
  | 'OTHER_AUTHORIZED_CHARGE';

export type ManualChargeStatus = 'PENDING_CLINICAL' | 'READY';

export interface RecordManualChargeRequest {
  readonly patientId: string;
  readonly appointmentId: string;
  readonly procedureId: string;
  readonly sourceRecordId: string;
  readonly itemType: ManualChargeItemType;
  readonly quantity: string;
  readonly unitPrice: string;
  readonly currency: 'COP';
  readonly justification: string;
  readonly concept: string;
  readonly idempotencyKey: string;
}

export interface RecordedManualCharge {
  readonly id: string;
  readonly patientId: string;
  readonly appointmentId: string;
  readonly procedureId: string;
  readonly sourceRecordId: string;
  readonly itemType: ManualChargeItemType;
  readonly quantity: string;
  readonly unitPrice: CopMoney;
  readonly currency: 'COP';
  readonly justification: string;
  readonly concept: string;
  readonly recordedBy: string;
  readonly recordedAt: string;
  readonly status: ManualChargeStatus;
  readonly version: number;
}

export class ManualChargeHttpError extends Error {
  constructor(readonly status: number) {
    super('Manual charge registration failed');
    this.name = 'ManualChargeHttpError';
  }
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const quantityPattern =
  /^(?!0(?:\.0{1,4})?$)(?:0|[1-9][0-9]*)(?:\.[0-9]{1,4})?$/;

const itemTypes: readonly string[] = [
  'BASE_PROCEDURE',
  'ADDITIONAL_MATERIAL',
  'ADDITIONAL_PROCEDURE',
  'COMPLEXITY_ADJUSTMENT',
  'OTHER_AUTHORIZED_CHARGE',
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object'
    && value !== null
    && !Array.isArray(value);
}

function readUuid(value: unknown): string {
  if (typeof value !== 'string' || !uuidPattern.test(value)) {
    throw new Error('Invalid manual charge identifier');
  }
  return value;
}

function readText(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') {
    throw new Error('Invalid manual charge text');
  }

  const text = value.trim();

  if (text.length === 0 || text.length > maxLength) {
    throw new Error('Invalid manual charge text');
  }

  return text;
}

function readItemType(value: unknown): ManualChargeItemType {
  if (typeof value !== 'string' || !itemTypes.includes(value)) {
    throw new Error('Invalid manual charge item type');
  }

  return value as ManualChargeItemType;
}

function readQuantity(value: unknown): string {
  if (typeof value !== 'string' || !quantityPattern.test(value)) {
    throw new Error('Invalid manual charge quantity');
  }

  return value;
}

function readUnitPrice(value: unknown): CopMoney {
  const amount = copMoney(value);

  if (BigInt(amount.replace('.', '')) <= 0n) {
    throw new Error('Invalid manual charge unit price');
  }

  return amount;
}

function readCurrency(value: unknown): 'COP' {
  if (value !== 'COP') {
    throw new Error('Invalid manual charge currency');
  }
  return 'COP';
}

function readTimestamp(value: unknown): string {
  if (
    typeof value !== 'string'
    || !/^\d{4}-\d{2}-\d{2}T/.test(value)
    || !Number.isFinite(Date.parse(value))
  ) {
    throw new Error('Invalid manual charge timestamp');
  }

  return value;
}

function readVersion(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1) {
    throw new Error('Invalid manual charge version');
  }

  return value as number;
}

function readManualCharge(data: unknown): RecordedManualCharge {
  if (!isRecord(data)) {
    throw new Error('Invalid manual charge response');
  }

  const status = data['status'];

  if (status !== 'PENDING_CLINICAL' && status !== 'READY') {
    throw new Error('Invalid manual charge status');
  }

  return {
    id: readUuid(data['id']),
    patientId: readUuid(data['patientId']),
    appointmentId: readUuid(data['appointmentId']),
    procedureId: readUuid(data['procedureId']),
    sourceRecordId: readUuid(data['sourceRecordId']),
    itemType: readItemType(data['itemType']),
    quantity: readQuantity(data['quantity']),
    unitPrice: readUnitPrice(data['unitPrice']),
    currency: readCurrency(data['currency']),
    justification: readText(data['justification'], 1000),
    concept: readText(data['concept'], 500),
    recordedBy: readUuid(data['recordedBy']),
    recordedAt: readTimestamp(data['recordedAt']),
    status,
    version: readVersion(data['version']),
  };
}

export async function recordManualChargeHttp(
  context: ManualChargeContext,
  request: RecordManualChargeRequest,
): Promise<RecordedManualCharge> {
  if (context.signal.aborted) {
    throw new Error('Manual charge registration cancelled');
  }

  const body = {
    patientId: readUuid(request.patientId),
    appointmentId: readUuid(request.appointmentId),
    procedureId: readUuid(request.procedureId),
    sourceRecordId: readUuid(request.sourceRecordId),
    itemType: readItemType(request.itemType),
    quantity: readQuantity(request.quantity),
    unitPrice: readUnitPrice(request.unitPrice),
    currency: readCurrency(request.currency),
    justification: readText(request.justification, 1000),
    concept: readText(request.concept, 500),
  };

  const idempotencyKey = readUuid(request.idempotencyKey);

  const result = await context.http.request({
    method: 'POST',
    path: '/api/v1/manual-charges',
    body,
    headers: {
      'Idempotency-Key': idempotencyKey,
    },
    signal: context.signal,
  });

  if (context.signal.aborted) {
    throw new Error('Manual charge registration cancelled');
  }

  if (!result.ok) {
    throw new ManualChargeHttpError(result.status);
  }

  if (result.status !== 201) {
    throw new Error('Unexpected manual charge registration status');
  }

  const recorded = readManualCharge(result.data);

  if (
    recorded.patientId !== body.patientId
    || recorded.appointmentId !== body.appointmentId
    || recorded.procedureId !== body.procedureId
    || recorded.sourceRecordId !== body.sourceRecordId
  ) {
    throw new Error('Manual charge source mismatch');
  }

  return recorded;
}
