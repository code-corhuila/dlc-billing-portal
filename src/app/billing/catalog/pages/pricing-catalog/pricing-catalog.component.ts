import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import {
  CreateProcedurePriceRequest,
  ProcedurePrice,
} from '../../model/procedure-price.model';
import { PricingCatalogService } from '../../services/pricing-catalog.service';

@Component({
  selector: 'dlc-pricing-catalog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
  ],
  templateUrl: './pricing-catalog.component.html',
  styleUrl: './pricing-catalog.component.css',
})
export class PricingCatalogComponent {
  private readonly pricingCatalogService =
    inject(PricingCatalogService);

  readonly prices = signal<ProcedurePrice[]>(
    this.pricingCatalogService.getFixtures(),
  );

  readonly formVisible = signal(false);
  readonly submitting = signal(false);
  readonly successMessage = signal('');
  readonly errorMessage = signal('');

  searchTerm = '';

  form: CreateProcedurePriceRequest =
    this.createEmptyForm();

  get filteredPrices(): ProcedurePrice[] {
    return this.pricingCatalogService.filterPrices(
      this.prices(),
      this.searchTerm,
    );
  }

  openForm(): void {
    this.clearMessages();
    this.resetForm();
    this.formVisible.set(true);
  }

  closeForm(): void {
    if (this.submitting()) {
      return;
    }

    this.formVisible.set(false);
  }

  submitPrice(): void {
    if (!this.isFormValid()) {
      return;
    }

    this.startSubmitting();

    setTimeout(() => {
      const updatedPrices =
        this.pricingCatalogService.createNewVersion(
          this.prices(),
          this.form,
        );

      this.prices.set(updatedPrices);

      this.finishSubmitting();
    }, 900);
  }

  simulateError(): void {
    this.successMessage.set('');
    this.prices.set([]);

    this.errorMessage.set(
      'Error simulado al consultar los precios de Billing.',
    );
  }

  simulateEmpty(): void {
    this.clearMessages();
    this.prices.set([]);
  }

  restoreFixtures(): void {
    this.clearMessages();

    this.prices.set(
      this.pricingCatalogService.getFixtures(),
    );
  }

  formatMoney(amount: number): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(amount);
  }

  private isFormValid(): boolean {
    return (
      this.form.procedureCode.trim().length > 0 &&
      this.form.procedureName.trim().length > 0 &&
      this.form.amount > 0 &&
      this.form.validFrom.length > 0
    );
  }

  private startSubmitting(): void {
    this.submitting.set(true);
    this.clearMessages();
  }

  private finishSubmitting(): void {
    this.submitting.set(false);
    this.formVisible.set(false);

    this.successMessage.set(
      'Nueva versión de precio registrada correctamente en la demostración.',
    );

    this.resetForm();
  }

  private clearMessages(): void {
    this.successMessage.set('');
    this.errorMessage.set('');
  }

  private resetForm(): void {
    this.form = this.createEmptyForm();
  }

  private createEmptyForm(): CreateProcedurePriceRequest {
    return {
      procedureCode: '',
      procedureName: '',
      amount: 0,
      validFrom: '',
    };
  }
}