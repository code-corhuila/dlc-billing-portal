import '@angular/compiler';
import { Injector, runInInjectionContext } from '@angular/core';
import { expect, it, vi } from 'vitest';
import {
  BILLING_CONTEXT,
  BillingCompositionRoot,
} from './billing-root.component';
import { provideInvoiceListSource } from '../billing/data/invoice-list-source';
import { dummyInvoiceList } from '../billing/data/invoice-list.dummy';
import { ManualChargeFormComponent } from '../billing/pages/manual-charge-form.component';

const source = {
  patientId: '11111111-1111-4111-8111-111111111111',
  appointmentId: '22222222-2222-4222-8222-222222222222',
  procedureId: '33333333-3333-4333-8333-333333333333',
  sourceRecordId: '44444444-4444-4444-8444-444444444444',
};

function setup(localPath = '/manual-charges/new') {
  const controller = new AbortController();
  const request = vi.fn();

  const context = {
    route: { localPath, basePath: '/app/billing' },
    navigation: {
      request: vi.fn().mockResolvedValue({ status: 'applied' }),
    },
    http: { request },
    signal: controller.signal,
    reportFailure: vi.fn(),
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

  root.invoiceListMode.set('http');
  root.session.set({
    state: 'authenticated',
    user: { roles: ['DENTIST'] },
  } as never);

  return { root, injector, request };
}

function createForm(injector: Injector): ManualChargeFormComponent {
  return runInInjectionContext(
    injector,
    () => new ManualChargeFormComponent(),
  );
}

it('selects the manual charge form only on its composed route', () => {
  const { root, injector } = setup();

  try {
    expect(root.isManualChargeRoute()).toBe(true);

    root.route.set({ ...root.route(), localPath: '/' });
    expect(root.isManualChargeRoute()).toBe(false);

    root.route.set({
      ...root.route(),
      localPath: '/manual-charges/new',
    });

    root.invoiceListMode.set('demo');
    expect(root.isManualChargeRoute()).toBe(false);
  } finally {
    injector.destroy();
  }
});

it('keeps registration disabled without a clinical source', () => {
  const { root, injector } = setup();

  try {
    const form = createForm(injector);
    const context = root.manualChargeContext();

    expect(context).toBeNull();

    form.canRecordManualCharges =
      root.canSubmitManualCharge();

    expect(form.canSubmit).toBe(false);
  } finally {
    injector.destroy();
  }
});

it('passes authorized context and permissions into the form', () => {
  const { root, injector } = setup();

  try {
    root.manualChargeContext.set(source);

    const form = createForm(injector);
    const selected = root.manualChargeContext();

    expect(selected).not.toBeNull();

    form.patientId = selected!.patientId;
    form.appointmentId = selected!.appointmentId;
    form.procedureId = selected!.procedureId;
    form.sourceRecordId = selected!.sourceRecordId;
    form.canRecordManualCharges =
      root.canSubmitManualCharge();

    form.concept = 'Additional material';
    form.quantity = '1.0000';
    form.unitPrice = '35000.00';
    form.justification = 'Required during consultation';

    expect(form.canSubmit).toBe(true);

    root.session.set({
      state: 'authenticated',
      user: { roles: ['SECRETARY_ASSISTANT'] },
    } as never);

    form.canRecordManualCharges =
      root.canSubmitManualCharge();

    expect(form.canSubmit).toBe(false);
  } finally {
    injector.destroy();
  }
});

it('forwards form intents to the composition registration handler', () => {
  const { root, injector } = setup();

  try {
    root.manualChargeContext.set(source);

    const register = vi.spyOn(root, 'registerManualCharge')
      .mockResolvedValue(undefined);

    const form = createForm(injector);
    form.patientId = source.patientId;
    form.appointmentId = source.appointmentId;
    form.procedureId = source.procedureId;
    form.sourceRecordId = source.sourceRecordId;
    form.canRecordManualCharges =
      root.canSubmitManualCharge();

    form.concept = 'Additional material';
    form.quantity = '1.0000';
    form.unitPrice = '35000.00';
    form.justification = 'Required during consultation';

    form.record.subscribe(intent =>
      root.requestManualChargeRegistration(intent));

    form.submit();

    expect(register).toHaveBeenCalledExactlyOnceWith({
      ...source,
      itemType: 'ADDITIONAL_MATERIAL',
      concept: 'Additional material',
      quantity: '1.0000',
      unitPrice: '35000.00',
      currency: 'COP',
      justification: 'Required during consultation',
      idempotencyKey: expect.any(String),
    });
  } finally {
    injector.destroy();
  }
});

it('blocks navigation while a manual charge is recording', () => {
  const { root, injector } = setup();

  try {
    expect(root.canLeave()).toBe(true);

    root.recordingManualCharge.set(true);
    expect(root.canLeave()).toBe(false);

    root.recordingManualCharge.set(false);
    expect(root.canLeave()).toBe(true);
  } finally {
    injector.destroy();
  }
});
