import '@angular/compiler';
import { Injector, runInInjectionContext } from '@angular/core';
import { expect, it, vi } from 'vitest';
import { ManualChargeFormComponent } from './manual-charge-form.component';

const patientId = '11111111-1111-4111-8111-111111111111';
const appointmentId = '22222222-2222-4222-8222-222222222222';
const procedureId = '33333333-3333-4333-8333-333333333333';
const sourceRecordId = '44444444-4444-4444-8444-444444444444';

function setup() {
  const injector = Injector.create({ providers: [] });
  const page = runInInjectionContext(
    injector,
    () => new ManualChargeFormComponent(),
  );

  page.patientId = patientId;
  page.appointmentId = appointmentId;
  page.procedureId = procedureId;
  page.sourceRecordId = sourceRecordId;
  page.canRecordManualCharges = true;

  return { page, injector };
}

function fillForm(page: ManualChargeFormComponent): void {
  page.itemType = 'ADDITIONAL_MATERIAL';
  page.concept = 'Additional dental material';
  page.quantity = '1.2500';
  page.unitPrice = '35000.50';
  page.justification = 'Required during the consultation';
}

it('emits the official manual charge intent with authorized context IDs', () => {
  const { page, injector } = setup();

  try {
    const emit = vi.spyOn(page.record, 'emit');
    fillForm(page);

    expect(page.canSubmit).toBe(true);
    page.submit();

    expect(emit).toHaveBeenCalledExactlyOnceWith({
      patientId,
      appointmentId,
      procedureId,
      sourceRecordId,
      itemType: 'ADDITIONAL_MATERIAL',
      concept: 'Additional dental material',
      quantity: '1.2500',
      unitPrice: '35000.50',
      currency: 'COP',
      justification: 'Required during the consultation',
      idempotencyKey: expect.any(String),
    });
  } finally {
    injector.destroy();
  }
});

it('rejects invalid quantity, price, concept and justification', () => {
  const { page, injector } = setup();

  try {
    const emit = vi.spyOn(page.record, 'emit');
    fillForm(page);

    for (const [field, value] of [
      ['quantity', '0'],
      ['quantity', '1.12345'],
      ['unitPrice', '0.00'],
      ['unitPrice', '-100.00'],
      ['concept', ' '],
      ['justification', ' '],
      ['concept', 'x'.repeat(501)],
      ['justification', 'x'.repeat(1001)],
    ] as const) {
      fillForm(page);
      page[field] = value;
      expect(page.canSubmit).toBe(false);
      page.submit();
    }

    expect(emit).not.toHaveBeenCalled();
  } finally {
    injector.destroy();
  }
});

it('requires valid source identifiers and an official item type', () => {
  const { page, injector } = setup();

  try {
    fillForm(page);

    page.sourceRecordId = '';
    expect(page.canSubmit).toBe(false);

    page.sourceRecordId = sourceRecordId;
    page.itemType = 'UNKNOWN' as typeof page.itemType;
    expect(page.canSubmit).toBe(false);

    page.itemType = 'OTHER_AUTHORIZED_CHARGE';
    expect(page.canSubmit).toBe(true);
  } finally {
    injector.destroy();
  }
});

it('blocks submissions without permission or while recording', () => {
  const { page, injector } = setup();

  try {
    const emit = vi.spyOn(page.record, 'emit');
    fillForm(page);

    page.canRecordManualCharges = false;
    expect(page.canSubmit).toBe(false);
    page.submit();

    page.canRecordManualCharges = true;
    page.recording = true;
    expect(page.canSubmit).toBe(false);
    page.submit();

    expect(emit).not.toHaveBeenCalled();
  } finally {
    injector.destroy();
  }
});

it('reuses an idempotency key for retries and changes it for new values', () => {
  const { page, injector } = setup();

  try {
    const emit = vi.spyOn(page.record, 'emit');
    fillForm(page);

    page.submit();
    page.submit();

    expect(emit).toHaveBeenCalledTimes(2);
    const firstKey = emit.mock.calls[0][0].idempotencyKey;

    expect(emit.mock.calls[1][0].idempotencyKey).toBe(firstKey);

    page.unitPrice = '40000.00';
    page.submit();

    expect(emit.mock.calls[2][0].idempotencyKey).not.toBe(firstKey);
  } finally {
    injector.destroy();
  }
});

it('discards draft values and resets the idempotency intent', () => {
  const { page, injector } = setup();

  try {
    const emit = vi.spyOn(page.record, 'emit');
    fillForm(page);
    page.submit();

    const firstKey = emit.mock.calls[0][0].idempotencyKey;

    page.discard();

    expect(page.concept).toBe('');
    expect(page.quantity).toBe('');
    expect(page.unitPrice).toBe('');
    expect(page.justification).toBe('');
    expect(page.canSubmit).toBe(false);

    fillForm(page);
    page.submit();

    expect(emit.mock.calls[1][0].idempotencyKey).not.toBe(firstKey);
  } finally {
    injector.destroy();
  }
});
