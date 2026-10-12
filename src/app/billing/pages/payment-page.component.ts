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
  templateUrl: './payment-page.component.html',
  styleUrl: './payment-page.component.css',
})

export class PaymentPageComponent {
  paymentAmount = 0;
  feedbackMessage = '';
  idempotencyKey = 'payment-003';
  isSubmitting = false;

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

  get canRegisterPayment(): boolean {
    return (
      !this.isSubmitting &&
      isValidPaymentAmount(
        this.paymentAmount,
        this.pendingBalance,
      )
    );
  }
updatePaymentAmount(value: string): void {
  this.paymentAmount = Number(value);
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

    this.processedKeys.push(
      this.idempotencyKey,
    );

    this.feedbackMessage =
      'Pago registrado correctamente.';
  }

  startPaymentRequest(): void {
    if (!this.canRegisterPayment) {
      return;
    }

    this.isSubmitting = true;
    this.feedbackMessage = '';

    setTimeout(() => {
      this.completePaymentRequest();
    }, 500);
  }

  completePaymentRequest(): void {
    if (!this.isSubmitting) {
      return;
    }

    this.isSubmitting = false;
    this.registerPayment();
  }
}