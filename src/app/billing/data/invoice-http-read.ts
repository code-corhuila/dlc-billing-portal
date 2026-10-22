
import type { PortalContext } from '../../shell-contract';
import {
  readInvoicePage,
  type ReadInvoicePage,
} from './invoice-read-adapter';

export async function readInvoicesHttp(
  context: Pick<PortalContext, 'http' | 'signal'>,
): Promise<ReadInvoicePage> {
  if (context.signal.aborted) {
    throw new Error('Invoice request cancelled');
  }

  const result = await context.http.request({
    method: 'GET',
    path: '/api/v1/invoices',
    signal: context.signal,
  });

  if (context.signal.aborted) {
    throw new Error('Invoice request cancelled');
  }

  if (!result.ok) {
    throw new Error('Invoice request failed');
  }

  return readInvoicePage(result.data);
}
