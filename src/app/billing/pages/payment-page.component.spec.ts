import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { PaymentPageComponent } from './payment-page.component';

describe('PaymentPageComponent', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts with mock invoice payment data', () => {
    const component = new PaymentPageComponent();

    expect(component.invoice.number).toBe('INV-001');
    expect(component.invoice.total).toBe(130000);
    expect(component.invoice.paid).toBe(30000);
    expect(component.pendingBalance).toBe(100000);
    expect(component.paymentAmount).toBe(0);
  });

  it('rejects an invalid payment amount', () => {
    const component = new PaymentPageComponent();

    component.paymentAmount = 120000;
    component.registerPayment();

    expect(component.feedbackMessage).toBe(
      'El valor del pago no es válido.',
    );
    expect(component.invoice.paid).toBe(30000);
  });

  it('registers a partial payment', () => {
    const component = new PaymentPageComponent();

    component.paymentAmount = 40000;
    component.registerPayment();

    expect(component.invoice.paid).toBe(70000);
    expect(component.pendingBalance).toBe(60000);
    expect(component.invoice.status).toBe('PARTIAL');
    expect(component.feedbackMessage).toBe(
      'Pago registrado correctamente.',
    );
  });

  it('marks the invoice as paid when the balance reaches zero', () => {
    const component = new PaymentPageComponent();

    component.paymentAmount = 100000;
    component.registerPayment();

    expect(component.invoice.paid).toBe(130000);
    expect(component.pendingBalance).toBe(0);
    expect(component.invoice.status).toBe('PAID');
  });

  it('rejects a duplicated payment key', () => {
    const component = new PaymentPageComponent();

    component.idempotencyKey = 'payment-001';
    component.paymentAmount = 20000;
    component.registerPayment();

    expect(component.feedbackMessage).toBe(
      'Este pago ya fue procesado.',
    );
    expect(component.invoice.paid).toBe(30000);
  });

  it('starts with no payment request in progress', () => {
    const component = new PaymentPageComponent();

    expect(component.isSubmitting).toBe(false);
  });

  it('disables payment registration while a simulated request is in progress', () => {
    const component = new PaymentPageComponent();

    component.paymentAmount = 40000;
    component.startPaymentRequest();

    expect(component.isSubmitting).toBe(true);
    expect(component.canRegisterPayment).toBe(false);
  });

  it('completes the simulated payment request automatically', () => {
    vi.useFakeTimers();

    const component = new PaymentPageComponent();

    component.paymentAmount = 40000;
    component.startPaymentRequest();

    expect(component.isSubmitting).toBe(true);

    vi.runAllTimers();

    expect(component.isSubmitting).toBe(false);
    expect(component.invoice.paid).toBe(70000);
    expect(component.pendingBalance).toBe(60000);
    expect(component.invoice.status).toBe('PARTIAL');
    expect(component.feedbackMessage).toBe(
      'Pago registrado correctamente.',
    );
  });
});