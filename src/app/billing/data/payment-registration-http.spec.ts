import { expect, it, vi } from 'vitest';

import {
  recordPaymentHttp,
  PaymentRegistrationHttpError,
} from './payment-registration-http';

const invoiceId = '11111111-1111-4111-8111-111111111111';
const paymentId = '33333333-3333-4333-8333-333333333333';
const recordedBy = '22222222-2222-4222-8222-222222222222';
const idempotencyKey = '44444444-4444-4444-8444-444444444444';

function setup() {
  const controller = new AbortController();
  const request = vi.fn();

  return {
    context: {
      http: { request },
      signal: controller.signal,
    },
    controller,
    request,
  };
}

function paymentResponse() {
  return {
    ok: true as const,
    status: 201,
    data: {
      id: paymentId,
      invoiceId,
      amount: '150000.00',
      method: 'CASH',
      recordedBy,
      recordedAt: '2026-10-27T12:00:00Z',
      version: 1,
    },
    headers: {
      location: `/api/v1/payments/${paymentId}`,
    },
    correlationId: 'test-correlation',
  };
}

function paymentIntent() {
  return {
    invoiceId,
    amount: '150000.00',
    method: 'CASH',
    expectedVersion: 3,
    idempotencyKey,
  };
}

it('registers a payment through the shared HTTP client', async () => {
  const { context, request } = setup();
  request.mockResolvedValue(paymentResponse());

  const payment = await recordPaymentHttp(context, paymentIntent());

  expect(request).toHaveBeenCalledExactlyOnceWith({
    method: 'POST',
    path: `/api/v1/invoices/${invoiceId}/payments`,
    body: {
      amount: '150000.00',
      method: 'CASH',
      expectedVersion: 3,
    },
    headers: {
      'Idempotency-Key': idempotencyKey,
    },
    signal: context.signal,
  });

  expect(payment.id).toBe(paymentId);
  expect(payment.invoiceId).toBe(invoiceId);
  expect(payment.amount).toBe('150000.00');
  expect(payment.version).toBe(1);
});

it('rejects invalid payment amounts before making a request', async () => {
  const { context, request } = setup();

  await expect(recordPaymentHttp(context, {
    ...paymentIntent(),
    amount: '0.00',
  })).rejects.toThrow();

  await expect(recordPaymentHttp(context, {
    ...paymentIntent(),
    amount: '150000.5',
  })).rejects.toThrow();

  expect(request).not.toHaveBeenCalled();
});

it('rejects invalid payment methods', async () => {
  const { context, request } = setup();

  await expect(recordPaymentHttp(context, {
    ...paymentIntent(),
    method: ' ',
  })).rejects.toThrow();

  await expect(recordPaymentHttp(context, {
    ...paymentIntent(),
    method: 'X'.repeat(41),
  })).rejects.toThrow();

  expect(request).not.toHaveBeenCalled();
});

it('rejects invalid invoice versions', async () => {
  const { context, request } = setup();

  await expect(recordPaymentHttp(context, {
    ...paymentIntent(),
    expectedVersion: 0,
  })).rejects.toThrow();

  await expect(recordPaymentHttp(context, {
    ...paymentIntent(),
    expectedVersion: 1.5,
  })).rejects.toThrow();

  expect(request).not.toHaveBeenCalled();
});

it('rejects invalid idempotency keys', async () => {
  const { context, request } = setup();

  await expect(recordPaymentHttp(context, {
    ...paymentIntent(),
    idempotencyKey: 'invalid-key',
  })).rejects.toThrow();

  expect(request).not.toHaveBeenCalled();
});

it('does not send a request after cancellation', async () => {
  const { context, controller, request } = setup();
  controller.abort();

  await expect(recordPaymentHttp(context, paymentIntent()))
    .rejects.toThrow();

  expect(request).not.toHaveBeenCalled();
});

it('rejects a response received after cancellation', async () => {
  const { context, controller, request } = setup();
  request.mockImplementation(async () => {
    controller.abort();
    return paymentResponse();
  });

  await expect(recordPaymentHttp(context, paymentIntent()))
    .rejects.toThrow();
});

it('preserves HTTP conflict status for the composition layer', async () => {
  const { context, request } = setup();

  request.mockResolvedValue({
    ok: false,
    status: 409,
    error: 'STALE_VERSION',
    message: 'Internal conflict details',
    details: null,
    traceId: 'test-trace',
    correlationId: 'test-correlation',
    kind: 'http',
    retryable: false,
  });

  await expect(recordPaymentHttp(context, paymentIntent()))
    .rejects.toMatchObject({
      name: 'PaymentRegistrationHttpError',
      status: 409,
    });

  expect(PaymentRegistrationHttpError).toBeDefined();
});

it('rejects malformed payment responses', async () => {
  const { context, request } = setup();

  request.mockResolvedValue({
    ...paymentResponse(),
    data: {
      ...paymentResponse().data,
      recordedBy: undefined,
    },
  });

  await expect(recordPaymentHttp(context, paymentIntent()))
    .rejects.toThrow();
});

it('rejects a payment belonging to another invoice', async () => {
  const { context, request } = setup();

  request.mockResolvedValue({
    ...paymentResponse(),
    data: {
      ...paymentResponse().data,
      invoiceId: '55555555-5555-4555-8555-555555555555',
    },
  });

  await expect(recordPaymentHttp(context, paymentIntent()))
    .rejects.toThrow();
});

it('rejects an unexpected successful HTTP status', async () => {
  const { context, request } = setup();

  request.mockResolvedValue({
    ...paymentResponse(),
    status: 200,
  });

  await expect(recordPaymentHttp(context, paymentIntent()))
    .rejects.toThrow();
});
