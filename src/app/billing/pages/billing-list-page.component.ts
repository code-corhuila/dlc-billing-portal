import { Component, EventEmitter, Input, Output } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { InvoiceListItem, InvoiceListStatus } from '../model/invoice-list-item';
import { copMoney } from '../model/cop-money';
import { formatCopMoney } from '../presentation/format-cop-money';
import { INVOICE_STATUSES } from '../model/generated/invoice-contract.generated';
import type { InvoiceReadStatus } from '../data/invoice-read-state';

type BillingInvoiceStatusFilter = 'ALL' | InvoiceListStatus;

@Component({
  selector: 'dlc-billing-list-page',
  standalone: true,
  imports: [RouterLink],
  styleUrl: './billing-list-page.component.css',
  template: `
    <section class="billing-page" aria-label="Facturación y pagos">
      <header>
        <p>Billing</p>

        <h1 tabindex="-1">Facturación y pagos</h1>

        <p>
          Consulta las facturas y su estado de pago.
        </p>

        @if (readOnly) {
          <p role="note">Consulta de facturas en modo de solo lectura. El detalle y los pagos no están disponibles.</p>
        } @else {
          <p role="note">Demostración con datos ficticios. Sin conexión con Billing API.</p>
        }
      </header>

      @if (showDemoSummary) {
      <section class="summary" aria-label="Resumen de facturación">
        <article>
          <p>Ingresos del mes</p>

          <strong>
            COP
            {{ formatAmount(monthlyIncome) }}
          </strong>
        </article>

        <article>
          <p>Facturas pendientes</p>

          <strong>
            {{ pendingInvoices }}
          </strong>
        </article>

        <article>
          <p>Facturas pagadas</p>

          <strong>
            {{ paidInvoices }}
          </strong>
        </article>
      </section>
      }

      <section class="invoice-panel" aria-labelledby="invoice-list-title">
        <h2 id="invoice-list-title">
          Facturas
        </h2>

        @if (isLoading) {
          <p role="status" aria-live="polite">Cargando facturas...</p>
        } @else if (readFeedback !== null) {
          <p role="status" aria-live="polite">{{ readFeedback }}</p>
        } @else {
        <div class="filters">
          <label for="invoice-search">
            Buscar factura
          </label>

          <input
            #searchInput
            id="invoice-search"
            type="search"
            [placeholder]="readOnly ? 'Factura o ID del paciente' : 'Factura o paciente'"
            [value]="searchTerm"
            (input)="updateSearchTerm(searchInput.value)"
          />

          <label for="invoice-status">
            Estado
          </label>

          <select
            #statusSelect
            id="invoice-status"
            [value]="selectedStatus"
            (change)="updateSelectedStatus(statusSelect.value)"
          >
            <option value="ALL">
              Todos
            </option>

            <option value="DRAFT">
              Borrador
            </option>

            <option value="ISSUED">
              Emitida
            </option>

            <option value="PARTIALLY_PAID">
              Pago parcial
            </option>

            <option value="PAID">
              Pagada
            </option>

            <option value="CANCELLED">
              Cancelada
            </option>
          </select>
        </div>

        @if (showNoResultsMessage) {
          <p role="status">
            No se encontraron facturas con los filtros seleccionados.
          </p>
        } @else {
          <div class="table-scroll" tabindex="0" role="region" aria-label="Tabla de facturas">
          <table>
            <thead>
              <tr>
                <th>Factura</th>
                <th>{{ patientColumnLabel }}</th>
                <th>Valor</th>
                <th>Estado</th>
                @if (canOpenInvoice) {
                  <th>Acción</th>
                }
              </tr>
            </thead>

            <tbody>
              @for (
                invoice of paginatedInvoices;
                track invoice.id
              ) {
                <tr>
                  <td>
                    {{ invoice.number }}
                  </td>

                  <td>
                    {{ displayPatient(invoice) }}
                  </td>

                  <td>
                    COP
                    {{ formatAmount(invoice.amount) }}
                  </td>

                  <td>
                    {{ statusLabels[invoice.status] }}
                  </td>

                  @if (canOpenInvoice) {
                  <td>
                    @if (composed) {
                      <button type="button" (click)="openInvoice.emit(invoice.id)"
                        [attr.aria-label]="'Ver factura ' + invoice.number">Ver factura</button>
                    } @else { <a
                      [routerLink]="getInvoiceDetailPath(invoice.id)"
                    >
                      Ver factura
                    </a> }
                  </td>
                  }
                </tr>
              }
            </tbody>
          </table>
          </div>

          @if (readOnly) {
            <p role="note">
              Los filtros y la paginación se aplican únicamente a las facturas recibidas,
              no a todas las facturas del sistema.
            </p>
          }

          <nav aria-label="Paginación de facturas">
            <button
              type="button"
              [disabled]="currentPage === 1"
              (click)="previousPage()"
            >
              Anterior
            </button>

            <span>
              Página {{ currentPage }} de {{ totalPages }}
            </span>

            <button
              type="button"
              [disabled]="currentPage === totalPages"
              (click)="nextPage()"
            >
              Siguiente
            </button>
          </nav>
        }
        }
      </section>
    </section>
  `,
})
export class BillingListPageComponent {
  @Input() composed = false;
  @Input() readOnly = false;
  @Input() canNavigateToInvoice = false;
  @Input() readStatus: InvoiceReadStatus = 'idle';
  @Output() readonly openInvoice = new EventEmitter<string>();

  readonly statusLabels: Record<InvoiceListStatus, string> = {
    DRAFT: 'Borrador', ISSUED: 'Emitida', PARTIALLY_PAID: 'Pago parcial',
    PAID: 'Pagada', CANCELLED: 'Cancelada',
  };

  readonly monthlyIncome = copMoney('250000.00');
  readonly formatAmount = formatCopMoney;

  get pendingInvoices(): number {
    return this.invoices.filter(invoice => ['ISSUED', 'PARTIALLY_PAID'].includes(invoice.status)).length;
  }

  get paidInvoices(): number {
    return this.invoices.filter(invoice => invoice.status === 'PAID').length;
  }

  readonly pageSize = 2;

  searchTerm = '';
  selectedStatus: BillingInvoiceStatusFilter = 'ALL';
  currentPage = 1;

  @Input() invoices: InvoiceListItem[] = [];

  get isLoading(): boolean {
    return this.readOnly && this.readStatus === 'loading';
  }

  get readFeedback(): string | null {
    if (!this.readOnly) return null;

    switch (this.readStatus) {
      case 'error':
        return 'No fue posible consultar las facturas.';
      case 'cancelled':
        return 'La consulta de facturas fue cancelada.';
      case 'success':
        return this.invoices.length === 0 ? 'No hay facturas disponibles.' : null;
      default:
        return null;
    }
  }

  get showNoResultsMessage(): boolean {
    return !this.isLoading &&
      this.readFeedback === null &&
      this.filteredInvoices.length === 0;
  }

  get showDemoSummary(): boolean {
    return !this.readOnly;
  }

  get canOpenInvoice(): boolean {
    return !this.readOnly || (this.composed && this.canNavigateToInvoice);
  }

  get patientColumnLabel(): string {
    return this.readOnly ? 'ID del paciente' : 'Paciente';
  }

  displayPatient(invoice: InvoiceListItem): string {
    return invoice.patientName;
  }

  get filteredInvoices(): InvoiceListItem[] {
    const normalizedSearchTerm =
      this.searchTerm
        .trim()
        .toLocaleLowerCase('es-CO');

    return this.invoices.filter((invoice) => {
      const matchesSearch =
        normalizedSearchTerm.length === 0 ||
        invoice.number
          .toLocaleLowerCase('es-CO')
          .includes(normalizedSearchTerm) ||
        invoice.patientName
          .toLocaleLowerCase('es-CO')
          .includes(normalizedSearchTerm);

      const matchesStatus =
        this.selectedStatus === 'ALL' ||
        invoice.status === this.selectedStatus;

      return matchesSearch && matchesStatus;
    });
  }

  get totalPages(): number {
    return Math.max(
      1,
      Math.ceil(
        this.filteredInvoices.length / this.pageSize,
      ),
    );
  }

  get paginatedInvoices(): InvoiceListItem[] {
    const startIndex =
      (this.currentPage - 1) * this.pageSize;

    return this.filteredInvoices.slice(
      startIndex,
      startIndex + this.pageSize,
    );
  }

  updateSearchTerm(value: string): void {
    this.searchTerm = value;
    this.currentPage = 1;
  }

  updateSelectedStatus(value: string): void {
    const allowedStatuses: BillingInvoiceStatusFilter[] = [
      'ALL',
      ...INVOICE_STATUSES,
    ];

    if (
      allowedStatuses.includes(
        value as BillingInvoiceStatusFilter,
      )
    ) {
      this.selectedStatus =
        value as BillingInvoiceStatusFilter;

      this.currentPage = 1;
    }
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage += 1;
    }
  }

  previousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage -= 1;
    }
  }

  getInvoiceDetailPath(invoiceId: string): string | null {
    return this.readOnly ? null : `invoices/${invoiceId}`;
  }
}
