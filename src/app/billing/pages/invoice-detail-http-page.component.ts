import { Component, EventEmitter, Input, Output } from '@angular/core';
import type { ReadInvoice } from '../data/invoice-read-adapter';
import {
  createInvoiceDetailReadState,
  type InvoiceDetailReadState,
} from '../data/invoice-detail-read-state';
import { formatCopMoney } from '../presentation/format-cop-money';

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
        </article>
      } @else {
        <p role="status">{{ statusMessage }}</p>
      }
    </section>
  `,
})
export class InvoiceDetailHttpPageComponent {
  @Input() readState: InvoiceDetailReadState = createInvoiceDetailReadState();

  @Output() readonly back = new EventEmitter<void>();

  get selectedInvoice(): ReadInvoice | undefined {
    return this.readState.status === 'success'
      ? this.readState.invoice
      : undefined;
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
