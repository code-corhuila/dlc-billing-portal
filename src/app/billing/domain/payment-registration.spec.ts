import { describe, expect, it } from 'vitest';

import {
  calculateRemainingBalance,
  isValidPaymentAmount,
  resolvePaymentStatus,
} from './payment-registration';

describe('payment registration', () => {
  it('accepts a positive payment that does not exceed the pending balance', () => {
    expect(
      isValidPaymentAmount(50000, 100000),
    ).toBe(true);
  });

  it('rejects a zero payment', () => {
    expect(
      isValidPaymentAmount(0, 100000),
    ).toBe(false);
  });

  it('rejects a negative payment', () => {
    expect(
      isValidPaymentAmount(-10000, 100000),
    ).toBe(false);
  });

  it('rejects a payment greater than the pending balance', () => {
    expect(
      isValidPaymentAmount(120000, 100000),
    ).toBe(false);
  });

  it('allows a payment equal to the pending balance', () => {
    expect(
      isValidPaymentAmount(100000, 100000),
    ).toBe(true);
  });

  it('calculates the remaining balance after a payment', () => {
    expect(
      calculateRemainingBalance(100000, 40000),
    ).toBe(60000);
  });

  it('returns PARTIAL when a balance remains after payment', () => {
    expect(
      resolvePaymentStatus(60000),
    ).toBe('PARTIAL');
  });

  it('returns PAID when the remaining balance is zero', () => {
    expect(
      resolvePaymentStatus(0),
    ).toBe('PAID');
  });
});