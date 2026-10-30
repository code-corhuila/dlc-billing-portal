import { describe, expect, it, vi } from 'vitest';
import {
  ManualChargeHttpError,
  recordManualChargeHttp,
  type RecordManualChargeRequest,
} from './manual-charge-http';

const patientId = '11111111-1111-4111-8111-111111111111';
const appointmentId = '22222222-2222-4222-8222-222222222222';
const procedureId = '33333333-3333-4333-8333-333333333333';
const sourceRecordId = '44444444-4444-4444-8444-444444444444';
const idempotencyKey = '55555555-5555-4555-8555-555555555555';

const intent: RecordManualChargeRequest = {
  patientId,
  appointmentId,
  procedureId,
  sourceRecordId,
  itemType: 'ADDITIONAL_MATERIAL',
  concept: 'Additional dental material',
  quantity: '1.2500',
  unitPrice: '35000.50',
  currency: 'COP',
  justification: 'Required during the current consultation',
  idempotencyKey,
};

const response = {
  id: '66666666-6666-4666-8666-666666666666',
  patientId,
  appointmentId,
  procedureId,
  sourceRecordId,
  itemType: 'ADDITIONAL_MATERIAL',
  concept: intent.concept,
  quantity: '1.2500',
  unitPrice: '35000.50',
  currency: 'COP',
  justification: intent.justification,
  recordedBy: '77777777-7777-4777-8777-777777777777',
  recordedAt: '2026-10-29T14:00:00Z',
  status: 'PENDING_CLINICAL',
  version: 1,
};

function setup() {
  const controller = new AbortController();
  const request = vi.fn();

  return {
    controller,
    request,
    context: {
      http: { request },
      signal: controller.signal,
    },
  };
}

describe('manual charge HTTP registration', () => {
  it('uses the shared HTTP client and sends the official request fields', async () => {
    const { context, request } = setup();
    request.mockResolvedValue({
      ok: true,
      status: 201,
      data: response,
    });

    const recorded = await recordManualChargeHttp(context, intent);

    expect(request).toHaveBeenCalledExactlyOnceWith({
      method: 'POST',
      path: '/api/v1/manual-charges',
      body: {
        patientId,
        appointmentId,
        procedureId,
        sourceRecordId,
        itemType: 'ADDITIONAL_MATERIAL',
        concept: 'Additional dental material',
        quantity: '1.2500',
        unitPrice: '35000.50',
        currency: 'COP',
        justification: 'Required during the current consultation',
      },
      headers: {
        'Idempotency-Key': idempotencyKey,
      },
      signal: context.signal,
    });

    expect(recorded.id).toBe(response.id);
    expect(recorded.status).toBe('PENDING_CLINICAL');
  });

  it('preserves exact money and quantity without floating-point conversion', async () => {
    const { context, request } = setup();
    request.mockResolvedValue({
      ok: true,
      status: 201,
      data: response,
    });

    const recorded = await recordManualChargeHttp(context, intent);

    expect(recorded.unitPrice).toBe('35000.50');
    expect(recorded.quantity).toBe('1.2500');
    expect(recorded.version).toBe(1);
  });

  it.each([
    [{ quantity: '0' }, 'zero quantity'],
    [{ quantity: '1.12345' }, 'excess quantity precision'],
    [{ unitPrice: '0.00' }, 'zero unit price'],
    [{ justification: ' ' }, 'blank justification'],
    [{ concept: ' ' }, 'blank concept'],
    [{ currency: 'USD' as 'COP' }, 'unsupported currency'],
  ])('rejects %s before sending HTTP (%s)', async (changes) => {
    const { context, request } = setup();

    await expect(
      recordManualChargeHttp(context, { ...intent, ...changes }),
    ).rejects.toThrow();

    expect(request).not.toHaveBeenCalled();
  });

  it('does not send a request when the operation is cancelled', async () => {
    const { context, controller, request } = setup();
    controller.abort();

    await expect(
      recordManualChargeHttp(context, intent),
    ).rejects.toThrow();

    expect(request).not.toHaveBeenCalled();
  });

  it('propagates an HTTP conflict without retrying the charge', async () => {
    const { context, request } = setup();
    request.mockResolvedValue({
      ok: false,
      status: 409,
      kind: 'http',
    });

    await expect(
      recordManualChargeHttp(context, intent),
    ).rejects.toMatchObject({
      name: 'ManualChargeHttpError',
      status: 409,
    } satisfies Partial<ManualChargeHttpError>);

    expect(request).toHaveBeenCalledTimes(1);
  });
});
