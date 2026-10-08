import { Component } from '@angular/core';

import {
  calculateInvoiceTotal,
  canDownloadInvoicePdf,
  canEditInvoice,
  canIssueInvoice,
  InvoiceStatus,
  issueInvoice,
} from '../domain/invoice-review';

interface InvoiceCharge {
  description: string;
  amount: number;
}

interface InvoiceReview {
  id: string;
  number: string;
  patientName: string;
  status: InvoiceStatus;
  charges: InvoiceCharge[];
}

@Component({
  selector: 'dlc-billing-page',
  standalone: true,
  template: '',
})
export class BillingPageComponent {
  invoice: InvoiceReview = {
    id: 'invoice-001',
    number: 'INV-001',
    patientName: 'Paciente de demostración',
    status: 'DRAFT',
    charges: [
      {
        description: 'Procedimiento odontológico',
        amount: 80000,
      },
      {
        description: 'Material adicional',
        amount: 20000,
      },
      {
        description: 'Cargo manual justificado',
        amount: 30000,
      },
    ],
  };

  get chargeAmounts(): number[] {
    return this.invoice.charges.map(
      (charge) => charge.amount,
    );
  }

  get invoiceTotal(): number {
    return calculateInvoiceTotal(
      this.chargeAmounts,
    );
  }

  get canEdit(): boolean {
    return canEditInvoice(
      this.invoice.status,
    );
  }

  get canIssue(): boolean {
    return canIssueInvoice(
      this.invoice.status,
      this.chargeAmounts,
    );
  }

  get canDownloadPdf(): boolean {
    return canDownloadInvoicePdf(
      this.invoice.status,
    );
  }

  issueReviewedInvoice(): void {
    this.invoice.status = issueInvoice(
      this.invoice.status,
      this.chargeAmounts,
    );
  }
}