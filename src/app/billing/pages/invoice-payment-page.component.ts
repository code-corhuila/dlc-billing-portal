import { Component, DestroyRef, ElementRef, EventEmitter, Input, Output, ViewChild, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { InvoicePaymentSession } from '../model/invoice-payment-session';
import { copMoney } from '../model/cop-money';
import { formatCopMoney } from '../presentation/format-cop-money';

@Component({
  selector: 'dlc-invoice-payment-page', standalone: true, imports: [FormsModule],
  styleUrl: './invoice-payment-page.component.css',
  template: `<section aria-label="Registrar pago">
    <button type="button" (click)="back.emit()">Volver a facturas</button>
    <h1 #paymentHeading tabindex="-1">Registrar pago</h1>
    <p role="note">Datos ficticios, sin persistencia, pasarela, correo ni conexión con Billing API.</p>
    @if (invoice; as selected) {
      <article><h2>{{ selected.number }} · {{ selected.patientName }}</h2>
        <p>Total: COP {{ format(selected.amount) }} · Pagado: COP {{ format(selected.paidTotal) }}</p>
        <p><strong>Saldo: COP {{ format(selected.balance) }}</strong> · {{ statusLabels[selected.status] }}</p>
        @if (!canPay) { <p role="status">Tu sesión no permite registrar pagos en esta demostración.</p> }
        <form (ngSubmit)="submit()">
          <label>Valor del pago (COP)<input name="amount" type="text" inputmode="decimal"
            [(ngModel)]="amount" placeholder="100000.00" [disabled]="!canPay" /></label>
          <label>Método de demostración<input name="method" [(ngModel)]="method" maxlength="40" [disabled]="!canPay" /></label>
          <p>Usa un valor positivo con punto y dos decimales, sin superar el saldo.
            Los métodos autorizados de la clínica quedan pendientes de configuración.</p>
          <button type="submit" [disabled]="!canSubmit">Registrar pago dummy</button>
          <button type="button" (click)="discard()">Descartar formulario</button>
        </form>
        <p role="status">{{ feedback }}</p>
        <h2>Pagos registrados en esta sesión</h2>
        @if (history.length === 0) { <p>Sin pagos nuevos en esta sesión. El pagado inicial corresponde a los datos ficticios de la demo.</p> }
        <ul>@for (payment of history; track payment.key) {
          <li>COP {{ format(payment.amount) }} · {{ payment.method }}</li>
        }</ul>
      </article>
    } @else { <p role="status">La factura solicitada no está disponible.</p> }
  </section>`,
})
export class InvoicePaymentPageComponent {
  @ViewChild('paymentHeading') paymentHeading?: ElementRef<HTMLElement>;
  @Input() session!: InvoicePaymentSession;
  @Input() invoiceId = '';
  @Input() canPay = false;
  @Output() readonly back = new EventEmitter<void>();
  private readonly destroyRef = inject(DestroyRef);
  private intent?: { fingerprint: string; key: string };
  amount = ''; method = ''; feedback = '';
  readonly format = formatCopMoney;
  readonly statusLabels = { DRAFT: 'Borrador', ISSUED: 'Emitida', PARTIALLY_PAID: 'Pago parcial', PAID: 'Pagada', CANCELLED: 'Cancelada' };
  get invoice() { return this.session.detail(this.invoiceId); }
  get history() { return this.session.history(this.invoiceId); }
  get dirty(): boolean { return !!(this.amount || this.method); }
  get canSubmit(): boolean {
    const invoice = this.invoice;
    if (!invoice || !this.canPay || this.destroyRef.destroyed || !['ISSUED', 'PARTIALLY_PAID'].includes(invoice.status)) return false;
    if (!this.method.trim() || this.method.trim().length > 40) return false;
    try {
      const value = BigInt(copMoney(this.amount).replace('.', ''));
      return value > 0n && value <= BigInt(invoice.balance.replace('.', ''));
    } catch { return false; }
  }
  submit(): void {
    if (!this.canSubmit) return;
    try {
      const fingerprint = JSON.stringify([this.invoiceId, this.amount, this.method.trim()]);
      if (this.intent?.fingerprint !== fingerprint) this.intent = { fingerprint, key: crypto.randomUUID() };
      this.session.register(this.invoiceId, this.amount, this.method, this.intent.key);
      this.discard(); this.feedback = 'Pago de demostración registrado correctamente.';
      this.paymentHeading?.nativeElement.focus();
    } catch { this.feedback = 'No se pudo registrar el pago. Revisa el saldo y el formulario.'; }
  }
  discard(): void { this.amount = ''; this.method = ''; this.feedback = ''; this.intent = undefined; }
}
