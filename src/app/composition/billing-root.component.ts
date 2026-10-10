import { Component, InjectionToken, inject, signal } from '@angular/core';
import { PortalContext } from '../shell-contract';

export const BILLING_CONTEXT = new InjectionToken<PortalContext>('billing.context');

@Component({
  selector: 'dlc-billing-root',
  standalone: true,
  template: `<main aria-label="Billing"><h1>Facturación</h1>
    <p role="status">La integración de Billing no está disponible.</p></main>`,
})
export class BillingCompositionRoot {
  readonly route = signal(inject(BILLING_CONTEXT).route);
}
