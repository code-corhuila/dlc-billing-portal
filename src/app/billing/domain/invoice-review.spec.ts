import { describe, expect, it } from 'vitest';

import {
  canEditInvoice,
  canIssueInvoice,
  InvoiceStatus,
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
});