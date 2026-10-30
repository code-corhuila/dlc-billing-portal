import {
  Component, DestroyRef, EventEmitter, Input, Output, inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { RecordPaymentRequest } from '../data/payment-registration-http';
import {
  createInvoiceDetailReadState,
  type InvoiceDetailReadState,
} from '../data/invoice-detail-read-state';
import type { ReadInvoice } from '../data/invoice-read-adapter';
import { copMoney } from '../model/cop-money';
import { formatCopMoney } from '../presentation/format-cop-money';

@Component({
  selector: 'dlc-invoice-payment-http-page',
  standalone: true,
  imports: [FormsModule],
  template: `
    <section aria-label="Registrar pago">
      <button type="button" (click)="back.emit()">Volver a facturas</button>
      <h1 tabindex="-1">Registrar pago</h1>

      @if (selectedInvoice; as invoice) {
        <article>
          <h2>{{ invoice.invoiceNumber || invoice.id }}</h2>
          <p>Factura: {{ invoice.id }}</p>
          <p>Estado: {{ invoice.status }}</p>
          <p>Versión: {{ invoice.version }}</p>
          <p>Total: COP {{ format(invoice.total) }}</p>
          <p><strong>Saldo: COP {{ format(invoice.balance) }}</strong></p>

          @if (!canRecordPayments) {
            <p role="status">No tiene permisos para registrar pagos.</p>
          }

          <form (ngSubmit)="submit()">
            <label>
              Valor del pago (COP)
              <input name="amount" type="text" inputmode="decimal"
                [(ngModel)]="amount" placeholder="25000.00"
                [disabled]="!canRecordPayments || recording" />
            </label>

            <label>
              Método de pago
              <input name="method" type="text" maxlength="40"
                [(ngModel)]="method"
                [disabled]="!canRecordPayments || recording" />
            </label>

            <p>Ingrese un importe positivo con dos decimales,
              sin superar el saldo de la factura.</p>

            <button type="submit" [disabled]="!canSubmit">
              {{ recording ? 'Registrando pago...' : 'Registrar pago' }}
            </button>
            <button type="button" (click)="discard()" [disabled]="recording">
              Descartar formulario
            </button>
          </form>
        </article>
      } @else {
        <p role="status">{{ statusMessage }}</p>
      }
    </section>
  `,
})
export class InvoicePaymentHttpPageComponent {
  private readonly destroyRef = inject(DestroyRef);
  private intent?: { fingerprint: string; key: string };

  @Input() readState: InvoiceDetailReadState = createInvoiceDetailReadState();
  @Input() canRecordPayments = false;
  @Input() recording = false;

  @Output() readonly back = new EventEmitter<void>();
  @Output() readonly record = new EventEmitter<RecordPaymentRequest>();

  amount = '';
  method = '';
  readonly format = formatCopMoney;

  get selectedInvoice(): ReadInvoice | undefined {
    return this.readState.status === 'success'
      ? this.readState.invoice
      : undefined;
  }

  get dirty(): boolean {
    return !!(this.amount || this.method);
  }

  get canSubmit(): boolean {
    const invoice = this.selectedInvoice;

    if (
      !invoice
      || !this.canRecordPayments
      || this.recording
      || this.destroyRef.destroyed
      || !['ISSUED', 'PARTIALLY_PAID'].includes(invoice.status)
    ) {
      return false;
    }

    if (!this.method.trim() || this.method.trim().length > 40) {
      return false;
    }

    try {
      const amount = BigInt(copMoney(this.amount).replace('.', ''));
      const balance = BigInt(invoice.balance.replace('.', ''));

      return amount > 0n && amount <= balance;
    } catch {
      return false;
    }
  }

  submit(): void {
    if (!this.canSubmit) return;

    const invoice = this.selectedInvoice;
    if (!invoice) return;

    const amount = copMoney(this.amount);
    const method = this.method.trim();
    const fingerprint = JSON.stringify([
      invoice.id, invoice.version, amount, method,
    ]);

    if (this.intent?.fingerprint !== fingerprint) {
      this.intent = {
        fingerprint,
        key: crypto.randomUUID(),
      };
    }

    this.record.emit({
      invoiceId: invoice.id,
      amount,
      method,
      expectedVersion: invoice.version,
      idempotencyKey: this.intent.key,
    });
  }

  discard(): void {
    if (this.recording) return;
    this.amount = '';
    this.method = '';
    this.intent = undefined;
  }

  get statusMessage(): string {
    switch (this.readState.status) {
      case 'idle':
        return 'No se ha consultado una factura.';
      case 'loading':
        return 'Consultando factura...';
      case 'error':
        return 'No fue posible consultar la factura.';
      case 'cancelled':
        return 'La consulta de la factura fue cancelada.';
      case 'success':
        return 'La factura solicitada no está disponible.';
    }
  }
}
