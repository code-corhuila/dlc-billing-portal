import '@angular/compiler';
import { Injector, runInInjectionContext } from '@angular/core';
import { expect, it, vi } from 'vitest';
import { InvoicePaymentHttpPageComponent } from './invoice-payment-http-page.component';
import { invoiceDetailReadSuccess } from '../data/invoice-detail-read-state';
import { readInvoiceDetail } from '../data/invoice-read-adapter';

const invoiceId = '11111111-1111-4111-8111-111111111111';

const apiInvoice = {
  id: invoiceId,
  patientId: '22222222-2222-4222-8222-222222222222',
  invoiceNumber: 'INV-2026-001',
  items: [],
  total: '150000.00',
  balance: '75000.00',
  currency: 'COP',
  status: 'PARTIALLY_PAID',
  version: 3,
};

function setup() {
  const injector = Injector.create({ providers: [] });
  const page = runInInjectionContext(
    injector,
    () => new InvoicePaymentHttpPageComponent(),
  );

  page.readState = invoiceDetailReadSuccess(readInvoiceDetail(apiInvoice));
  page.canRecordPayments = true;

  return { page, injector };
}

it('emits the payment intent using the actual invoice identifier and version', () => {
  const { page, injector } = setup();

  try {
    const emit = vi.spyOn(page.record, 'emit');

    page.amount = '25000.00';
    page.method = 'CASH';

    expect(page.selectedInvoice?.id).toBe(invoiceId);
    expect(page.canSubmit).toBe(true);

    page.submit();

    expect(emit).toHaveBeenCalledExactlyOnceWith({
      invoiceId,
      amount: '25000.00',
      method: 'CASH',
      expectedVersion: 3,
      idempotencyKey: expect.any(String),
    });

    expect(emit.mock.calls[0][0].idempotencyKey).toMatch(
      /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i,
    );
  } finally {
    injector.destroy();
  }
});

it('preserves the idempotency key for retries and replaces it when the payment changes', () => {
  const { page, injector } = setup();

  try {
    const emit = vi.spyOn(page.record, 'emit');

    page.amount = '25000.00';
    page.method = 'CASH';

    page.submit();
    page.submit();

    expect(emit).toHaveBeenCalledTimes(2);
    expect(emit.mock.calls[0][0].idempotencyKey).toBe(
      emit.mock.calls[1][0].idempotencyKey,
    );

    page.amount = '30000.00';
    page.submit();

    expect(emit.mock.calls[2][0].idempotencyKey).not.toBe(
      emit.mock.calls[0][0].idempotencyKey,
    );
  } finally {
    injector.destroy();
  }
});

it('rejects invalid amounts, missing methods and payments exceeding the balance', () => {
  const { page, injector } = setup();

  try {
    const emit = vi.spyOn(page.record, 'emit');

    page.method = 'CASH';

    for (const amount of [
      '',
      '0.00',
      '-1.00',
      '1.5',
      '75000.01',
    ]) {
      page.amount = amount;
      expect(page.canSubmit).toBe(false);
      page.submit();
    }

    page.amount = '1.00';
    page.method = ' ';
    expect(page.canSubmit).toBe(false);

    page.method = 'CASH';
    expect(page.canSubmit).toBe(true);

    page.submit();
    expect(emit).toHaveBeenCalledTimes(1);
  } finally {
    injector.destroy();
  }
});

it('blocks submissions without permission or while a request is pending', () => {
  const { page, injector } = setup();

  try {
    const emit = vi.spyOn(page.record, 'emit');

    page.amount = '25000.00';
    page.method = 'CASH';

    page.canRecordPayments = false;
    expect(page.canSubmit).toBe(false);
    page.submit();

    page.canRecordPayments = true;
    page.recording = true;
    expect(page.canSubmit).toBe(false);
    page.submit();

    expect(emit).not.toHaveBeenCalled();
  } finally {
    injector.destroy();
  }
});

it('rejects invoices that are not payable or have not loaded successfully', () => {
  const { page, injector } = setup();

  try {
    page.amount = '25000.00';
    page.method = 'CASH';

    for (const status of ['DRAFT', 'PAID', 'CANCELLED'] as const) {
      page.readState = invoiceDetailReadSuccess(
        readInvoiceDetail({ ...apiInvoice, status }),
      );
      expect(page.canSubmit).toBe(false);
    }

    page.readState = {
      status: 'loading',
      invoice: undefined,
    };

    expect(page.selectedInvoice).toBeUndefined();
    expect(page.canSubmit).toBe(false);
  } finally {
    injector.destroy();
  }
});

it('clears the payment draft and idempotency intent when discarded', () => {
  const { page, injector } = setup();

  try {
    const emit = vi.spyOn(page.record, 'emit');

    page.amount = '25000.00';
    page.method = 'CASH';
    page.submit();

    const firstKey = emit.mock.calls[0][0].idempotencyKey;

    page.discard();

    expect(page.amount).toBe('');
    expect(page.method).toBe('');
    expect(page.canSubmit).toBe(false);

    page.amount = '25000.00';
    page.method = 'CASH';
    page.submit();

    expect(emit.mock.calls[1][0].idempotencyKey).not.toBe(firstKey);
  } finally {
    injector.destroy();
  }
});
