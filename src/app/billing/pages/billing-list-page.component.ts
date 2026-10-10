import { Component } from '@angular/core';

type BillingInvoiceStatus =
  | 'DRAFT'
  | 'ISSUED'
  | 'PARTIAL'
  | 'PAID'
  | 'CANCELLED';

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
          <strong>{{ pendingInvoices }}</strong>
        </article>

        <article>
          <p>Facturas pagadas</p>
          <strong>{{ paidInvoices }}</strong>
        </article>
      </section>

      <section aria-labelledby="invoice-list-title">
        <h2 id="invoice-list-title">
          Facturas
        </h2>

        <table>
          <thead>
            <tr>
              <th>Factura</th>
              <th>Paciente</th>
              <th>Valor</th>
              <th>Estado</th>
            </tr>
          </thead>

          <tbody>
            @for (
              invoice of invoices;
              track invoice.id
            ) {
              <tr>
                <td>{{ invoice.number }}</td>
                <td>{{ invoice.patientName }}</td>
                <td>
                  COP
                  {{ invoice.amount.toLocaleString('es-CO') }}
                </td>
                <td>{{ invoice.status }}</td>
              </tr>
            }
          </tbody>
        </table>
      </section>
    </main>
  `,
})
export class BillingListPageComponent {
  readonly monthlyIncome = 250000;
  readonly pendingInvoices = 2;
  readonly paidInvoices = 1;

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
}