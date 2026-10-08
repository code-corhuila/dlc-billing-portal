import { Component } from '@angular/core';

import {
  calculateRemainingBalance,
  isDuplicatePayment,
  isValidPaymentAmount,
  PaymentStatus,
  resolvePaymentStatus,
} from '../domain/payment-registration';

interface PaymentInvoice {
  number: string;
  total: number;
  paid: number;
  status: PaymentStatus;
}

@Component({
  selector: 'dlc-payment-page',
  standalone: true,
  template: `
    <main>
      <header>
        <p>Billing</p>
        <h1>Registro de pago</h1>
        <p>
          Registra un pago sobre una factura.
        </p>
      </header>

      <section>
        <h2>{{ invoice.number }}</h2>

        <p>
          <strong>Total:</strong>
          COP {{ invoice.total.toLocaleString('es-CO') }}
        </p>

        <p>
          <strong>Pagado:</strong>
          COP {{ invoice.paid.toLocaleString('es-CO') }}
        </p>

        <p>
          <strong>Saldo pendiente:</strong>
          COP {{ pendingBalance.toLocaleString('es-CO') }}
        </p>

        <p>
          <strong>Estado:</strong>
          {{ invoice.status }}
        </p>
      </section>

      <section>
        <label for="paymentAmount">
          Valor del pago
        </label>

        <input
          id="paymentAmount"
          type="number"
          min="0"
          [(value)]="paymentAmount"
        />

        <button
          type="button"
          (click)="registerPayment()"
        >
          Registrar pago
        </button>

        @if (feedbackMessage) {
          <p>
            {{ feedbackMessage }}
          </p>
        }
      </section>
    </main>
  `,
})
export class PaymentPageComponent {
  paymentAmount = 0;
  feedbackMessage = '';
  idempotencyKey = 'payment-003';

  readonly processedKeys = [
    'payment-001',
    'payment-002',
  ];

  invoice: PaymentInvoice = {
    number: 'INV-001',
    total: 130000,
    paid: 30000,
    status: 'PARTIAL',
  };

  get pendingBalance(): number {
    return this.invoice.total - this.invoice.paid;
  }

  registerPayment(): void {
    if (
      isDuplicatePayment(
        this.idempotencyKey,
        this.processedKeys,
      )
    ) {
      this.feedbackMessage =
        'Este pago ya fue procesado.';
      return;
    }

    if (
      !isValidPaymentAmount(
        this.paymentAmount,
        this.pendingBalance,
      )
    ) {
      this.feedbackMessage =
        'El valor del pago no es válido.';
      return;
    }

    const remainingBalance =
      calculateRemainingBalance(
        this.pendingBalance,
        this.paymentAmount,
      );

    this.invoice.paid += this.paymentAmount;
    this.invoice.status =
      resolvePaymentStatus(
        remainingBalance,
      );

    this.feedbackMessage =
      'Pago registrado correctamente.';
  }
}