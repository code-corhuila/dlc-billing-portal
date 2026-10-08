import { describe, expect, it } from 'vitest';

import { BillingPageComponent } from './billing-page.component';

describe('BillingPageComponent', () => {
  it('starts with a draft invoice ready for review', () => {
    const component = new BillingPageComponent();

    expect(component.invoice.status).toBe('DRAFT');
    expect(component.invoice.charges.length).toBeGreaterThan(0);
    expect(component.invoiceTotal).toBe(130000);
    expect(component.canIssue).toBe(true);
    expect(component.canDownloadPdf).toBe(false);
  });

  it('issues the reviewed invoice and makes it immutable', () => {
    const component = new BillingPageComponent();

    component.issueReviewedInvoice();

    expect(component.invoice.status).toBe('ISSUED');
    expect(component.canIssue).toBe(false);
    expect(component.canEdit).toBe(false);
    expect(component.canDownloadPdf).toBe(true);
  });
});