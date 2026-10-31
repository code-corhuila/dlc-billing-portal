import '@angular/compiler';
import { expect, it, vi } from 'vitest';
import type { PortalContext } from '../../../shell-contract';
import {
  readProcedurePricesHttp,
} from './procedure-prices-http';

const validPrice = {
  id: '11111111-1111-4111-8111-111111111111',
  procedureCode: 'PROC-001',
  name: 'Limpieza dental',
  basePrice: '150000.00',
  currency: 'COP',
  validFrom: '2026-10-01T00:00:00Z',
  validTo: '2026-12-31T23:59:59Z',
  status: 'ACTIVE',
  version: 1,
};

const validPage = {
  data: [validPrice],
  meta: {
    page: 1,
    limit: 20,
    total: 1,
    totalPages: 1,
  },
};

function setup() {
  const controller = new AbortController();
  const request = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    data: validPage,
  });

  const context = {
    http: { request },
    signal: controller.signal,
  } as unknown as Pick<PortalContext, 'http' | 'signal'>;

  return { context, controller, request };
}

it('requests procedure prices using the compositor HTTP client', async () => {
  const { context, request } = setup();

  await readProcedurePricesHttp(context);

  expect(request).toHaveBeenCalledExactlyOnceWith({
    method: 'GET',
    path: '/api/v1/procedure-prices',
    signal: context.signal,
  });
});

it('returns validated prices and pagination metadata', async () => {
  const { context } = setup();

  const result = await readProcedurePricesHttp(context);

  expect(result).toEqual(validPage);
});

it('accepts an empty catalog without demo fallback', async () => {
  const { context, request } = setup();

  request.mockResolvedValue({
    ok: true,
    status: 200,
    data: {
      data: [],
      meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
    },
  });

  const result = await readProcedurePricesHttp(context);

  expect(result.data).toEqual([]);
  expect(result.meta.total).toBe(0);
});

it.each([
  { data: null },
  { data: [], meta: null },
  { data: 'invalid', meta: validPage.meta },
  { data: [null], meta: validPage.meta },
  { data: [{ ...validPrice, currency: 'USD' }], meta: validPage.meta },
  { data: [{ ...validPrice, basePrice: 150000 }], meta: validPage.meta },
  { data: [{ ...validPrice, basePrice: '-1.00' }], meta: validPage.meta },
  { data: [{ ...validPrice, version: 0 }], meta: validPage.meta },
  { data: [{ ...validPrice, status: 'UNKNOWN' }], meta: validPage.meta },
  { data: [{ ...validPrice, validFrom: 'tomorrow' }], meta: validPage.meta },
  { data: [validPrice], meta: { ...validPage.meta, page: 0 } },
  { data: [validPrice], meta: { ...validPage.meta, limit: 101 } },
])('rejects malformed catalog responses %#', async payload => {
  const { context, request } = setup();

  request.mockResolvedValue({
    ok: true,
    status: 200,
    data: payload,
  });

  await expect(readProcedurePricesHttp(context)).rejects.toThrow();
});

it('rejects HTTP failures without returning demo prices', async () => {
  const { context, request } = setup();

  request.mockResolvedValue({
    ok: false,
    status: 503,
    error: 'SERVICE_UNAVAILABLE',
  });

  await expect(readProcedurePricesHttp(context)).rejects.toThrow();
});

it('does not request data after cancellation', async () => {
  const { context, controller, request } = setup();
  controller.abort();

  await expect(readProcedurePricesHttp(context)).rejects.toThrow();

  expect(request).not.toHaveBeenCalled();
});

it('rejects a response received after cancellation', async () => {
  const { context, controller, request } = setup();

  let resolveRequest!: (response: unknown) => void;

  request.mockReturnValue(new Promise(resolve => {
    resolveRequest = resolve;
  }));

  const pending = readProcedurePricesHttp(context);

  controller.abort();

  resolveRequest({
    ok: true,
    status: 200,
    data: validPage,
  });

  await expect(pending).rejects.toThrow();
});
