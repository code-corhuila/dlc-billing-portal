import { CommonModule } from '@angular/common';
import { Component, DestroyRef, Input, inject, signal } from '@angular/core';
import { copMoney, CopMoney } from '../../../model/cop-money';
import { formatCopMoney } from '../../../presentation/format-cop-money';
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
  @Input() composed = false;
  @Input() canManagePrices = true;
  private readonly pricingCatalogService =
    inject(PricingCatalogService);

  readonly prices = this.pricingCatalogService.demoPrices;
  private readonly destroyRef = inject(DestroyRef);
  private pendingTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    this.destroyRef.onDestroy(() => clearTimeout(this.pendingTimer));
  }

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
    if (!this.canManagePrices || this.submitting()) return;
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
    if (!this.canManagePrices || this.destroyRef.destroyed || this.submitting() || !this.isFormValid()) {
      return;
    }

    this.startSubmitting();
    const request = { ...this.form };

    this.pendingTimer = setTimeout(() => {
      if (this.destroyRef.destroyed) return;
      if (!this.canManagePrices) { this.submitting.set(false); return; }
      const updatedPrices =
        this.pricingCatalogService.createNewVersion(
          this.prices(),
          request,
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

  formatMoney(amount: CopMoney): string {
    return `COP ${formatCopMoney(amount)}`;
  }

  get validAmount(): boolean {
    try { return BigInt(copMoney(this.form.amount).replace('.', '')) > 0n; }
    catch { return false; }
  }

  private isFormValid(): boolean {
    return (
      this.form.procedureCode.trim().length > 0 &&
      this.form.procedureName.trim().length > 0 &&
      this.validAmount &&
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
      amount: '',
      validFrom: '',
    };
  }
}
