import { Component, DestroyRef, InjectionToken, computed, inject, signal, viewChild } from '@angular/core';
import { PortalContext } from '../shell-contract';
import { BillingListPageComponent } from '../billing/pages/billing-list-page.component';
import { INVOICE_LIST_SOURCE } from '../billing/data/invoice-list-source';
import { InvoiceDetailPageComponent } from '../billing/pages/invoice-detail-page.component';
import { PricingCatalogComponent } from '../billing/catalog/pages/pricing-catalog/pricing-catalog.component';

export const BILLING_CONTEXT = new InjectionToken<PortalContext>('billing.context');

@Component({
  selector: 'dlc-billing-root',
  standalone: true,
  imports: [BillingListPageComponent, InvoiceDetailPageComponent, PricingCatalogComponent],
  template: `@if (isInvoiceList()) {
    <dlc-billing-list-page [composed]="true" [invoices]="invoices" (openInvoice)="openInvoice($event)" />
  } @else if (isInvoiceDetail()) {
    <dlc-invoice-detail-page [invoice]="selectedInvoice()" (back)="backToList()" />
  } @else if (isProcedures()) {
    <dlc-pricing-catalog [composed]="true" [canManagePrices]="canManagePrices()" />
  } @else {
    <section aria-label="Billing"><h1 tabindex="-1">{{ title() }}</h1>
      <p role="status">{{ message() }}</p></section>
  } <p role="status">{{ navigationMessage() }}</p>`,
})
export class BillingCompositionRoot {
  private readonly context = inject(BILLING_CONTEXT);
  private readonly destroyRef = inject(DestroyRef);
  private navigationGeneration = 0;
  private pendingInvoice?: string;
  private readonly source = inject(INVOICE_LIST_SOURCE);
  readonly session = signal(this.context.session.getSnapshot());
  readonly canManagePrices = computed(() => this.session()?.state === 'authenticated'
    && this.session()?.user?.roles.includes('ADMINISTRATOR') === true);
  constructor() {
    this.destroyRef.onDestroy(this.context.session.subscribe(snapshot => {
      if (!this.isInactive()) this.session.set(snapshot);
    }));
  }
  readonly route = signal(this.context.route);
  readonly invoices = this.source.read();
  readonly isInvoiceList = computed(() => this.route().localPath === '/');
  readonly isProcedures = computed(() => this.route().localPath === '/procedures');
  readonly catalog = viewChild(PricingCatalogComponent);
  canLeave(): boolean {
    const page = this.catalog();
    return !page || (!page.formVisible() && !page.submitting());
  }
  private readonly invoiceId = computed(() => {
    const match = /^\/invoices\/([^/]+)$/.exec(this.route().localPath);
    if (!match) return undefined;
    try { return decodeURIComponent(match[1]); } catch { return undefined; }
  });
  readonly isInvoiceDetail = computed(() => this.invoiceId() !== undefined);
  readonly selectedInvoice = computed(() => {
    const id = this.invoiceId();
    return id === undefined ? undefined : this.source.detail(id);
  });
  readonly navigationMessage = signal('');
  readonly title = computed(() => this.route().localPath === '/'
    ? 'Facturación' : 'Página no encontrada');
  readonly message = computed(() => this.route().localPath === '/'
    ? 'La integración de Billing no está disponible.'
    : 'La ruta solicitada no está disponible en Billing.');
  async openInvoice(id: string): Promise<void> {
    await this.navigate(`${this.route().basePath}/invoices/${encodeURIComponent(id)}`);
  }
  async backToList(): Promise<void> {
    await this.navigate(this.route().basePath);
  }
  private async navigate(path: string): Promise<void> {
    if (this.isInactive() || this.pendingInvoice === path) return;
    this.pendingInvoice = path;
    const generation = ++this.navigationGeneration;
    this.navigationMessage.set('');
    try {
      const result = await this.context.navigation.request({ path });
      if (!this.isInactive() && generation === this.navigationGeneration && result.status !== 'applied') {
        this.navigationMessage.set('La navegación no se completó.');
      }
    } catch {
      if (this.isInactive() || generation !== this.navigationGeneration) return;
      this.navigationMessage.set('No se pudo completar la navegación.');
      this.context.reportFailure({ code: 'PORTAL_TASK_FAILED' });
    } finally {
      if (!this.isInactive() && generation === this.navigationGeneration) this.pendingInvoice = undefined;
    }
  }
  private isInactive(): boolean {
    return this.context.signal.aborted || this.destroyRef.destroyed;
  }
}
