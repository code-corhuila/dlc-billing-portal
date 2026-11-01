import { afterEach, expect, it, vi } from 'vitest';
import {
  readPaymentHistoryHttp,
} from './payment-history-http';

const invoiceId = '11111111-1111-4111-8111-111111111111';
const paymentId = '22222222-2222-4222-8222-222222222222';
const staffId = '33333333-3333-4333-8333-333333333333';

const payment = {
  id: paymentId,
  invoiceId,
  amount: '25000.01',
  method: 'CASH',
  recordedBy: staffId,
  recordedAt: '2026-11-01T14:00:00Z',
  version: 1,
};

const meta = {
  page: 1,
  limit: 20,
  total: 1,
  totalPages: 1,
};

function setup(
  data: unknown = { data: [payment], meta },
  status = 200,
) {
  const request = vi.fn().mockResolvedValue({
    ok: status === 200,
    status,
    data,
  });

  const controller = new AbortController();

  const context = {
    http: { request },
    signal: controller.signal,
  };

  return { context, request, controller };
}

afterEach(() => vi.restoreAllMocks());

it('reads authorized invoice payments with contract pagination', async () => {
  const { context, request } = setup();

  const result = await readPaymentHistoryHttp(
    context,
    invoiceId,
    1,
    20,
  );

  expect(request).toHaveBeenCalledExactlyOnceWith({
    method: 'GET',
    path: `/api/v1/invoices/${invoiceId}/payments?page=1&limit=20`,
    signal: context.signal,
  });

  expect(result.meta).toEqual(meta);
  expect(result.data).toEqual([payment]);
});

it('accepts an empty authorized payment page', async () => {
  const { context } = setup({
    data: [],
    meta: { page: 2, limit: 20, total: 0, totalPages: 0 },
  });

  const result = await readPaymentHistoryHttp(
    context,
    invoiceId,
    2,
    20,
  );

  expect(result.data).toEqual([]);
  expect(result.meta.total).toBe(0);
});

it('rejects invalid pagination before sending HTTP requests', async () => {
  const { context, request } = setup();

  await expect(
    readPaymentHistoryHttp(context, invoiceId, 0, 20),
  ).rejects.toThrow();

  await expect(
    readPaymentHistoryHttp(context, invoiceId, 1, 101),
  ).rejects.toThrow();

  await expect(
    readPaymentHistoryHttp(context, 'invalid', 1, 20),
  ).rejects.toThrow();

  expect(request).not.toHaveBeenCalled();
});

it('rejects payments belonging to another invoice', async () => {
  const { context } = setup({
    data: [{
      ...payment,
      invoiceId: '44444444-4444-4444-8444-444444444444',
    }],
    meta,
  });

  await expect(
    readPaymentHistoryHttp(context, invoiceId, 1, 20),
  ).rejects.toThrow();
});

it('rejects malformed payment amounts and pagination metadata', async () => {
  const invalidAmount = setup({
    data: [{ ...payment, amount: '25.001' }],
    meta,
  });

  await expect(
    readPaymentHistoryHttp(invalidAmount.context, invoiceId, 1, 20),
  ).rejects.toThrow();

  const invalidMeta = setup({
    data: [payment],
    meta: { ...meta, limit: 101 },
  });

  await expect(
    readPaymentHistoryHttp(invalidMeta.context, invoiceId, 1, 20),
  ).rejects.toThrow();
});

it('does not expose financial data after an HTTP authorization failure', async () => {
  const { context } = setup(
    { data: [payment], meta },
    403,
  );

  await expect(
    readPaymentHistoryHttp(context, invoiceId, 1, 20),
  ).rejects.toThrow();
});

it('does not request payment history after cancellation', async () => {
  const { context, request, controller } = setup();

  controller.abort();

  await expect(
    readPaymentHistoryHttp(context, invoiceId, 1, 20),
  ).rejects.toThrow();

  expect(request).not.toHaveBeenCalled();
});
