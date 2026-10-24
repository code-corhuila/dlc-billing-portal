
import { describe, expect, it, vi } from 'vitest';

import type { PortalContext } from '../../shell-contract';
import { issueInvoiceHttp } from './invoice-issuance-http';

type IssueContext = Pick<PortalContext, 'http' | 'signal'>;

const invoiceId = '123e4567-e89b-42d3-a456-426614174000';
const idempotencyKey = '987e6543-e21b-42d3-a456-426614174999';

function createContext(
  request: PortalContext['http']['request'],
  signal: AbortSignal = new AbortController().signal,
): IssueContext {
  return {
    http: { request },
    signal,
  };
}

describe('issueInvoiceHttp', () => {
  it('uses the shared HTTP client with the approved issuance contract', async () => {
    const invoice = { id: invoiceId, status: 'ISSUED', version: 2 };

    const request = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: invoice,
      headers: {},
      correlationId: 'test-correlation',
    });

    const context = createContext(request);

    await issueInvoiceHttp(context, {
      invoiceId,
      expectedVersion: 1,
      idempotencyKey,
    });

    expect(request).toHaveBeenCalledExactlyOnceWith({
      method: 'POST',
      path: `/api/v1/invoices/${invoiceId}/issuances`,
      body: { expectedVersion: 1 },
      headers: { 'Idempotency-Key': idempotencyKey },
      signal: context.signal,
    });
  });

  it('encodes the invoice identifier as one path segment', async () => {
    const request = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: {},
      headers: {},
      correlationId: 'test-correlation',
    });

    await issueInvoiceHttp(createContext(request), {
      invoiceId: 'invoice/with spaces',
      expectedVersion: 1,
      idempotencyKey,
    });

    expect(request.mock.calls[0][0].path).toBe(
      '/api/v1/invoices/invoice%2Fwith%20spaces/issuances',
    );
  });

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid expectedVersion %s before making an HTTP request',
    async expectedVersion => {
      const request = vi.fn();

      await expect(
        issueInvoiceHttp(createContext(request), {
          invoiceId,
          expectedVersion,
          idempotencyKey,
        }),
      ).rejects.toThrow();

      expect(request).not.toHaveBeenCalled();
    },
  );

  it('rejects a failed HTTP response without claiming issuance', async () => {
    const request = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      error: 'CONFLICT',
      message: 'Invoice version conflict',
      details: null,
      traceId: 'test-trace',
      correlationId: 'test-correlation',
      kind: 'http',
      retryable: false,
    });

    await expect(
      issueInvoiceHttp(createContext(request), {
        invoiceId,
        expectedVersion: 1,
        idempotencyKey,
      }),
    ).rejects.toThrow();

    expect(request).toHaveBeenCalledOnce();
  });

  it('does not send an issuance request when already cancelled', async () => {
    const controller = new AbortController();
    controller.abort();

    const request = vi.fn();

    await expect(
      issueInvoiceHttp(createContext(request, controller.signal), {
        invoiceId,
        expectedVersion: 1,
        idempotencyKey,
      }),
    ).rejects.toThrow();

    expect(request).not.toHaveBeenCalled();
  });

  it('does not accept a successful response after cancellation', async () => {
    const controller = new AbortController();

    const request = vi.fn().mockImplementation(async () => {
      controller.abort();
      return {
        ok: true,
        status: 200,
        data: { id: invoiceId, status: 'ISSUED', version: 2 },
        headers: {},
        correlationId: 'test-correlation',
      };
    });

    await expect(
      issueInvoiceHttp(createContext(request, controller.signal), {
        invoiceId,
        expectedVersion: 1,
        idempotencyKey,
      }),
    ).rejects.toThrow();
  });
});
