import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

type BillingInvoiceStatus =
  | 'DRAFT'
  | 'ISSUED'
  | 'PARTIAL'
  | 'PAID'
  | 'CANCELLED';

type BillingInvoiceStatusFilter =
  | 'ALL'
  | BillingInvoiceStatus;

interface BillingInvoiceListItem {
  id: string;
  number: string;
  patientName: string;
  amount: number;
  status: BillingInvoiceStatus;
}

@Component({
  selector: 'dlc-billing-list-page',
  standalone: true,
  imports: [RouterLink],
  template: `
    <main>
      <header>
        <p>Billing</p>

        <h1>Facturación y pagos</h1>

        <p>
          Consulta las facturas y su estado de pago.
        </p>
      </header>

      <section aria-label="Resumen de facturación">
        <article>
          <p>Ingresos del mes</p>

          <strong>
            COP
            {{ monthlyIncome.toLocaleString('es-CO') }}
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

      <section aria-labelledby="invoice-list-title">
        <h2 id="invoice-list-title">
          Facturas
        </h2>

        <div>
          <label for="invoice-search">
            Buscar factura
          </label>

          <input
            #searchInput
            id="invoice-search"
            type="search"
            placeholder="Factura o paciente"
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

            <option value="PARTIAL">
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

        @if (filteredInvoices.length === 0) {
          <p>
            No se encontraron facturas con los filtros seleccionados.
          </p>
        } @else {
          <table>
            <thead>
              <tr>
                <th>Factura</th>
                <th>Paciente</th>
                <th>Valor</th>
                <th>Estado</th>
                <th>Acción</th>
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
                    {{ invoice.patientName }}
                  </td>

                  <td>
                    COP
                    {{ invoice.amount.toLocaleString('es-CO') }}
                  </td>

                  <td>
                    {{ invoice.status }}
                  </td>

                  <td>
                    <a
                      [routerLink]="getInvoiceDetailPath(invoice.id)"
                    >
                      Ver factura
                    </a>
                  </td>
                </tr>
              }
            </tbody>
          </table>

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
      </section>
    </main>
  `,
})
export class BillingListPageComponent {
  readonly monthlyIncome = 250000;
  readonly pendingInvoices = 2;
  readonly paidInvoices = 1;

  readonly pageSize = 2;

  searchTerm = '';
  selectedStatus: BillingInvoiceStatusFilter = 'ALL';
  currentPage = 1;

  readonly invoices: BillingInvoiceListItem[] = [
    {
      id: 'invoice-001',
      number: 'INV-001',
      patientName: 'Paciente de demostración',
      amount: 130000,
      status: 'PARTIAL',
    },
    {
      id: 'invoice-002',
      number: 'INV-002',
      patientName: 'Paciente de demostración 2',
      amount: 120000,
      status: 'ISSUED',
    },
    {
      id: 'invoice-003',
      number: 'INV-003',
      patientName: 'Paciente de demostración 3',
      amount: 250000,
      status: 'PAID',
    },
  ];

  get filteredInvoices(): BillingInvoiceListItem[] {
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

  get paginatedInvoices(): BillingInvoiceListItem[] {
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
      'DRAFT',
      'ISSUED',
      'PARTIAL',
      'PAID',
      'CANCELLED',
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

  getInvoiceDetailPath(invoiceId: string): string {
    return `invoices/${invoiceId}`;
  }
}