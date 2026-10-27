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
import {
  InvoiceIssuanceHttpError,
  issueInvoiceHttp,
} from '../billing/data/invoice-issuance-http';
import {
  downloadInvoicePdfHttp,
  InvoicePdfHttpError,
} from '../billing/data/invoice-pdf-http';
import { deliverInvoicePdf } from '../billing/data/invoice-pdf-browser-download';
import {
  recordPaymentHttp,
  PaymentRegistrationHttpError,
  type RecordPaymentRequest,
} from '../billing/data/payment-registration-http';
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
        [canDownloadPdfInvoices]="canDownloadPdfInvoices()"
        [downloadingPdf]="downloadingPdf()"
        (issue)="requestInvoiceIssuance($event)"
        (downloadPdf)="requestInvoicePdfDownload($event)"
        (back)="backToList()" />
      @if (issuanceMessage()) {
        <p role="alert">{{ issuanceMessage() }}</p>
      }
      @if (pdfDownloadMessage()) {
        <p role="alert">{{ pdfDownloadMessage() }}</p>
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
  readonly downloadingPdf = signal(false);
  readonly pdfDownloadMessage = signal('');
  readonly recordingPayment = signal(false);
  readonly paymentRegistrationMessage = signal('');

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

  readonly canDownloadPdfInvoices = computed(() =>
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

  async registerPayment(request: RecordPaymentRequest): Promise<void> {
    if (
      this.isInactive()
      || this.recordingPayment()
      || !this.canRecordPayments()
      || this.invoiceListMode() !== 'http'
      || !this.isPaymentRoute()
      || this.invoiceId() !== request.invoiceId
    ) {
      return;
    }

    const readState = this.invoiceDetailReadState();
    const invoice = readState.invoice;

    if (
      readState.status !== 'success'
      || !invoice
      || invoice.id !== request.invoiceId
      || invoice.version !== request.expectedVersion
      || !['ISSUED', 'PARTIALLY_PAID'].includes(invoice.status)
    ) {
      return;
    }

    const initialRoute = this.route().localPath;
    const isCurrent = () =>
      !this.isInactive()
      && this.canRecordPayments()
      && this.route().localPath === initialRoute
      && this.invoiceId() === request.invoiceId;

    this.paymentRegistrationMessage.set('');
    this.recordingPayment.set(true);

    try {
      await recordPaymentHttp(this.context, request);

      if (isCurrent()) {
        this.paymentRegistrationMessage.set(
          'Pago registrado. Actualice el detalle de la factura para consultar el saldo.',
        );
      }
    } catch (error: unknown) {
      if (isCurrent()) {
        const status = error instanceof PaymentRegistrationHttpError
          ? error.status
          : undefined;

        const message = status === 409
          ? 'No se pudo registrar el pago. Actualice la factura y revise su saldo.'
          : status === 403
            ? 'No tiene permisos para registrar este pago.'
            : status === 503
              ? 'El servicio de pagos no está disponible temporalmente.'
              : 'No se pudo registrar el pago. Revise los datos e inténtelo nuevamente.';

        this.paymentRegistrationMessage.set(message);
        this.context.reportFailure({ code: 'PORTAL_TASK_FAILED' });
      }
    } finally {
      if (!this.isInactive()) {
        this.recordingPayment.set(false);
      }
    }
  }

  async downloadInvoicePdf(invoiceId: string): Promise<void> {
    if (
      this.isInactive()
      || this.downloadingPdf()
      || !this.canDownloadPdfInvoices()
    ) {
      return;
    }

    const readState = this.displayedInvoiceDetailReadState();
    const invoice = readState.invoice;

    if (
      readState.status !== 'success'
      || !invoice
      || invoice.status !== 'ISSUED'
      || invoice.id !== invoiceId
      || invoice.id !== this.invoiceId()
    ) {
      return;
    }

    const initialRoute = this.route().localPath;
    const initialReadState = this.invoiceDetailReadState();

    const isCurrent = () =>
      !this.isInactive()
      && this.canDownloadPdfInvoices()
      && this.route().localPath === initialRoute
      && this.invoiceId() === invoiceId
      && this.invoiceDetailReadState() === initialReadState;

    this.pdfDownloadMessage.set('');
    this.downloadingPdf.set(true);

    try {
      const pdf = await downloadInvoicePdfHttp(this.context, invoiceId);

      if (isCurrent()) {
        deliverInvoicePdf(pdf, invoiceId);
      }
    } catch (error: unknown) {
      if (isCurrent()) {
        const status = error instanceof InvoicePdfHttpError
          ? error.status
          : undefined;

        const message = status === 403
          ? 'No tiene permisos para descargar esta factura.'
          : status === 401
            ? 'Su sesión no permite descargar esta factura.'
            : status === 404
              ? 'No se encontró el PDF de la factura.'
              : 'No se pudo descargar el PDF de la factura. Inténtelo nuevamente.';

        this.pdfDownloadMessage.set(message);
        this.context.reportFailure({ code: 'PORTAL_TASK_FAILED' });
      }
    } finally {
      if (!this.isInactive()) {
        this.downloadingPdf.set(false);
      }
    }
  }

  requestInvoicePdfDownload(invoiceId: string): void {
    void this.downloadInvoicePdf(invoiceId);
  }

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

    const initialRoute = this.route().localPath;
    const initialReadState = this.invoiceDetailReadState();

    const isCurrent = () =>
      !this.isInactive()
      && this.canIssueInvoices()
      && this.route().localPath === initialRoute
      && this.invoiceId() === request.invoiceId;

    this.issuanceMessage.set('');
    this.issuingInvoice.set(true);

    try {
      const issued = await issueInvoiceHttp(this.context, request);

      if (this.issuanceAttempt?.idempotencyKey === request.idempotencyKey) {
        this.issuanceAttempt = undefined;
      }

      const currentInvoice = this.invoiceDetailReadState().invoice;

      if (
        isCurrent()
        && issued.id === request.invoiceId
        && (
          this.invoiceDetailReadState() === initialReadState
          || (
            currentInvoice?.id === issued.id
            && currentInvoice.version <= issued.version
          )
        )
      ) {
        this.invoiceDetailReadState.set(invoiceDetailReadSuccess(issued));
      }
    } catch (error: unknown) {
      if (
        isCurrent()
        && this.invoiceDetailReadState() === initialReadState
      ) {
        const status = error instanceof InvoiceIssuanceHttpError
          ? error.status
          : undefined;

        const message = status === 409
          ? 'No se pudo emitir la factura. Existe un conflicto de versión. Actualice y revise la factura.'
          : status === 403
            ? 'No se pudo emitir la factura. No tiene permisos para realizar esta operación.'
            : status === 503
              ? 'No se pudo emitir la factura. El servicio no está disponible temporalmente.'
              : 'No se pudo emitir la factura. Verifique su estado e inténtelo nuevamente.';

        this.issuanceMessage.set(message);
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
