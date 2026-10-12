import { Component, InjectionToken, computed, inject, signal } from '@angular/core';
import { PortalContext } from '../shell-contract';
import { BillingListPageComponent } from '../billing/pages/billing-list-page.component';

export const BILLING_CONTEXT = new InjectionToken<PortalContext>('billing.context');

@Component({
  selector: 'dlc-billing-root',
  standalone: true,
  imports: [BillingListPageComponent],
  template: `@if (isInvoiceList()) {
    <dlc-billing-list-page [composed]="true" (openInvoice)="openInvoice($event)" />
    <p role="status">{{ navigationMessage() }}</p>
  } @else {
    <section aria-label="Billing"><h1 tabindex="-1">{{ title() }}</h1>
      <p role="status">{{ message() }}</p></section>
  }`,
})
export class BillingCompositionRoot {
  private readonly context = inject(BILLING_CONTEXT);
  readonly route = signal(this.context.route);
  readonly isInvoiceList = computed(() => this.route().localPath === '/');
  readonly navigationMessage = signal('');
  readonly title = computed(() => this.route().localPath === '/'
    ? 'Facturación' : 'Página no encontrada');
  readonly message = computed(() => this.route().localPath === '/'
    ? 'La integración de Billing no está disponible.'
    : 'La ruta solicitada no está disponible en Billing.');
  async openInvoice(id: string): Promise<void> {
    if (this.context.signal.aborted) return;
    this.navigationMessage.set('');
    try {
      const result = await this.context.navigation.request({
        path: `${this.route().basePath}/invoices/${encodeURIComponent(id)}`,
      });
      if (!this.context.signal.aborted && result.status !== 'applied') {
        this.navigationMessage.set('La navegación no se completó.');
      }
    } catch {
      if (this.context.signal.aborted) return;
      this.navigationMessage.set('No se pudo abrir la factura.');
      this.context.reportFailure({ code: 'PORTAL_TASK_FAILED' });
    }
  }
}
