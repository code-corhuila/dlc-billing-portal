import { Component, EventEmitter, Input, Output } from '@angular/core';
import type { InvoiceDetail } from '../model/invoice-detail';
import { formatCopMoney } from '../presentation/format-cop-money';

@Component({
  selector: 'dlc-invoice-detail-page',
  standalone: true,
  styleUrl: './invoice-detail-page.component.css',
  template: `
    <section aria-label="Detalle de factura">
      <button type="button" (click)="back.emit()">Volver a facturas</button>
      <h1 tabindex="-1">Detalle de factura</h1>
      <p role="note">Demostración con datos ficticios. Sin conexión con Billing API.</p>
      @if (invoice; as selected) {
        <article>
          <h2>{{ selected.number }}</h2>
          <p><strong>Paciente:</strong> {{ selected.patientName }}</p>
          <p><strong>Estado:</strong> {{ statusLabels[selected.status] }}</p>
          <h2>Cargos</h2>
          @if (selected.charges.length === 0) {
            <p role="status">No hay cargos disponibles para esta factura.</p>
          } @else {
            <div class="table-scroll" tabindex="0" role="region" aria-label="Cargos de la factura">
              <table>
                <caption>Detalle financiero ficticio de {{ selected.number }}</caption>
                <thead><tr><th scope="col">Concepto</th><th scope="col">Valor</th></tr></thead>
                <tbody>@for (charge of selected.charges; track $index) {
                  <tr><td>{{ charge.description }}</td><td>COP {{ formatAmount(charge.amount) }}</td></tr>
                }</tbody>
              </table>
            </div>
          }
          <p class="total"><strong>Total de demostración:</strong> COP {{ formatAmount(selected.amount) }}</p>
          <p>Emisión, pagos y PDF pendientes en esta demostración.</p>
        </article>
      } @else {
        <p role="status">La factura solicitada no está disponible.</p>
      }
    </section>`,
})
export class InvoiceDetailPageComponent {
  @Input() invoice?: InvoiceDetail;
  @Output() readonly back = new EventEmitter<void>();
  readonly formatAmount = formatCopMoney;
  readonly statusLabels = {
    DRAFT: 'Borrador', ISSUED: 'Emitida', PARTIALLY_PAID: 'Pago parcial', PAID: 'Pagada', CANCELLED: 'Cancelada',
  };
}
