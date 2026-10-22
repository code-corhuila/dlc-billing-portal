
import { describe, expect, it, vi } from 'vitest';
import type { PortalContext } from '../../shell-contract';
import { readInvoicesHttp } from './invoice-http-read';

describe('invoice HTTP read', () => {
  const invoice = {
    id: '11111111-1111-4111-8111-111111111111',
    patientId: '22222222-2222-4222-8222-222222222222',
    items: [],
    total: '150000.00',
    balance: '150000.00',
    currency: 'COP',
    status: 'DRAFT',
    version: 1,
  };

  const page = {
    data: [invoice],
    meta: {
      page: 1,
      limit: 10,
      total: 1,
      totalPages: 1,
    },
  };

  function setup() {
    const request = vi.fn<PortalContext['http']['request']>();
    const controller = new AbortController();

    const context = {
      http: { request },
      signal: controller.signal,
    } as PortalContext;

    return { context, request, controller };
  }

  it('reads invoices through the shared shell HTTP client', async () => {
    const { context, request } = setup();

    request.mockResolvedValue({
      ok: true,
      status: 200,
      data: page,
      headers: {},
      correlationId: 'correlation-1',
    });

    const result = await readInvoicesHttp(context);

    expect(request).toHaveBeenCalledExactlyOnceWith({
      method: 'GET',
      path: '/api/v1/invoices',
      signal: context.signal,
    });

    expect(result.data[0]).toMatchObject({
      id: invoice.id,
      total: '150000.00',
      status: 'DRAFT',
    });
    expect(result.meta).toEqual(page.meta);
  });

  it('propagates an HTTP failure without inventing invoice data', async () => {
    const { context, request } = setup();

    request.mockResolvedValue({
      ok: false,
      status: 403,
      error: 'FORBIDDEN',
      message: 'Access denied',
      details: null,
      traceId: 'trace-1',
      correlationId: 'correlation-1',
      kind: 'http',
      retryable: false,
    });

    await expect(readInvoicesHttp(context)).rejects.toThrow(
      'Invoice request failed',
    );
  });

  it('rejects an invalid successful response', async () => {
    const { context, request } = setup();

    request.mockResolvedValue({
      ok: true,
      status: 200,
      data: { data: 'invalid', meta: {} },
      headers: {},
      correlationId: 'correlation-1',
    });

    await expect(readInvoicesHttp(context)).rejects.toThrow();
  });

  it('does not request invoices after context cancellation', async () => {
    const { context, request, controller } = setup();
    controller.abort();

    await expect(readInvoicesHttp(context)).rejects.toThrow(
      'Invoice request cancelled',
    );

    expect(request).not.toHaveBeenCalled();
  });
});
