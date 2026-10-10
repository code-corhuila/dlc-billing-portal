import { Component, InjectionToken, computed, inject, signal } from '@angular/core';
import { PortalContext } from '../shell-contract';

export const BILLING_CONTEXT = new InjectionToken<PortalContext>('billing.context');

@Component({
  selector: 'dlc-billing-root',
  standalone: true,
  template: `<main aria-label="Billing"><h1 tabindex="-1">{{ title() }}</h1>
    <p role="status">{{ message() }}</p></main>`,
})
export class BillingCompositionRoot {
  readonly route = signal(inject(BILLING_CONTEXT).route);
  readonly title = computed(() => this.route().localPath === '/'
    ? 'Facturación' : 'Página no encontrada');
  readonly message = computed(() => this.route().localPath === '/'
    ? 'La integración de Billing no está disponible.'
    : 'La ruta solicitada no está disponible en Billing.');
}
