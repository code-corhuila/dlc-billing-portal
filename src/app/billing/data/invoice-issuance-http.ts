import type { PortalContext } from '../../shell-contract';
import {
  readInvoiceDetail,
  type ReadInvoice,
} from './invoice-read-adapter';

type IssueContext = Pick<PortalContext, 'http' | 'signal'>;

export interface IssueInvoiceRequest {
  readonly invoiceId: string;
  readonly expectedVersion: number;
  readonly idempotencyKey: string;
}

export async function issueInvoiceHttp(
  context: IssueContext,
  request: IssueInvoiceRequest,
): Promise<ReadInvoice> {
  if (context.signal.aborted) {
    throw new Error('Invoice issuance cancelled');
  }

  if (
    !Number.isSafeInteger(request.expectedVersion) ||
    request.expectedVersion < 1
  ) {
    throw new Error('Invalid expected invoice version');
  }

  if (!request.invoiceId.trim()) {
    throw new Error('Invalid invoice identifier');
  }

  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (!uuidPattern.test(request.idempotencyKey)) {
    throw new Error('Invalid idempotency key');
  }

  const result = await context.http.request({
    method: 'POST',
    path: `/api/v1/invoices/${encodeURIComponent(request.invoiceId)}/issuances`,
    body: { expectedVersion: request.expectedVersion },
    headers: { 'Idempotency-Key': request.idempotencyKey },
    signal: context.signal,
  });

  if (context.signal.aborted) {
    throw new Error('Invoice issuance cancelled');
  }

  if (!result.ok) {
    throw new Error('Invoice issuance failed');
  }

  const invoice = readInvoiceDetail(result.data);

  if (invoice.status !== 'ISSUED') {
    throw new Error('Invoice was not issued');
  }

  return invoice;
}
