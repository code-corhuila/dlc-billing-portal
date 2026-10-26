import { Component, DestroyRef, InjectionToken, computed, inject, signal, viewChild } from '@angular/core';
import { PortalContext } from '../shell-contract';
import { BillingListPageComponent } from '../billing/pages/billing-list-page.component';
import { INVOICE_LIST_SOURCE } from '../billing/data/invoice-list-source';
import { loadInvoiceReadState } from '../billing/data/invoice-read-flow';
import { createInvoiceReadState } from '../billing/data/invoice-read-state';
import { loadInvoiceDetailReadState } from '../billing/data/invoice-detail-read-flow';
import {
  createInvoiceDetailReadState,
  invoiceDetailReadSuccess,
} from '../billing/data/invoice-detail-read-state';
import { issueInvoiceHttp } from '../billing/data/invoice-issuance-http';
import { InvoiceDetailPageComponent } from '../billing/pages/invoice-detail-page.component';
import {
  InvoiceDetailHttpPageComponent,
  type InvoiceIssuanceIntent,
} from '../billing/pages/invoice-detail-http-page.component';
import { PricingCatalogComponent } from '../billing/catalog/pages/pricing-catalog/pricing-catalog.component';
import { DemoInvoicePayments } from '../billing/data/demo-invoice-payments';
import { InvoicePaymentPageComponent } from '../billing/pages/invoice-payment-page.component';

export const BILLING_CONTEXT = new InjectionToken<PortalContext>('billing.context');

@Component({
  selector: 'dlc-billing-root',
  standalone: true,
  imports: [
    BillingListPageComponent,
    InvoiceDetailPageComponent,
    InvoiceDetailHttpPageComponent,
    PricingCatalogComponent,
    InvoicePaymentPageComponent,
  ],
  template: `@if (isInvoiceList()) {
    <dlc-billing-list-page [composed]="true" [readOnly]="invoiceListMode() === 'http'"
      [readStatus]="displayedReadStatus()" [invoices]="displayedInvoices()"
      (openInvoice)="openInvoice($event)" />
  } @else if (isInvoiceDetail()) {
    @if (useHttpInvoiceDetail()) {
      <dlc-invoice-detail-http-page
        [readState]="displayedInvoiceDetailReadState()"
        [canIssueInvoices]="canIssueInvoices()"
        [issuing]="issuingInvoice()"
        (issue)="requestInvoiceIssuance($event)"
        (back)="backToList()" />
      @if (issuanceMessage()) {
        <p role="alert">{{ issuanceMessage() }}</p>
      }
    } @else {
      <dlc-invoice-detail-page [invoice]="selectedInvoice()" [canPay]="canRecordPayments()"
        (pay)="openPayment($event)" (back)="backToList()" />
    }
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
  private invoiceDetailRequestGeneration = 0;
  private pendingInvoice?: string;
  private issuanceAttempt?: InvoiceIssuanceIntent & {
    readonly idempotencyKey: string;
  };
  private readonly source = inject(INVOICE_LIST_SOURCE);

  readonly session = signal(this.context.session.getSnapshot());
  readonly invoiceReadState = signal(createInvoiceReadState());
  readonly invoiceDetailReadState = signal(createInvoiceDetailReadState());
  readonly invoiceListMode = signal<'demo' | 'http'>('demo');
  readonly issuingInvoice = signal(false);
  readonly issuanceMessage = signal('');

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

  async loadInvoiceDetail(invoiceId: string): Promise<void> {
    if (this.isInactive()) return;

    const generation = ++this.invoiceDetailRequestGeneration;

    await loadInvoiceDetailReadState(
      this.context,
      invoiceId,
      this.invoiceDetailReadState(),
      state => {
        if (!this.isInactive() && generation === this.invoiceDetailRequestGeneration) {
          this.invoiceDetailReadState.set(state);
        }
      },
    );
  }

  readonly canRecordPayments = computed(() => this.session()?.state === 'authenticated'
    && this.session()?.user?.roles.some(role =>
      ['ADMINISTRATOR', 'SECRETARY_ASSISTANT'].includes(role)
    ) === true);

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

  readonly isPaymentRoute = computed(() =>
    this.invoiceId() !== undefined && this.route().localPath.endsWith('/payment'));

  readonly isInvoiceDetail = computed(() =>
    this.invoiceId() !== undefined && !this.isPaymentRoute());

  readonly useHttpInvoiceDetail = computed(() =>
    this.isInvoiceDetail() && this.invoiceListMode() === 'http');

  readonly canIssueInvoices = computed(() =>
    this.useHttpInvoiceDetail()
    && this.session()?.state === 'authenticated'
    && this.session()?.user?.roles.some(role =>
      ['ADMINISTRATOR', 'SECRETARY_ASSISTANT'].includes(role)
    ) === true
  );

  readonly displayedInvoiceDetailReadState = computed(() => {
    if (!this.useHttpInvoiceDetail()) {
      return createInvoiceDetailReadState();
    }

    const state = this.invoiceDetailReadState();
    const routeInvoiceId = this.invoiceId();

    if (state.invoice?.id !== undefined && state.invoice.id !== routeInvoiceId) {
      return createInvoiceDetailReadState();
    }

    return state;
  });

  readonly selectedInvoice = computed(() => {
    const id = this.invoiceId();
    return id === undefined ? undefined : this.payments.detail(id);
  });

  async issueInvoice(request: InvoiceIssuanceIntent & {
    readonly idempotencyKey: string;
  }): Promise<void> {
    if (
      this.isInactive()
      || this.issuingInvoice()
      || !this.canIssueInvoices()
    ) {
      return;
    }

    const readState = this.displayedInvoiceDetailReadState();
    const invoice = readState.invoice;

    if (
      readState.status !== 'success'
      || !invoice
      || invoice.status !== 'DRAFT'
      || invoice.id !== request.invoiceId
      || invoice.id !== this.invoiceId()
      || invoice.version !== request.expectedVersion
    ) {
      return;
    }

    this.issuanceMessage.set('');
    this.issuingInvoice.set(true);

    try {
      const issued = await issueInvoiceHttp(this.context, request);

      if (
        this.issuanceAttempt?.idempotencyKey === request.idempotencyKey
      ) {
        this.issuanceAttempt = undefined;
      }

      if (
        !this.isInactive()
        && this.useHttpInvoiceDetail()
        && this.invoiceId() === issued.id
      ) {
        this.invoiceDetailReadState.set(invoiceDetailReadSuccess(issued));
      }
    } catch {
      if (!this.isInactive()) {
        this.issuanceMessage.set(
          'No se pudo emitir la factura. Verifique su estado e inténtelo nuevamente.',
        );
        this.context.reportFailure({ code: 'PORTAL_TASK_FAILED' });
      }
    } finally {
      if (!this.isInactive()) {
        this.issuingInvoice.set(false);
      }
    }
  }

  requestInvoiceIssuance(intent: InvoiceIssuanceIntent): void {
    if (!this.canIssueInvoices() || this.issuingInvoice()) {
      return;
    }

    const previous = this.issuanceAttempt;

    const idempotencyKey =
      previous?.invoiceId === intent.invoiceId
      && previous.expectedVersion === intent.expectedVersion
        ? previous.idempotencyKey
        : crypto.randomUUID();

    const request = {
      ...intent,
      idempotencyKey,
    };

    this.issuanceAttempt = request;
    void this.issueInvoice(request);
  }

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
    if (this.canRecordPayments()) {
      await this.navigate(`${this.route().basePath}/invoices/${encodeURIComponent(id)}/payment`);
    }
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
      if (!this.isInactive() && generation === this.navigationGeneration) {
        this.pendingInvoice = undefined;
      }
    }
  }

  private isInactive(): boolean {
    return this.context.signal.aborted || this.destroyRef.destroyed;
  }
}
