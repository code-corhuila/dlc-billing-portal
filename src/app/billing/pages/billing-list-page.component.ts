import { Component } from '@angular/core';

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
    </main>
  `,
})
export class BillingListPageComponent {}