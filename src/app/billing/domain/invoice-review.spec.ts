import { describe, expect, it } from 'vitest';

import {
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
});