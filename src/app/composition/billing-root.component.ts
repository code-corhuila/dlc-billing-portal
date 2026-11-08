import { InvoiceDraftPageComponent } from '../billing/pages/invoice-draft-page.component';
import { PendingPricesPageComponent } from '../billing/pages/pending-prices-page.component';
import { readPageMeta, type PageMeta } from '../billing/data/pagination';
import { Component, DestroyRef, InjectionToken, ViewEncapsulation, computed, inject, signal, viewChild } from '@angular/core';
import { PortalContext, PortalRoute } from '../shell-contract';
import { manualChargeSource } from '../billing/data/manual-charge-source';
import { ManualChargeFormComponent } from '../billing/pages/manual-charge-form.component';
import {
  recordManualChargeHttp,
  type RecordManualChargeRequest,
} from '../billing/data/manual-charge-http';
import { BillingListPageComponent } from '../billing/pages/billing-list-page.component';
import { INVOICE_LIST_SOURCE } from '../billing/data/invoice-list-port';
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
import { readPaymentHistoryHttp } from '../billing/data/payment-history-http';
import { InvoiceDetailPageComponent } from '../billing/pages/invoice-detail-page.component';
import {
  InvoiceDetailHttpPageComponent,
  type InvoiceIssuanceIntent,
  type PaymentHistoryIntent,
  type PaymentHistoryViewState,
} from '../billing/pages/invoice-detail-http-page.component';
import { PricingCatalogComponent } from '../billing/catalog/pages/pricing-catalog/pricing-catalog.component';
import { ExtraChargeRulesComponent } from '../billing/catalog/pages/extra-charge-rules/extra-charge-rules.component';
import {
  createProcedurePriceHttp,
  readProcedurePricesHttp,
  type CreateHttpProcedurePriceRequest,
  type HttpProcedurePrice,
} from '../billing/catalog/data/procedure-prices-http';
import {
  readExtraChargeRulesHttp,
  createExtraChargeRuleHttp,
  ExtraChargeRuleCreationError,
  type CreateHttpExtraChargeRuleRequest,
  type HttpExtraChargeRule,
} from '../billing/catalog/data/extra-charge-rules-http';
import { DemoInvoicePayments } from '../billing/data/demo-invoice-payments';
import { InvoicePaymentPageComponent } from '../billing/pages/invoice-payment-page.component';
import { InvoicePaymentHttpPageComponent } from '../billing/pages/invoice-payment-http-page.component';

export const BILLING_CONTEXT = new InjectionToken<PortalContext>('billing.context');
export const BILLING_INITIAL_MODE = new InjectionToken<'demo' | 'http'>('billing.initial-mode');

@Component({
  selector: 'dlc-billing-root',
  standalone: true,
  host: { class: 'dlc-billing' },
  encapsulation: ViewEncapsulation.None,
  styleUrl: './billing-theme.css',
  imports: [
    PendingPricesPageComponent,
    BillingListPageComponent,
    InvoiceDetailPageComponent,
    InvoiceDetailHttpPageComponent,
    PricingCatalogComponent,
    ExtraChargeRulesComponent,
    InvoicePaymentPageComponent,
    InvoicePaymentHttpPageComponent,
    ManualChargeFormComponent,
    InvoiceDraftPageComponent,
  ],
  template: `
  @if (invoiceListMode() === 'http') {
    <nav class="billing-navigation" aria-label="Navegación de facturación">
      <button type="button" [attr.aria-current]="isInvoiceList() ? 'page' : null" (click)="backToList()">Facturas</button>
      <button type="button" (click)="refreshCurrentRoute()">Actualizar</button>
      <button type="button" [attr.aria-current]="isProcedures() ? 'page' : null" (click)="navigateLocal('/procedures')">Precios</button>
      @if (canRecordPayments()) {
        <button type="button" [attr.aria-current]="isExtraChargeRules() ? 'page' : null" (click)="navigateLocal('/procedures/rules')">Reglas adicionales</button>
        <button type="button" [attr.aria-current]="isPendingPrices() ? 'page' : null" (click)="navigateLocal('/procedures/pending')">Pendientes de precio</button>
        <button class="billing-primary" type="button" [attr.aria-current]="isDraftRoute() ? 'page' : null" (click)="navigateLocal('/invoices/new')">Crear borrador</button>
      }
    </nav>
  }
  @if (isDraftRoute()) {
    <dlc-invoice-draft-page [context]="correctionContext" [canCreate]="canRecordPayments()"
      (created)="openInvoice($event)" />
  } @else if (isInvoiceList()) {
    <dlc-billing-list-page [composed]="true" [readOnly]="invoiceListMode() === 'http'"
      [canNavigateToInvoice]="canNavigateHttpInvoices()" [readStatus]="displayedReadStatus()" [invoices]="displayedInvoices()"
      [remoteMeta]="invoiceMeta()" (pageChange)="loadInvoices($event)"
      (openInvoice)="openInvoice($event)" />
  } @else if (isInvoiceDetail()) {
    @if (useHttpInvoiceDetail()) {
      <dlc-invoice-detail-http-page
        [readState]="displayedInvoiceDetailReadState()"
        [correctionContext]="correctionContext" [canCorrectPrices]="canManagePrices()"
        (priceCorrected)="loadInvoiceDetail($event)"
        [canIssueInvoices]="canIssueInvoices()"
        [issuing]="issuingInvoice()"
        [canDownloadPdfInvoices]="canDownloadPdfInvoices()"
        [downloadingPdf]="downloadingPdf()"
        [canRecordPayments]="canRecordPayments()"
        [canReadPaymentHistory]="canReadPaymentHistory()"
        [paymentHistory]="paymentHistoryState()"
        (readPaymentHistory)="requestPaymentHistory($event)"
        (issue)="requestInvoiceIssuance($event)"
        (downloadPdf)="requestInvoicePdfDownload($event)"
        (pay)="openPayment($event)"
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
    @if (useHttpPaymentForm()) {
      <dlc-invoice-payment-http-page
        [readState]="displayedPaymentInvoiceReadState()"
        [canRecordPayments]="canRecordPayments()"
        [recording]="recordingPayment()"
        (record)="requestPaymentRegistration($event)"
        (back)="backToList()" />
      @if (paymentRegistrationMessage()) {
        <p role="alert">{{ paymentRegistrationMessage() }}</p>
      }
    } @else {
      <dlc-invoice-payment-page [session]="payments"
        [invoiceId]="selectedInvoice()?.id ?? ''"
        [canPay]="canRecordPayments()" (back)="backToList()" />
    }
  } @else if (isManualChargeRoute()) {
    @if (manualChargeContext(); as source) {
      <dlc-manual-charge-form
        [patientId]="source.patientId"
        [appointmentId]="source.appointmentId"
        [procedureId]="source.procedureId"
        [sourceRecordId]="source.sourceRecordId"
        [canRecordManualCharges]="canSubmitManualCharge()"
        [recording]="recordingManualCharge()"
        (record)="requestManualChargeRegistration($event)" />
    } @else {
      <section aria-label="Cargo manual no disponible">
        <h1>Registro de cargo manual</h1>
        <p role="status">
          No hay una fuente clínica seleccionada.
        </p>
      </section>
    }
    @if (manualChargeMessage()) {
      <p role="alert">{{ manualChargeMessage() }}</p>
    }
 } @else if (isProcedures()) {
  <dlc-pricing-catalog
    [composed]="true"
    [canManagePrices]="canManagePrices()"
    [httpPrices]="procedurePricesReadState().prices"
    [httpReadStatus]="procedurePricesReadState().status"
    [creatingHttpPrice]="creatingPriceVersion()" [savedHttpPrice]="createdPrice()"
    (createPrice)="requestPriceVersionCreation($event)" />
  @if (priceVersionMessage()) {
    <p role="status">{{ priceVersionMessage() }}</p>
  }
  @if (priceMeta(); as meta) {
    <nav aria-label="Paginación del catálogo">
      <p>La búsqueda se aplica a esta página del catálogo.</p>
      <button type="button" [disabled]="meta.page <= 1 || creatingPriceVersion()" (click)="loadProcedurePrices(meta.page - 1)">Anterior</button>
      <span>Página {{ meta.page }} de {{ meta.totalPages || 1 }}</span>
      <button type="button" [disabled]="meta.page >= meta.totalPages || creatingPriceVersion()" (click)="loadProcedurePrices(meta.page + 1)">Siguiente</button>
    </nav>
  }
  } @else if (isExtraChargeRules()) {
    <dlc-extra-charge-rules
      [composed]="true"
      [httpRules]="extraChargeRulesReadState().rules"
      [httpReadStatus]="extraChargeRulesReadState().status"
      [canManageRules]="canManagePrices()" [creatingHttpRule]="creatingExtraChargeRule()"
      [savedHttpRule]="createdExtraChargeRule()" [creationMessage]="extraChargeRuleMessage()"
      (createRule)="requestExtraChargeRuleCreation($event)" />
    @if (extraChargeRuleMessage()) { <p role="status">{{ extraChargeRuleMessage() }}</p> }
  @if (ruleMeta(); as meta) {
    <nav aria-label="Paginación del catálogo">
      <p>La búsqueda se aplica a esta página del catálogo.</p>
      <button type="button" [disabled]="meta.page <= 1 || creatingExtraChargeRule()" (click)="loadExtraChargeRules(meta.page - 1)">Anterior</button>
      <span>Página {{ meta.page }} de {{ meta.totalPages || 1 }}</span>
      <button type="button" [disabled]="meta.page >= meta.totalPages || creatingExtraChargeRule()" (click)="loadExtraChargeRules(meta.page + 1)">Siguiente</button>
    </nav>
  }
  } @else if (isPendingPrices() && canRecordPayments()) {
    <dlc-pending-prices-page #pendingPrices [context]="correctionContext" />
  } @else {
    <section aria-label="Billing"><h1 tabindex="-1">{{ title() }}</h1>
      <p role="status">{{ message() }}</p></section>
  } <p role="status">{{ navigationMessage() }}</p>`,
})
export class BillingCompositionRoot {
  private readonly context = inject(BILLING_CONTEXT);
  readonly correctionContext=this.context;
  private securityGeneration = 0;
  private securityKey(): string {
    const snapshot = this.session();
    return JSON.stringify([snapshot?.state, snapshot?.user?.id, snapshot?.user?.roles,
      snapshot?.permissions]);
  }
  private captureAccess(): () => boolean {
    const generation = this.securityGeneration;
    const key = this.securityKey();
    return () => !this.isInactive() && generation === this.securityGeneration && key === this.securityKey();
  }
  private clearProtectedState(): void {
    ++this.securityGeneration;
    ++this.invoiceRequestGeneration;
    ++this.invoiceDetailRequestGeneration;
    ++this.procedurePricesRequestGeneration;
    ++this.extraChargeRulesRequestGeneration;
    ++this.paymentHistoryGeneration;
    this.pendingDetailId = undefined;
    this.pendingDetailLoad = undefined;
    this.loadedDetailId = undefined;
    this.issuanceAttempt = undefined;
    this.priceAttempt = undefined;
    this.extraRuleAttempt = undefined;
    this.invoiceReadState.set(createInvoiceReadState());
    this.invoiceDetailReadState.set(createInvoiceDetailReadState());
    this.invoiceMeta.set(null); this.priceMeta.set(null); this.ruleMeta.set(null);
    this.procedurePricesReadState.set({ status: 'idle', prices: [] });
    this.extraChargeRulesReadState.set({ status: 'idle', rules: [] });
    this.paymentHistoryState.set({ status: 'idle', data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } });
    this.createdPrice.set(null); this.createdExtraChargeRule.set(null);
    this.priceVersionMessage.set(''); this.extraChargeRuleMessage.set('');
    this.issuanceMessage.set(''); this.pdfDownloadMessage.set('');
    this.paymentRegistrationMessage.set(''); this.manualChargeMessage.set('');
    this.catalog()?.resetForSession();
    this.ruleCatalog()?.creationForm?.resetForSession();
    this.httpPaymentPage()?.resetForSession();
    this.manualChargePage()?.resetForSource();
    this.draftPage()?.resetForSession();
  }
  readonly invoiceMeta = signal<PageMeta | null>(null);
  readonly priceMeta = signal<PageMeta | null>(null);
  readonly ruleMeta = signal<PageMeta | null>(null);
  readonly createdPrice = signal<HttpProcedurePrice | null>(null);
  private priceAttempt?: { fingerprint: string; key: string };

  private readonly destroyRef = inject(DestroyRef);
  private navigationGeneration = 0;
  private invoiceRequestGeneration = 0;
  private invoiceDetailRequestGeneration = 0;
  private procedurePricesRequestGeneration = 0;
  private extraChargeRulesRequestGeneration = 0;
  private pendingInvoice?: string;
  private pendingDetailId?: string;
  private pendingDetailLoad?: Promise<void>;
  private loadedDetailId?: string;

  private issuanceAttempt?: InvoiceIssuanceIntent & {
    readonly idempotencyKey: string;
  };
  private readonly source = inject(INVOICE_LIST_SOURCE);

  readonly session = signal(this.context.session.getSnapshot());
  readonly invoiceReadState = signal(createInvoiceReadState());
  readonly invoiceDetailReadState = signal(createInvoiceDetailReadState());
  private paymentHistoryGeneration = 0;
  readonly paymentHistoryState = signal<PaymentHistoryViewState>({
    status: 'idle',
    data: [],
    meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
  });
  readonly procedurePricesReadState = signal<{
    status: 'idle' | 'loading' | 'success' | 'error';
    prices: HttpProcedurePrice[];
  }>({ status: 'idle', prices: [] });
  private extraRuleAttempt?: { actor: string; fingerprint: string; key: string };
  readonly creatingExtraChargeRule = signal(false);
  readonly createdExtraChargeRule = signal<HttpExtraChargeRule | null>(null);
  readonly extraChargeRuleMessage = signal('');
  readonly creatingPriceVersion = signal(false);
  readonly priceVersionMessage = signal('');
  readonly extraChargeRulesReadState = signal<{
    status: 'idle' | 'loading' | 'success' | 'error';
    rules: HttpExtraChargeRule[];
  }>({ status: 'idle', rules: [] });
  readonly invoiceListMode = signal<'demo' | 'http'>(
    inject(BILLING_INITIAL_MODE, { optional: true }) ?? 'demo');
  readonly issuingInvoice = signal(false);
  readonly issuanceMessage = signal('');
  readonly downloadingPdf = signal(false);
  readonly pdfDownloadMessage = signal('');

  readonly manualChargeContext = signal<Readonly<{
    patientId: string;
    appointmentId: string;
    procedureId: string;
    sourceRecordId: string;
  }> | null>(manualChargeSource(this.context.route));

  readonly recordingManualCharge = signal(false);
  readonly manualChargeMessage = signal('');
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
      if (this.isInactive()) return;
      const previous = this.securityKey();
      this.session.set(snapshot);
      if (previous !== this.securityKey()) this.clearProtectedState();
    }));
  }

  readonly route = signal(this.context.route);
  setRoute(route: PortalRoute): void {
    const next = manualChargeSource(route);
    const current = this.manualChargeContext();
    if (current?.patientId !== next?.patientId || current?.appointmentId !== next?.appointmentId
      || current?.procedureId !== next?.procedureId || current?.sourceRecordId !== next?.sourceRecordId) {
      this.manualChargePage()?.resetForSource();
      this.manualChargeContext.set(next);
      this.manualChargeMessage.set('');
    }
    this.route.set(route);
  }
  readonly payments = new DemoInvoicePayments(this.source);

  get invoices() { return this.payments.read(); }

  async loadInvoices(page?: number): Promise<void> {
    const accessCurrent = this.captureAccess();
    if (!accessCurrent()) return;

    const generation = ++this.invoiceRequestGeneration;

    await loadInvoiceReadState(
      this.context,
      this.invoiceReadState(),
      state => {
        if (accessCurrent() && generation === this.invoiceRequestGeneration) {
          this.invoiceReadState.set(state);
        }
      },
      page,
      meta => { if (accessCurrent() && generation === this.invoiceRequestGeneration) this.invoiceMeta.set(meta); },
    );
  }

  async loadProcedurePrices(page?: number): Promise<void> {
    const accessCurrent = this.captureAccess();
    if (!accessCurrent() || !this.isProcedures()) return;

    const generation = ++this.procedurePricesRequestGeneration;
    this.procedurePricesReadState.set({ status: 'loading', prices: [] });

    try {
      const result = await readProcedurePricesHttp(this.context, page);
      if (!accessCurrent() || !this.isProcedures()
        || generation !== this.procedurePricesRequestGeneration) return;
      this.priceMeta.set(readPageMeta(result.meta));
      this.procedurePricesReadState.set({ status: 'success', prices: result.data });
    } catch {
      if (!accessCurrent() || !this.isProcedures()
        || generation !== this.procedurePricesRequestGeneration) return;
      this.procedurePricesReadState.set({ status: 'error', prices: [] });
    }
  }

  async createPriceVersion(
    request: CreateHttpProcedurePriceRequest,
    idempotencyKey: string,
  ): Promise<void> {
    const accessCurrent = this.captureAccess();
    if (
      !accessCurrent()
      || !this.isProcedures()
      || !this.canManagePrices()
      || this.creatingPriceVersion()
    ) return;

    const initialRoute = this.route().localPath;
    const isCurrent = () => accessCurrent()
      && this.route().localPath === initialRoute
      && this.canManagePrices();

    this.priceVersionMessage.set('');
    this.creatingPriceVersion.set(true);

    try {
      const saved = await createProcedurePriceHttp(this.context, request, idempotencyKey);
      if (!isCurrent()) return;
      this.priceAttempt = undefined;
      this.createdPrice.set(saved);
      this.catalog()?.resetForSession();
      await this.loadProcedurePrices();
      if (isCurrent()) {
        this.priceVersionMessage.set(
          this.procedurePricesReadState().status === 'success'
            ? 'Versión de precio registrada correctamente.'
            : 'Precio registrado, pero no se pudo actualizar el catálogo.',
        );
      }
    } catch {
      if (isCurrent()) {
        this.priceVersionMessage.set(
          'No se pudo registrar la versión de precio. Revise los datos e inténtelo nuevamente.',
        );
        this.context.reportFailure?.({ code: 'PORTAL_TASK_FAILED' });
      }
    } finally {
      if (!this.isInactive()) this.creatingPriceVersion.set(false);
    }
  }

  requestPriceVersionCreation(request: CreateHttpProcedurePriceRequest): void {
    if (
      this.isInactive()
      || !this.isProcedures()
      || !this.canManagePrices()
      || this.creatingPriceVersion()
    ) return;

    const fingerprint = JSON.stringify([this.securityKey(), request.procedureCode, request.name, request.basePrice, request.validFrom]);
    if (this.priceAttempt?.fingerprint !== fingerprint) this.priceAttempt = { fingerprint, key: crypto.randomUUID() };
    this.createdPrice.set(null);
    void this.createPriceVersion(request, this.priceAttempt.key);
  }

  async requestExtraChargeRuleCreation(request: CreateHttpExtraChargeRuleRequest): Promise<void> {
    const accessCurrent = this.captureAccess();
    const actor = this.session()?.user?.id;
    if (!actor || !accessCurrent() || !this.isExtraChargeRules()
      || !this.canManagePrices() || this.creatingExtraChargeRule()) return;
    const body: CreateHttpExtraChargeRuleRequest = {
      code: request.code, itemType: request.itemType, unitPrice: request.unitPrice,
      requiresApproval: request.requiresApproval, validFrom: request.validFrom,
    };
    const fingerprint = JSON.stringify(body);
    if (this.extraRuleAttempt?.actor !== actor || this.extraRuleAttempt.fingerprint !== fingerprint) {
      this.extraRuleAttempt = { actor, fingerprint, key: crypto.randomUUID() };
    }
    const attempt = this.extraRuleAttempt;
    const isCurrent = () => accessCurrent() && this.isExtraChargeRules()
      && this.canManagePrices() && this.session()?.user?.id === actor;
    this.extraChargeRuleMessage.set('');
    this.createdExtraChargeRule.set(null);
    this.creatingExtraChargeRule.set(true);
    try {
      const rule = await createExtraChargeRuleHttp(this.context, body, attempt.key);
      if (!isCurrent()) return;
      this.extraRuleAttempt = undefined;
      this.createdExtraChargeRule.set(rule);
      await this.loadExtraChargeRules();
      if (isCurrent()) {
        this.extraChargeRuleMessage.set(this.extraChargeRulesReadState().status === 'success'
          ? 'Versión de regla registrada correctamente.'
          : 'Regla registrada, pero no se pudo actualizar el catálogo.');
      }
    } catch (error) {
      if (isCurrent()) {
        this.extraChargeRuleMessage.set(error instanceof ExtraChargeRuleCreationError && error.status === 409
          ? 'No se pudo registrar la regla por un conflicto. Revise su código y fecha de vigencia.'
          : 'No se pudo confirmar el registro. Reintente con los mismos datos.');
        this.context.reportFailure?.({ code: 'PORTAL_TASK_FAILED' });
      }
    } finally {
      if (!this.isInactive()) this.creatingExtraChargeRule.set(false);
    }
  }

  async loadExtraChargeRules(page?: number): Promise<void> {
    const accessCurrent = this.captureAccess();
    const actor = this.session()?.user?.id;
    const canRead = () => this.session()?.state === 'authenticated'
      && this.session()?.user?.id === actor
      && this.session()?.user?.roles.some(role => ['ADMINISTRATOR', 'SECRETARY_ASSISTANT'].includes(role)) === true;
    if (!accessCurrent() || !this.isExtraChargeRules() || !canRead()) return;
    const generation = ++this.extraChargeRulesRequestGeneration;
    const isCurrent = () => accessCurrent() && this.isExtraChargeRules() && canRead()
      && generation === this.extraChargeRulesRequestGeneration;
    this.extraChargeRulesReadState.set({ status: 'loading', rules: [] });
    try {
      const result = await readExtraChargeRulesHttp(this.context, page);
      if (isCurrent()) {
        this.ruleMeta.set(readPageMeta(result.meta));
        this.extraChargeRulesReadState.set({ status: 'success', rules: result.data });
      }
    } catch {
      if (isCurrent()) this.extraChargeRulesReadState.set({ status: 'error', rules: [] });
    }
  }

  async requestPaymentHistory(intent: PaymentHistoryIntent): Promise<void> {
    const accessCurrent = this.captureAccess();
    const invoice = this.displayedInvoiceDetailReadState().invoice;
    if (
      !accessCurrent() || !this.canReadPaymentHistory()
      || !invoice || invoice.id !== intent.invoiceId
      || this.invoiceId() !== intent.invoiceId
      || this.paymentHistoryState().status === 'loading'
    ) return;

    const generation = ++this.paymentHistoryGeneration;
    const empty = { page: intent.page, limit: 20, total: 0, totalPages: 0 };
    this.paymentHistoryState.set({
      status: 'loading', invoiceId: intent.invoiceId, data: [], meta: empty,
    });

    const isCurrent = () => accessCurrent()
      && this.canReadPaymentHistory()
      && this.invoiceId() === intent.invoiceId
      && generation === this.paymentHistoryGeneration;

    try {
      const result = await readPaymentHistoryHttp(
        this.context, intent.invoiceId, intent.page, 20,
      );
      if (isCurrent()) {
        this.paymentHistoryState.set({
          status: 'success', invoiceId: intent.invoiceId,
          data: result.data, meta: result.meta,
        });
      }
    } catch {
      if (isCurrent()) {
        this.paymentHistoryState.set({
          status: 'error', invoiceId: intent.invoiceId,
          data: [], meta: empty,
        });
      }
    }
  }
  async loadInvoiceDetail(invoiceId: string): Promise<void> {
    const accessCurrent = this.captureAccess();
    if (!accessCurrent()) return;

    const generation = ++this.invoiceDetailRequestGeneration;

    await loadInvoiceDetailReadState(
      this.context,
      invoiceId,
      this.invoiceDetailReadState(),
      state => {
        if (accessCurrent() && generation === this.invoiceDetailRequestGeneration) {
          this.invoiceDetailReadState.set(state);
        }
      },
    );
  }

  async syncInvoiceRoute(): Promise<void> {
    const accessCurrent = this.captureAccess();
    if (!accessCurrent() || this.invoiceListMode() !== 'http') return;

    const id = this.invoiceId();
    if (!id || (!this.isInvoiceDetail() && !this.isPaymentRoute())) return;

    if (this.pendingDetailId === id && this.pendingDetailLoad) {
      return this.pendingDetailLoad;
    }

    if (this.loadedDetailId === id
      && this.invoiceDetailReadState().status === 'success'
      && this.invoiceDetailReadState().invoice?.id === id) {
      return;
    }

    this.pendingDetailId = id;

    const pending = this.loadInvoiceDetail(id).then(() => {
      if (!accessCurrent()) return;

      const state = this.invoiceDetailReadState();
      if (this.invoiceId() === id
        && state.status === 'success'
        && state.invoice?.id === id) {
        this.loadedDetailId = id;
      }
    });

    this.pendingDetailLoad = pending;
    try {
      await pending;
    } finally {
      if (this.pendingDetailId === id && this.pendingDetailLoad === pending) {
        this.pendingDetailId = undefined;
        this.pendingDetailLoad = undefined;
      }
    }
  }

  readonly canRecordManualCharges = computed(() =>
    this.session()?.state === 'authenticated'
    && this.session()?.user?.roles.some(role =>
      ['ADMINISTRATOR', 'DENTIST'].includes(role)
    ) === true);

  readonly isManualChargeRoute = computed(() =>
    this.invoiceListMode() === 'http'
    && this.route().localPath === '/manual-charges/new');

  readonly canSubmitManualCharge = computed(() =>
    this.isManualChargeRoute()
    && this.canRecordManualCharges()
    && this.manualChargeContext() !== null
    && !this.recordingManualCharge());

  readonly canReadPaymentHistory = computed(() => this.useHttpInvoiceDetail()
    && this.session()?.state === 'authenticated'
    && this.session()?.user?.roles.some(role =>
      ['ADMINISTRATOR', 'DENTIST', 'SECRETARY_ASSISTANT'].includes(role)
    ) === true);

  readonly canRecordPayments = computed(() => this.session()?.state === 'authenticated'
    && this.session()?.user?.roles.some(role =>
      ['ADMINISTRATOR', 'SECRETARY_ASSISTANT'].includes(role)
    ) === true);

  readonly isInvoiceList = computed(() => this.route().localPath === '/');
  readonly canNavigateHttpInvoices = computed(() =>
    this.isInvoiceList() && this.invoiceListMode() === 'http');
  readonly isProcedures = computed(() => this.route().localPath === '/procedures');
  readonly isExtraChargeRules = computed(() => this.route().localPath === '/procedures/rules');
  readonly isPendingPrices = computed(() => this.route().localPath === '/procedures/pending');
  private readonly pendingPrices = viewChild<PendingPricesPageComponent>('pendingPrices');
  readonly isDraftRoute = computed(() => this.invoiceListMode() === 'http' && this.route().localPath === '/invoices/new');
  readonly draftPage = viewChild(InvoiceDraftPageComponent);
  readonly catalog = viewChild(PricingCatalogComponent);
  readonly ruleCatalog = viewChild(ExtraChargeRulesComponent);
  readonly paymentPage = viewChild(InvoicePaymentPageComponent);
  readonly httpPaymentPage = viewChild(InvoicePaymentHttpPageComponent);
  readonly manualChargePage = viewChild(ManualChargeFormComponent);

  readonly correctionDetail=viewChild(InvoiceDetailHttpPageComponent);

  canLeave(): boolean {
    const page = this.catalog();
    const catalogSafe = !page || (!page.formVisible() && !page.submitting());
    const demoSafe = !this.paymentPage()?.dirty;
    const httpSafe = !this.httpPaymentPage()?.dirty && !this.recordingPayment();
    const manualSafe =
      !this.manualChargePage()?.dirty && !this.recordingManualCharge();
    return !this.issuingInvoice() && !this.draftPage()?.dirty && !this.correctionDetail()?.correctionDirty && catalogSafe && demoSafe && httpSafe && manualSafe
      && !this.creatingPriceVersion() && !this.creatingExtraChargeRule()
      && !this.ruleCatalog()?.creationDirty;
  }

  private readonly invoiceId = computed(() => {
    const match = /^\/invoices\/([^/]+)(\/payment)?$/.exec(this.route().localPath);
    if (!match || match[1] === 'new') return undefined;
    try { return decodeURIComponent(match[1]); } catch { return undefined; }
  });

  readonly isPaymentRoute = computed(() =>
    this.invoiceId() !== undefined && this.route().localPath.endsWith('/payment'));

  readonly isInvoiceDetail = computed(() =>
    this.invoiceId() !== undefined && !this.isPaymentRoute());

  readonly useHttpInvoiceDetail = computed(() =>
    this.isInvoiceDetail() && this.invoiceListMode() === 'http');

  readonly useHttpPaymentForm = computed(() =>
    this.isPaymentRoute() && this.invoiceListMode() === 'http');

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

  readonly displayedPaymentInvoiceReadState = computed(() => {
    if (!this.useHttpPaymentForm()) {
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

  async registerManualCharge(request: RecordManualChargeRequest): Promise<void> {
    const accessCurrent = this.captureAccess();
    const source = this.manualChargeContext();

    if (
      !accessCurrent()
      || this.recordingManualCharge()
      || !this.canRecordManualCharges()
      || !source
      || source.patientId !== request.patientId
      || source.appointmentId !== request.appointmentId
      || source.procedureId !== request.procedureId
      || source.sourceRecordId !== request.sourceRecordId
    ) {
      return;
    }

    const initialSource = source;
    const initialRoute = this.route().localPath;

    const isCurrent = () =>
      accessCurrent()
      && this.canRecordManualCharges()
      && this.manualChargeContext() === initialSource
      && this.route().localPath === initialRoute;

    this.manualChargeMessage.set('');
    this.recordingManualCharge.set(true);

    try {
      await recordManualChargeHttp(this.context, request);

      if (isCurrent()) {
        this.manualChargePage()?.resetForSource();
        this.manualChargeMessage.set('Cargo manual registrado correctamente.');
      }
    } catch {
      if (isCurrent()) {
        this.manualChargeMessage.set(
          'No se pudo registrar el cargo manual. Revise los datos e inténtelo nuevamente.',
        );
        this.context.reportFailure({ code: 'PORTAL_TASK_FAILED' });
      }
    } finally {
      if (!this.isInactive()) {
        this.recordingManualCharge.set(false);
      }
    }
  }

  requestManualChargeRegistration(request: RecordManualChargeRequest): void {
    void this.registerManualCharge(request);
  }

  async registerPayment(request: RecordPaymentRequest): Promise<void> {
    const accessCurrent = this.captureAccess();
    if (
      !accessCurrent()
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
      accessCurrent()
      && this.canRecordPayments()
      && this.route().localPath === initialRoute
      && this.invoiceId() === request.invoiceId;

    this.paymentRegistrationMessage.set('');
    this.recordingPayment.set(true);

    try {
      await recordPaymentHttp(this.context, request);

      if (!isCurrent()) return;

      this.httpPaymentPage()?.resetForSession();
      await this.loadInvoiceDetail(request.invoiceId);

      if (!isCurrent()) return;

      const refreshed = this.invoiceDetailReadState();
      const updated = refreshed.status === 'success'
        && refreshed.invoice?.id === request.invoiceId
        && refreshed.invoice.version > request.expectedVersion;

      this.paymentRegistrationMessage.set(
        updated
          ? 'Pago registrado. Saldo actualizado correctamente.'
          : 'Pago registrado, pero no se pudo actualizar el detalle de la factura.',
      );
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

  requestPaymentRegistration(request: RecordPaymentRequest): void {
    void this.registerPayment(request);
  }

  async downloadInvoicePdf(invoiceId: string): Promise<void> {
    const accessCurrent = this.captureAccess();
    if (
      !accessCurrent()
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
      || !['ISSUED', 'PARTIALLY_PAID', 'PAID'].includes(invoice.status)
      || invoice.id !== invoiceId
      || invoice.id !== this.invoiceId()
    ) {
      return;
    }

    const initialRoute = this.route().localPath;
    const initialReadState = this.invoiceDetailReadState();

    const isCurrent = () =>
      accessCurrent()
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
    const accessCurrent = this.captureAccess();
    if (
      !accessCurrent()
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
      accessCurrent()
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

    const request = { ...intent, idempotencyKey };
    this.issuanceAttempt = request;
    void this.issueInvoice(request);
  }

  readonly navigationMessage = signal('');
  readonly title = computed(() => this.route().localPath === '/'
    ? 'Facturación' : 'Página no encontrada');
  readonly message = computed(() => this.route().localPath === '/'
    ? 'La integración de Billing no está disponible.'
    : 'La ruta solicitada no está disponible en Billing.');

  async refreshCurrentRoute(): Promise<void> {
    if (this.isInvoiceList()) await this.loadInvoices(this.invoiceMeta()?.page);
    else if (this.isProcedures()) await this.loadProcedurePrices(this.priceMeta()?.page);
    else if (this.isExtraChargeRules()) await this.loadExtraChargeRules(this.ruleMeta()?.page);
    else if (this.isPendingPrices()) await this.pendingPrices()?.load(this.pendingPrices()?.meta?.page ?? 1);
    else if (this.invoiceId()) await this.loadInvoiceDetail(this.invoiceId()!);
  }

  async navigateLocal(path: string): Promise<void> {
    await this.navigate(`${this.route().basePath}${path}`);
  }

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

