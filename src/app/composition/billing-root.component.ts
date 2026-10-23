import { Component, DestroyRef, InjectionToken, computed, inject, signal, viewChild } from '@angular/core';
import { PortalContext } from '../shell-contract';
import { BillingListPageComponent } from '../billing/pages/billing-list-page.component';
import { INVOICE_LIST_SOURCE } from '../billing/data/invoice-list-source';
import { loadInvoiceReadState } from '../billing/data/invoice-read-flow';
import { createInvoiceReadState } from '../billing/data/invoice-read-state';
import { InvoiceDetailPageComponent } from '../billing/pages/invoice-detail-page.component';
import { PricingCatalogComponent } from '../billing/catalog/pages/pricing-catalog/pricing-catalog.component';
import { DemoInvoicePayments } from '../billing/data/demo-invoice-payments';
import { InvoicePaymentPageComponent } from '../billing/pages/invoice-payment-page.component';

export const BILLING_CONTEXT = new InjectionToken<PortalContext>('billing.context');

@Component({
  selector: 'dlc-billing-root',
  standalone: true,
  imports: [BillingListPageComponent, InvoiceDetailPageComponent, PricingCatalogComponent, InvoicePaymentPageComponent],
  template: `@if (isInvoiceList()) {
    <dlc-billing-list-page [composed]="true" [readOnly]="invoiceListMode() === 'http'"
      [readStatus]="displayedReadStatus()" [invoices]="displayedInvoices()"
      (openInvoice)="openInvoice($event)" />
  } @else if (isInvoiceDetail()) {
    <dlc-invoice-detail-page [invoice]="selectedInvoice()" [canPay]="canRecordPayments()"
      (pay)="openPayment($event)" (back)="backToList()" />
  } @else if (isPaymentRoute()) {
    <dlc-invoice-payment-page [session]="payments" [invoiceId]="selectedInvoice()?.id ?? ''"
      [canPay]="canRecordPayments()" (back)="backToList()" />
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
  private invoiceRequestGeneration = 0;
  private pendingInvoice?: string;
  private readonly source = inject(INVOICE_LIST_SOURCE);

  readonly session = signal(this.context.session.getSnapshot());
  readonly invoiceReadState = signal(createInvoiceReadState());
  readonly invoiceListMode = signal<'demo' | 'http'>('demo');

  readonly displayedInvoices = computed(() =>
    this.invoiceListMode() === 'http'
      ? this.invoiceReadState().invoices
      : this.invoices,
  );

  readonly displayedReadStatus = computed(() =>
    this.invoiceListMode() === 'http'
      ? this.invoiceReadState().status
      : 'idle',
  );

  readonly canManagePrices = computed(() => this.session()?.state === 'authenticated'
    && this.session()?.user?.roles.includes('ADMINISTRATOR') === true);

  constructor() {
    this.destroyRef.onDestroy(this.context.session.subscribe(snapshot => {
      if (!this.isInactive()) this.session.set(snapshot);
    }));
  }

  readonly route = signal(this.context.route);
  readonly payments = new DemoInvoicePayments(this.source);

  get invoices() { return this.payments.read(); }

  async loadInvoices(): Promise<void> {
    if (this.isInactive()) return;

    const generation = ++this.invoiceRequestGeneration;

    await loadInvoiceReadState(
      this.context,
      this.invoiceReadState(),
      state => {
        if (!this.isInactive() && generation === this.invoiceRequestGeneration) {
          this.invoiceReadState.set(state);
        }
      },
    );
  }

  readonly canRecordPayments = computed(() => this.session()?.state === 'authenticated'
    && this.session()?.user?.roles.some(role => ['ADMINISTRATOR', 'SECRETARY_ASSISTANT'].includes(role)) === true);
  readonly isInvoiceList = computed(() => this.route().localPath === '/');
  readonly isProcedures = computed(() => this.route().localPath === '/procedures');
  readonly catalog = viewChild(PricingCatalogComponent);
  readonly paymentPage = viewChild(InvoicePaymentPageComponent);

  canLeave(): boolean {
    const page = this.catalog();
    return (!page || (!page.formVisible() && !page.submitting())) && !this.paymentPage()?.dirty;
  }

  private readonly invoiceId = computed(() => {
    const match = /^\/invoices\/([^/]+)(\/payment)?$/.exec(this.route().localPath);
    if (!match) return undefined;
    try { return decodeURIComponent(match[1]); } catch { return undefined; }
  });

  readonly isPaymentRoute = computed(() => this.invoiceId() !== undefined && this.route().localPath.endsWith('/payment'));
  readonly isInvoiceDetail = computed(() => this.invoiceId() !== undefined && !this.isPaymentRoute());
  readonly selectedInvoice = computed(() => {
    const id = this.invoiceId();
    return id === undefined ? undefined : this.payments.detail(id);
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

  async openPayment(id: string): Promise<void> {
    if (this.canRecordPayments()) await this.navigate(`${this.route().basePath}/invoices/${encodeURIComponent(id)}/payment`);
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
