import { Component, EventEmitter, Input, Output } from '@angular/core';
import type { ReadInvoice } from '../data/invoice-read-adapter';
import {
  createInvoiceDetailReadState,
  type InvoiceDetailReadState,
} from '../data/invoice-detail-read-state';
import { formatCopMoney } from '../presentation/format-cop-money';

export interface InvoiceIssuanceIntent {
  readonly invoiceId: string;
  readonly expectedVersion: number;
}

@Component({
  selector: 'dlc-invoice-detail-http-page',
  standalone: true,
  template: `
    <section aria-label="Detalle de factura">
      <button type="button" (click)="back.emit()">Volver a facturas</button>
      <h1 tabindex="-1">Detalle de factura</h1>

      @if (selectedInvoice; as invoice) {
        <article>
          <h2>{{ displayNumber }}</h2>

          <p><strong>Identificador:</strong> {{ invoice.id }}</p>
          <p><strong>Paciente (ID):</strong> {{ invoice.patientId }}</p>

          @if (invoice.appointmentId) {
            <p><strong>Cita (ID):</strong> {{ invoice.appointmentId }}</p>
          }

          <p><strong>Estado:</strong> {{ statusLabel }}</p>
          <p><strong>Versión:</strong> {{ invoice.version }}</p>
          <p><strong>Moneda:</strong> {{ invoice.currency }}</p>

          <p><strong>Total:</strong> COP {{ formattedTotal }}</p>
          <p><strong>Saldo:</strong> COP {{ formattedBalance }}</p>

          <p role="note">
            Los conceptos de los cargos no se muestran porque
            su estructura aún no está validada.
          </p>

          @if (canIssueInvoices && invoice.status === 'DRAFT') {
            <button
              type="button"
              [disabled]="!canIssue"
              (click)="requestIssuance()"
            >
              {{ issuing ? 'Emitiendo factura...' : 'Emitir factura' }}
            </button>
          }

          @if (canDownloadPdfInvoices && invoice.status === 'ISSUED') {
            <button
              type="button"
              [disabled]="!canDownloadPdf"
              (click)="requestPdfDownload()"
            >
              {{ downloadingPdf ? 'Descargando PDF...' : 'Descargar PDF' }}
            </button>
          }

          @if (canPay) {
            <button
              type="button"
              (click)="requestPayment()"
            >
              Registrar pago
            </button>
          }
        </article>
      } @else {
        <p role="status">{{ statusMessage }}</p>
      }
    </section>
  `,
})
export class InvoiceDetailHttpPageComponent {
  @Input() readState: InvoiceDetailReadState = createInvoiceDetailReadState();
  @Input() canIssueInvoices = false;
  @Input() issuing = false;
  @Input() canDownloadPdfInvoices = false;
  @Input() downloadingPdf = false;
  @Input() canRecordPayments = false;

  @Output() readonly back = new EventEmitter<void>();
  @Output() readonly issue = new EventEmitter<InvoiceIssuanceIntent>();
  @Output() readonly downloadPdf = new EventEmitter<string>();
  @Output() readonly pay = new EventEmitter<string>();

  get selectedInvoice(): ReadInvoice | undefined {
    return this.readState.status === 'success'
      ? this.readState.invoice
      : undefined;
  }

  get canIssue(): boolean {
    return this.canIssueInvoices
      && !this.issuing
      && this.selectedInvoice?.status === 'DRAFT';
  }

  get canDownloadPdf(): boolean {
    return this.canDownloadPdfInvoices
      && !this.downloadingPdf
      && this.selectedInvoice?.status === 'ISSUED';
  }

  get canPay(): boolean {
    const invoice = this.selectedInvoice;

    return !!invoice
      && this.canRecordPayments
      && ['ISSUED', 'PARTIALLY_PAID'].includes(invoice.status)
      && BigInt(invoice.balance.replace('.', '')) > 0n;
  }

  requestPayment(): void {
    if (!this.canPay) return;

    const invoice = this.selectedInvoice;
    if (!invoice) return;

    this.pay.emit(invoice.id);
  }

  requestIssuance(): void {
    if (!this.canIssue) return;

    const invoice = this.selectedInvoice;
    if (!invoice) return;

    this.issue.emit({
      invoiceId: invoice.id,
      expectedVersion: invoice.version,
    });
  }

  requestPdfDownload(): void {
    if (!this.canDownloadPdf) return;

    const invoice = this.selectedInvoice;
    if (!invoice) return;

    this.downloadPdf.emit(invoice.id);
  }

  get displayNumber(): string {
    const invoice = this.selectedInvoice;
    return invoice?.invoiceNumber || invoice?.id || '';
  }

  get statusLabel(): string {
    const labels: Record<ReadInvoice['status'], string> = {
      DRAFT: 'Borrador',
      ISSUED: 'Emitida',
      PARTIALLY_PAID: 'Pago parcial',
      PAID: 'Pagada',
      CANCELLED: 'Cancelada',
    };

    const status = this.selectedInvoice?.status;
    return status ? labels[status] : '';
  }

  get formattedTotal(): string {
    const invoice = this.selectedInvoice;
    return invoice ? formatCopMoney(invoice.total) : '';
  }

  get formattedBalance(): string {
    const invoice = this.selectedInvoice;
    return invoice ? formatCopMoney(invoice.balance) : '';
  }

  get statusMessage(): string {
    switch (this.readState.status) {
      case 'idle':
        return 'No se ha consultado una factura.';
      case 'loading':
        return 'Consultando factura...';
      case 'error':
        return 'No fue posible consultar la factura.';
      case 'cancelled':
        return 'La consulta de la factura fue cancelada.';
      case 'success':
        return '';
    }
  }
}

