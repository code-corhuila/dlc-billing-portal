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
  template: `
    <main>
      <header>
        <p>Billing</p>
        <h1>Revisión de factura</h1>
        <p>
          Revisa los cargos antes de emitir la factura.
        </p>
      </header>

      @if (hasLoadError) {
        <section>
          <p>{{ errorMessage }}</p>
        </section>
      } @else {
        <section>
          <h2>{{ invoice.number }}</h2>

          <p>
            <strong>Paciente:</strong>
            {{ invoice.patientName }}
          </p>

          <p>
            <strong>Estado:</strong>
            {{ invoice.status }}
          </p>
        </section>

        <section>
          <h2>Cargos</h2>

          @if (isEmpty) {
            <p>
              No hay cargos disponibles para esta factura.
            </p>
          } @else {
            <table>
              <thead>
                <tr>
                  <th>Concepto</th>
                  <th>Valor</th>
                </tr>
              </thead>

              <tbody>
                @for (
                  charge of invoice.charges;
                  track charge.description
                ) {
                  <tr>
                    <td>{{ charge.description }}</td>
                    <td>
                      COP
                      {{ charge.amount.toLocaleString('es-CO') }}
                    </td>
                  </tr>
                }
              </tbody>

              <tfoot>
                <tr>
                  <th>Total</th>
                  <th>
                    COP
                    {{ invoiceTotal.toLocaleString('es-CO') }}
                  </th>
                </tr>
              </tfoot>
            </table>
          }
        </section>

        <section>
          @if (canEdit) {
            <p>
              La factura todavía está disponible para revisión.
            </p>
          } @else {
            <p>
              La factura emitida es inmutable.
            </p>
          }

          @if (feedbackMessage) {
            <p>
              {{ feedbackMessage }}
            </p>
          }

          <button
            type="button"
            [disabled]="!canIssue"
            (click)="issueReviewedInvoice()"
          >
            Emitir factura
          </button>

          <button
            type="button"
            [disabled]="!canDownloadPdf"
            (click)="downloadPdf()"
          >
            Descargar PDF
          </button>
        </section>
      }
    </main>
  `,
})
export class BillingPageComponent {
  feedbackMessage = '';
  hasLoadError = false;
  errorMessage = '';

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

  get isEmpty(): boolean {
    return this.invoice.charges.length === 0;
  }

  issueReviewedInvoice(): void {
    if (!this.canIssue) {
      return;
    }

    this.invoice.status = issueInvoice(
      this.invoice.status,
      this.chargeAmounts,
    );

    this.feedbackMessage =
      'Factura emitida correctamente.';
  }

  showLoadError(): void {
    this.hasLoadError = true;
    this.errorMessage =
      'No fue posible cargar la factura.';
  }

  downloadPdf(): void {
    if (!this.canDownloadPdf) {
      return;
    }

    this.feedbackMessage =
      'Descarga de PDF simulada.';
  }
}