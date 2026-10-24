
import { describe, expect, it, vi } from 'vitest';

import type { PortalContext } from '../../shell-contract';
import { issueInvoiceHttp } from './invoice-issuance-http';

type IssueContext = Pick<PortalContext, 'http' | 'signal'>;

const invoiceId = '123e4567-e89b-42d3-a456-426614174000';
const idempotencyKey = '987e6543-e21b-42d3-a456-426614174999';

function createInvoice(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: invoiceId,
    patientId: '123e4567-e89b-42d3-a456-426614174001',
    items: [],
    total: '130000.00',
    balance: '130000.00',
    currency: 'COP',
    status: 'ISSUED',
    version: 2,
    ...overrides,
  };
}

function successfulResponse(data: unknown) {
  return {
    ok: true as const,
    status: 200,
    data,
    headers: {},
    correlationId: 'test-correlation',
  };
}

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
    const request = vi.fn().mockResolvedValue(
      successfulResponse(createInvoice()),
    );
    const context = createContext(request);

    const result = await issueInvoiceHttp(context, {
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

    expect(result.status).toBe('ISSUED');
    expect(result.version).toBe(2);
    expect(result.total).toBe('130000.00');
  });

  it('encodes the invoice identifier as one path segment', async () => {
    const request = vi.fn().mockResolvedValue(
      successfulResponse(createInvoice()),
    );

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

  it('rejects an invalid idempotency key before sending a request', async () => {
    const request = vi.fn();

    await expect(
      issueInvoiceHttp(createContext(request), {
        invoiceId,
        expectedVersion: 1,
        idempotencyKey: 'not-a-uuid',
      }),
    ).rejects.toThrow();

    expect(request).not.toHaveBeenCalled();
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
      return successfulResponse(createInvoice());
    });

    await expect(
      issueInvoiceHttp(createContext(request, controller.signal), {
        invoiceId,
        expectedVersion: 1,
        idempotencyKey,
      }),
    ).rejects.toThrow();
  });

  it('rejects a response that does not contain a valid invoice', async () => {
    const request = vi.fn().mockResolvedValue(
      successfulResponse({ status: 'ISSUED' }),
    );

    await expect(
      issueInvoiceHttp(createContext(request), {
        invoiceId,
        expectedVersion: 1,
        idempotencyKey,
      }),
    ).rejects.toThrow();
  });

  it('does not accept a DRAFT invoice as successful issuance', async () => {
    const request = vi.fn().mockResolvedValue(
      successfulResponse(createInvoice({ status: 'DRAFT' })),
    );

    await expect(
      issueInvoiceHttp(createContext(request), {
        invoiceId,
        expectedVersion: 1,
        idempotencyKey,
      }),
    ).rejects.toThrow('Invoice was not issued');
  });
});
