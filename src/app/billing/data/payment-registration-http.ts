import type { PortalContext } from '../../shell-contract';
import { copMoney, type CopMoney } from '../model/cop-money';

type PaymentContext = Pick<PortalContext, 'http' | 'signal'>;

export interface RecordPaymentRequest {
  readonly invoiceId: string;
  readonly amount: string;
  readonly method: string;
  readonly expectedVersion: number;
  readonly idempotencyKey: string;
}

export interface RecordedPayment {
  readonly id: string;
  readonly invoiceId: string;
  readonly amount: CopMoney;
  readonly method: string;
  readonly recordedBy: string;
  readonly recordedAt: string;
  readonly version: number;
  readonly createdAt?: string;
  readonly updatedAt?: string;
}

export class PaymentRegistrationHttpError extends Error {
  constructor(readonly status: number) {
    super('Payment registration failed');
    this.name = 'PaymentRegistrationHttpError';
  }
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
    && !Array.isArray(value);
}

function readUuid(value: unknown): string {
  if (typeof value !== 'string' || !uuidPattern.test(value)) {
    throw new Error('Invalid payment identifier');
  }
  return value;
}

function readTimestamp(value: unknown): string {
  if (
    typeof value !== 'string'
    || !/^\d{4}-\d{2}-\d{2}T/.test(value)
    || !Number.isFinite(Date.parse(value))
  ) {
    throw new Error('Invalid payment timestamp');
  }
  return value;
}

function readVersion(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1) {
    throw new Error('Invalid payment version');
  }
  return value as number;
}

function readPayment(data: unknown): RecordedPayment {
  if (!isRecord(data)) {
    throw new Error('Invalid payment response');
  }

  const method = data['method'];

  if (
    typeof method !== 'string'
    || method.length < 1
    || method.length > 40
  ) {
    throw new Error('Invalid payment method');
  }

  const payment: RecordedPayment = {
    id: readUuid(data['id']),
    invoiceId: readUuid(data['invoiceId']),
    amount: copMoney(data['amount']),
    method,
    recordedBy: readUuid(data['recordedBy']),
    recordedAt: readTimestamp(data['recordedAt']),
    version: readVersion(data['version']),
  };

  if (data['createdAt'] !== undefined) {
    Object.assign(payment, {
      createdAt: readTimestamp(data['createdAt']),
    });
  }

  if (data['updatedAt'] !== undefined) {
    Object.assign(payment, {
      updatedAt: readTimestamp(data['updatedAt']),
    });
  }

  return payment;
}

export async function recordPaymentHttp(
  context: PaymentContext,
  request: RecordPaymentRequest,
): Promise<RecordedPayment> {
  if (context.signal.aborted) {
    throw new Error('Payment registration cancelled');
  }

  const invoiceId = readUuid(request.invoiceId);
  const amount = copMoney(request.amount);

  if (BigInt(amount.replace('.', '')) <= 0n) {
    throw new Error('Invalid payment amount');
  }

  const method = request.method.trim();

  if (method.length < 1 || method.length > 40) {
    throw new Error('Invalid payment method');
  }

  const expectedVersion = readVersion(request.expectedVersion);
  const idempotencyKey = readUuid(request.idempotencyKey);

  const result = await context.http.request({
    method: 'POST',
    path: `/api/v1/invoices/${encodeURIComponent(invoiceId)}/payments`,
    body: {
      amount,
      method,
      expectedVersion,
    },
    headers: {
      'Idempotency-Key': idempotencyKey,
    },
    signal: context.signal,
  });

  if (context.signal.aborted) {
    throw new Error('Payment registration cancelled');
  }

  if (!result.ok) {
    throw new PaymentRegistrationHttpError(result.status);
  }

  if (result.status !== 201) {
    throw new Error('Unexpected payment registration status');
  }

  const payment = readPayment(result.data);

  if (payment.invoiceId !== invoiceId) {
    throw new Error('Payment invoice mismatch');
  }

  return payment;
}
