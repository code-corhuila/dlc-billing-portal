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

  it('shows success feedback after issuing the invoice', () => {
    const component = new BillingPageComponent();

    component.issueReviewedInvoice();

    expect(component.feedbackMessage).toBe(
      'Factura emitida correctamente.',
    );
  });

  it('exposes an empty state when the invoice has no charges', () => {
    const component = new BillingPageComponent();

    component.invoice.charges = [];

    expect(component.isEmpty).toBe(true);
    expect(component.canIssue).toBe(false);
  });

  it('shows an error state when invoice loading fails', () => {
    const component = new BillingPageComponent();

    component.showLoadError();

    expect(component.hasLoadError).toBe(true);
    expect(component.errorMessage).toBe(
      'No fue posible cargar la factura.',
    );
  });

  it('simulates PDF download only for an issued invoice', () => {
    const component = new BillingPageComponent();

    component.downloadPdf();

    expect(component.feedbackMessage).toBe('');

    component.issueReviewedInvoice();
    component.downloadPdf();

    expect(component.feedbackMessage).toBe(
      'Descarga de PDF simulada.',
    );
  });
});