
import type { PortalContext } from '../../shell-contract';
import { downloadInvoicePdfHttp } from './invoice-pdf-http';

type PdfContext = Pick<PortalContext, 'http' | 'signal'>;

const invoiceId = '123e4567-e89b-42d3-a456-426614174000';

function createContext(
  request: PortalContext['http']['request'],
  signal: AbortSignal = new AbortController().signal,
): PdfContext {
  return {
    http: { request },
    signal,
  };
}

function successfulResponse(data: unknown) {
  return {
    ok: true as const,
    status: 200,
    data,
    headers: { 'content-type': 'application/pdf' },
    correlationId: 'test-correlation',
  };
}

function validPdf(): Blob {
  return new Blob(
    ['%PDF-1.7\nInvoice content'],
    { type: 'application/pdf' },
  );
}

describe('downloadInvoicePdfHttp', () => {
  it('uses the shared HTTP client with the documented PDF contract', async () => {
    const pdf = validPdf();
    const request = vi.fn().mockResolvedValue(successfulResponse(pdf));
    const context = createContext(request);

    const result = await downloadInvoicePdfHttp(context, invoiceId);

    expect(request).toHaveBeenCalledExactlyOnceWith({
      method: 'GET',
      path: `/api/v1/invoices/${invoiceId}/pdf`,
      responseType: 'blob',
      signal: context.signal,
    });

    expect(result).toBe(pdf);
  });

  it('encodes the invoice identifier as one path segment', async () => {
    const request = vi.fn().mockResolvedValue(
      successfulResponse(validPdf()),
    );

    await downloadInvoicePdfHttp(
      createContext(request),
      'invoice/with spaces',
    );

    expect(request.mock.calls[0][0].path).toBe(
      '/api/v1/invoices/invoice%2Fwith%20spaces/pdf',
    );
  });

  it('rejects an empty invoice identifier before requesting the PDF', async () => {
    const request = vi.fn();

    await expect(
      downloadInvoicePdfHttp(createContext(request), '   '),
    ).rejects.toThrow();

    expect(request).not.toHaveBeenCalled();
  });

  it.each([401, 403, 404, 500])(
    'rejects HTTP %s without returning a PDF',
    async status => {
      const request = vi.fn().mockResolvedValue({
        ok: false,
        status,
        error: 'HTTP_ERROR',
        message: 'PDF request failed',
        details: null,
        traceId: 'test-trace',
        correlationId: 'test-correlation',
        kind: 'http',
        retryable: false,
      });

      await expect(
        downloadInvoicePdfHttp(createContext(request), invoiceId),
      ).rejects.toThrow();

      expect(request).toHaveBeenCalledOnce();
    },
  );

  it('rejects a successful response containing JSON instead of a Blob', async () => {
    const request = vi.fn().mockResolvedValue(
      successfulResponse({ message: 'Not a PDF' }),
    );

    await expect(
      downloadInvoicePdfHttp(createContext(request), invoiceId),
    ).rejects.toThrow();
  });

  it('rejects a Blob with an incorrect content type', async () => {
    const request = vi.fn().mockResolvedValue(
      successfulResponse(
        new Blob(['Not a PDF'], { type: 'text/plain' }),
      ),
    );

    await expect(
      downloadInvoicePdfHttp(createContext(request), invoiceId),
    ).rejects.toThrow();
  });

  it('rejects an empty PDF', async () => {
    const request = vi.fn().mockResolvedValue(
      successfulResponse(
        new Blob([], { type: 'application/pdf' }),
      ),
    );

    await expect(
      downloadInvoicePdfHttp(createContext(request), invoiceId),
    ).rejects.toThrow();
  });

  it('does not request a PDF when already cancelled', async () => {
    const controller = new AbortController();
    controller.abort();

    const request = vi.fn();

    await expect(
      downloadInvoicePdfHttp(
        createContext(request, controller.signal),
        invoiceId,
      ),
    ).rejects.toThrow();

    expect(request).not.toHaveBeenCalled();
  });

  it('rejects a PDF response received after cancellation', async () => {
    const controller = new AbortController();

    const request = vi.fn().mockImplementation(async () => {
      controller.abort();
      return successfulResponse(validPdf());
    });

    await expect(
      downloadInvoicePdfHttp(
        createContext(request, controller.signal),
        invoiceId,
      ),
    ).rejects.toThrow();

    expect(request).toHaveBeenCalledOnce();
  });
});
