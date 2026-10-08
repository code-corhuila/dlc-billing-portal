import { describe, expect, it } from 'vitest';

import {
  calculateInvoiceTotal,
  canEditInvoice,
  canIssueInvoice,
  InvoiceStatus,
  issueInvoice,
} from './invoice-review';

describe('invoice review rules', () => {
  it('allows a draft invoice to remain editable and be issued', () => {
    const status: InvoiceStatus = 'DRAFT';

    expect(canEditInvoice(status)).toBe(true);
    expect(canIssueInvoice(status)).toBe(true);
  });

  it('makes an issued invoice immutable and prevents another issuance', () => {
    const status: InvoiceStatus = 'ISSUED';

    expect(canEditInvoice(status)).toBe(false);
    expect(canIssueInvoice(status)).toBe(false);
  });

  it('transitions a draft invoice to issued', () => {
    const status: InvoiceStatus = 'DRAFT';

    expect(issueInvoice(status)).toBe('ISSUED');
  });

  it('keeps an already issued invoice issued', () => {
    const status: InvoiceStatus = 'ISSUED';

    expect(issueInvoice(status)).toBe('ISSUED');
  });

  it('calculates the invoice total from its charge amounts', () => {
    const chargeAmounts = [80000, 20000, 30000];

    expect(calculateInvoiceTotal(chargeAmounts)).toBe(130000);
  });

  it('returns zero when the invoice has no charges', () => {
    expect(calculateInvoiceTotal([])).toBe(0);
  });
});