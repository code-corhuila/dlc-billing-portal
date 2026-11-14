import type { PortalContext } from '../../shell-contract';

type PdfContext = Pick<PortalContext, 'http' | 'signal'>;

export class InvoicePdfHttpError extends Error {
  constructor(readonly status: number) {
    super('Invoice PDF download failed');
    this.name = 'InvoicePdfHttpError';
  }
}

export async function downloadInvoicePdfHttp(
  context: PdfContext,
  invoiceId: string,
): Promise<Blob> {
  if (context.signal.aborted) {
    throw new Error('Invoice PDF download cancelled');
  }

  if (!invoiceId.trim()) {
    throw new Error('Invalid invoice identifier');
  }

  const result = await context.http.request({
    method: 'GET',
    path: `/api/v1/invoices/${encodeURIComponent(invoiceId)}/pdf`,
    responseType: 'blob',
    signal: context.signal,
  });

  if (context.signal.aborted) {
    throw new Error('Invoice PDF download cancelled');
  }

  if (!result.ok) {
    throw new InvoicePdfHttpError(result.status);
  }

  if (!(result.data instanceof Blob)) {
    throw new Error('Invalid invoice PDF response');
  }

  if (result.data.type.toLowerCase() !== 'application/pdf') {
    throw new Error('Invalid invoice PDF content type');
  }

  if (result.data.size === 0) {
    throw new Error('Empty invoice PDF response');
  }

  return result.data;
}

