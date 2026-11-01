import type { PortalContext } from '../../shell-contract';
import { copMoney, type CopMoney } from '../model/cop-money';

type PaymentContext = Pick<PortalContext, 'http' | 'signal'>;

export interface InvoicePayment {
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

export interface PaymentPageMeta {
  readonly page: number;
  readonly limit: number;
  readonly total: number;
  readonly totalPages: number;
}

export interface PaymentHistoryPage {
  readonly data: InvoicePayment[];
  readonly meta: PaymentPageMeta;
}

export class PaymentHistoryHttpError extends Error {
  constructor(readonly status: number) {
    super('Payment history request failed');
    this.name = 'PaymentHistoryHttpError';
  }
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

function readInteger(value: unknown, minimum: number): number {
  if (
    typeof value !== 'number'
    || !Number.isSafeInteger(value)
    || value < minimum
  ) {
    throw new Error('Invalid payment pagination or version');
  }
  return value;
}

function readObject(value: unknown): Record<string, unknown> {
  if (
    typeof value !== 'object'
    || value === null
    || Array.isArray(value)
  ) {
    throw new Error('Invalid payment response');
  }
  return value as Record<string, unknown>;
}

function readPayment(value: unknown, invoiceId: string): InvoicePayment {
  const data = readObject(value);

  if (readUuid(data['invoiceId']) !== invoiceId) {
    throw new Error('Payment invoice mismatch');
  }

  const method = data['method'];

  if (
    typeof method !== 'string'
    || method.length < 1
    || method.length > 40
  ) {
    throw new Error('Invalid payment method');
  }

  const payment: InvoicePayment = {
    id: readUuid(data['id']),
    invoiceId,
    amount: copMoney(data['amount']),
    method,
    recordedBy: readUuid(data['recordedBy']),
    recordedAt: readTimestamp(data['recordedAt']),
    version: readInteger(data['version'], 1),
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

function readMeta(value: unknown): PaymentPageMeta {
  const data = readObject(value);

  const page = readInteger(data['page'], 1);
  const limit = readInteger(data['limit'], 1);
  const total = readInteger(data['total'], 0);
  const totalPages = readInteger(data['totalPages'], 0);

  if (limit > 100) {
    throw new Error('Invalid payment page limit');
  }

  return { page, limit, total, totalPages };
}

export async function readPaymentHistoryHttp(
  context: PaymentContext,
  invoiceId: string,
  page = 1,
  limit = 20,
): Promise<PaymentHistoryPage> {
  if (context.signal.aborted) {
    throw new Error('Payment history request cancelled');
  }

  const id = readUuid(invoiceId);
  readInteger(page, 1);
  readInteger(limit, 1);

  if (limit > 100) {
    throw new Error('Invalid payment page limit');
  }

  const result = await context.http.request({
    method: 'GET',
    path: `/api/v1/invoices/${encodeURIComponent(id)}/payments?page=${page}&limit=${limit}`,
    signal: context.signal,
  });

  if (context.signal.aborted) {
    throw new Error('Payment history request cancelled');
  }

  if (!result.ok || result.status !== 200) {
    throw new PaymentHistoryHttpError(result.status);
  }

  const response = readObject(result.data);

  if (!Array.isArray(response['data'])) {
    throw new Error('Invalid payment history');
  }

  const meta = readMeta(response['meta']);

  return {
    data: response['data'].map(value => readPayment(value, id)),
    meta,
  };
}
