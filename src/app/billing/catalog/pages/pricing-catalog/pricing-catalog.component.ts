import { CommonModule } from '@angular/common';
import { Component, DestroyRef, ElementRef, Input, ViewChild, inject, signal } from '@angular/core';
import { copMoney, CopMoney } from '../../../model/cop-money';
import { formatCopMoney } from '../../../presentation/format-cop-money';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import {
  CreateProcedurePriceRequest,
  ProcedurePrice,
  ProcedurePriceStatus,
} from '../../model/procedure-price.model';
import { PricingCatalogService, localIsoDate } from '../../services/pricing-catalog.service';

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
  @ViewChild('priceDialog') priceDialog?: ElementRef<HTMLDialogElement>;
  @ViewChild('newPriceButton') newPriceButton?: ElementRef<HTMLButtonElement>;
  // false: new procedure (version 1); true: new price version of an existing procedure.
  editing = false;
  today = localIsoDate();
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
  onlyActive = true;

  form: CreateProcedurePriceRequest =
    this.createEmptyForm();

  get filteredPrices(): ProcedurePrice[] {
    const prices = this.pricingCatalogService.filterPrices(
      this.prices(),
      this.searchTerm,
    );
    return this.onlyActive
      ? prices.filter(price => this.statusOf(price) !== 'HISTORICAL')
      : prices;
  }

  statusOf(price: ProcedurePrice): ProcedurePriceStatus {
    return this.pricingCatalogService.priceStatus(price, this.today);
  }

  statusLabel(price: ProcedurePrice): string {
    return { CURRENT: 'Vigente', SCHEDULED: 'Programado', HISTORICAL: 'Histórico' }[this.statusOf(price)];
  }

  /** Only the latest version of a procedure can be followed by a new one. */
  canVersion(price: ProcedurePrice): boolean {
    return this.canManagePrices &&
      this.pricingCatalogService.latestVersion(this.prices(), price.procedureCode)?.id === price.id;
  }

  get duplicateCode(): boolean {
    return !this.editing && this.form.procedureCode.trim().length > 0 &&
      this.pricingCatalogService.hasProcedure(this.prices(), this.form.procedureCode);
  }

  get minValidFrom(): string {
    return this.editing
      ? this.pricingCatalogService.minVersionDate(this.prices(), this.form.procedureCode)
      : '';
  }

  get validFromTooEarly(): boolean {
    return this.form.validFrom.length > 0 && this.form.validFrom < this.minValidFrom;
  }

  openForm(): void {
    if (!this.canManagePrices || this.submitting() || this.destroyRef.destroyed) return;
    this.clearMessages();
    this.resetForm();
    this.formVisible.set(true);
    this.editing = false;
    this.priceDialog?.nativeElement.showModal();
  }

  openForPrice(price: ProcedurePrice): void {
    if (!this.canVersion(price) || this.submitting() || this.destroyRef.destroyed) return;
    this.openForm();
    this.editing = true;
    this.form = { procedureCode: price.procedureCode, procedureName: price.procedureName, amount: price.amount, validFrom: '' };
  }

  closeForm(): void {
    if (this.submitting()) {
      return;
    }

    this.formVisible.set(false);
    this.priceDialog?.nativeElement.close();
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
      const editing = this.editing;
      const updatedPrices = editing
        ? this.pricingCatalogService.createNewVersion(this.prices(), request)
        : this.pricingCatalogService.createProcedure(this.prices(), request);

      this.prices.set(updatedPrices);

      this.finishSubmitting(editing);
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
      this.form.validFrom.length > 0 &&
      !this.duplicateCode &&
      !this.validFromTooEarly
    );
  }

  private startSubmitting(): void {
    this.submitting.set(true);
    this.clearMessages();
  }

  private finishSubmitting(editing: boolean): void {
    this.submitting.set(false);
    this.formVisible.set(false);
    this.priceDialog?.nativeElement.close();
    const button = this.newPriceButton?.nativeElement;
    // Apply the completed UI state before focusing; Angular renders disabled asynchronously.
    if (button) { button.disabled = false; button.focus(); }

    this.successMessage.set(editing
      ? 'Nueva versión de precio registrada correctamente en la demostración.'
      : 'Procedimiento registrado correctamente en la demostración.');

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
