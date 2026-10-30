
import '@angular/compiler';
import { Injector, runInInjectionContext } from '@angular/core';
import { expect, it, vi } from 'vitest';
import { BILLING_CONTEXT, BillingCompositionRoot } from './billing-root.component';
import { provideInvoiceListSource } from '../billing/data/invoice-list-source';
import { dummyInvoiceList } from '../billing/data/invoice-list.dummy';
import type { RecordManualChargeRequest } from '../billing/data/manual-charge-http';

const source = {
  patientId: '11111111-1111-4111-8111-111111111111',
  appointmentId: '22222222-2222-4222-8222-222222222222',
  procedureId: '33333333-3333-4333-8333-333333333333',
  sourceRecordId: '44444444-4444-4444-8444-444444444444',
};

const intent: RecordManualChargeRequest = {
  ...source,
  itemType: 'ADDITIONAL_MATERIAL',
  concept: 'Additional dental material',
  quantity: '1.2500',
  unitPrice: '35000.50',
  currency: 'COP',
  justification: 'Required during the consultation',
  idempotencyKey: '55555555-5555-4555-8555-555555555555',
};

function setup() {
  const controller = new AbortController();
  const request = vi.fn();
  const reportFailure = vi.fn();

  const context = {
    route: {
      localPath: '/',
      basePath: '/app/billing',
    },
    navigation: {
      request: vi.fn().mockResolvedValue({ status: 'applied' }),
    },
    http: { request },
    signal: controller.signal,
    reportFailure,
    session: {
      getSnapshot: vi.fn(),
      subscribe: () => () => {},
    },
  };

  const injector = Injector.create({
    providers: [
      provideInvoiceListSource(dummyInvoiceList),
      { provide: BILLING_CONTEXT, useValue: context },
    ],
  });

  const root = runInInjectionContext(
    injector,
    () => new BillingCompositionRoot(),
  );

  root.session.set({
    state: 'authenticated',
    user: { roles: ['DENTIST'] },
  } as never);

  return { root, injector, request, reportFailure, context };
}

const serviceUnavailable = {
  ok: false,
  status: 503,
  error: 'SERVICE_UNAVAILABLE',
  message: 'Service unavailable',
  kind: 'http',
  retryable: true,
};

it('keeps manual charge registration disabled without a clinical source', async () => {
  const { root, injector, request } = setup();

  try {
    expect(root.manualChargeContext()).toBeNull();
    expect(root.canRecordManualCharges()).toBe(true);

    await root.registerManualCharge(intent);

    expect(request).not.toHaveBeenCalled();
  } finally {
    injector.destroy();
  }
});

it('submits the authorized manual charge through the shared HTTP client', async () => {
  const { root, injector, request, context } = setup();

  try {
    root.manualChargeContext.set(source);
    request.mockResolvedValue(serviceUnavailable);

    await root.registerManualCharge(intent);

    expect(request).toHaveBeenCalledExactlyOnceWith({
      method: 'POST',
      path: '/api/v1/manual-charges',
      body: {
        patientId: source.patientId,
        appointmentId: source.appointmentId,
        procedureId: source.procedureId,
        sourceRecordId: source.sourceRecordId,
        itemType: intent.itemType,
        concept: intent.concept,
        quantity: intent.quantity,
        unitPrice: intent.unitPrice,
        currency: 'COP',
        justification: intent.justification,
      },
      headers: {
        'Idempotency-Key': intent.idempotencyKey,
      },
      signal: context.signal,
    });
  } finally {
    injector.destroy();
  }
});

it('rejects assistants and unauthenticated users', async () => {
  const { root, injector, request } = setup();

  try {
    root.manualChargeContext.set(source);

    for (const roles of [['SECRETARY_ASSISTANT'], []]) {
      root.session.set({
        state: 'authenticated',
        user: { roles },
      } as never);

      await root.registerManualCharge(intent);
    }

    root.session.set({
      state: 'anonymous',
      user: null,
    } as never);

    await root.registerManualCharge(intent);

    expect(request).not.toHaveBeenCalled();
  } finally {
    injector.destroy();
  }
});

it('rejects requests that do not match the selected clinical source', async () => {
  const { root, injector, request } = setup();

  try {
    root.manualChargeContext.set(source);

    await root.registerManualCharge({
      ...intent,
      sourceRecordId: '66666666-6666-4666-8666-666666666666',
    });

    expect(request).not.toHaveBeenCalled();
  } finally {
    injector.destroy();
  }
});

it('prevents concurrent submissions for the same composition', async () => {
  const { root, injector, request } = setup();

  try {
    root.manualChargeContext.set(source);

    let resolveRequest!: (value: unknown) => void;

    request.mockImplementationOnce(
      () => new Promise(resolve => {
        resolveRequest = resolve;
      }),
    );

    const first = root.registerManualCharge(intent);
    await root.registerManualCharge(intent);

    expect(request).toHaveBeenCalledTimes(1);
    expect(root.recordingManualCharge()).toBe(true);

    resolveRequest(serviceUnavailable);
    await first;

    expect(root.recordingManualCharge()).toBe(false);
  } finally {
    injector.destroy();
  }
});

it('reports a registration failure without exposing technical details', async () => {
  const { root, injector, request, reportFailure } = setup();

  try {
    root.manualChargeContext.set(source);
    request.mockResolvedValue(serviceUnavailable);

    await root.registerManualCharge(intent);

    expect(root.manualChargeMessage()).toContain('No se pudo');
    expect(reportFailure).toHaveBeenCalledExactlyOnceWith({
      code: 'PORTAL_TASK_FAILED',
    });
  } finally {
    injector.destroy();
  }
});
