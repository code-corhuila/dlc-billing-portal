import { CommonModule } from '@angular/common';
import {
  Component,
  DestroyRef,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { copMoney, type CopMoney } from '../../../model/cop-money';
import { formatCopMoney } from '../../../presentation/format-cop-money';
import type {
  CreateHttpProcedurePriceRequest,
  HttpProcedurePrice,
} from '../../data/procedure-prices-http';
import {
  type CreateProcedurePriceRequest,
  type ProcedurePrice,
  type ProcedurePriceStatus,
} from '../../model/procedure-price.model';
import {
  PricingCatalogService,
  localIsoDate,
} from '../../services/pricing-catalog.service';

export type CatalogReadStatus = 'idle' | 'loading' | 'success' | 'error';

@Component({
  selector: 'dlc-pricing-catalog',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './pricing-catalog.component.html',
  styleUrl: './pricing-catalog.component.css',
})
export class PricingCatalogComponent {
  @ViewChild('priceDialog') priceDialog?: ElementRef<HTMLDialogElement>;
  @ViewChild('newPriceButton') newPriceButton?: ElementRef<HTMLButtonElement>;

  @Input() composed = false;
  @Input() canManagePrices = true;
  @Input() httpPrices: HttpProcedurePrice[] = [];
  @Input() httpReadStatus: CatalogReadStatus = 'idle';
  @Input() creatingHttpPrice = false;

  @Output() readonly createPrice =
    new EventEmitter<CreateHttpProcedurePriceRequest>();

  editing = false;
  today = localIsoDate();

  private readonly pricingCatalogService = inject(PricingCatalogService);
  private readonly destroyRef = inject(DestroyRef);
  private pendingTimer?: ReturnType<typeof setTimeout>;

  readonly prices = this.pricingCatalogService.demoPrices;
  readonly formVisible = signal(false);
  readonly submitting = signal(false);
  readonly successMessage = signal('');
  readonly errorMessage = signal('');

  searchTerm = '';
  onlyActive = true;

  form: CreateProcedurePriceRequest = this.createEmptyForm();

  constructor() {
    this.destroyRef.onDestroy(() => clearTimeout(this.pendingTimer));
  }

  get displayedPrices(): HttpProcedurePrice[] {
    if (!this.composed || this.httpReadStatus !== 'success') {
      return [];
    }

    const term = this.searchTerm.trim().toLowerCase();

    return this.httpPrices.filter(price => {
      if (this.onlyActive && price.status !== 'ACTIVE') return false;

      return !term
        || price.name.toLowerCase().includes(term)
        || price.procedureCode.toLowerCase().includes(term);
    });
  }

  get filteredPrices(): ProcedurePrice[] {
    if (this.composed) return [];

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
    return {
      CURRENT: 'Vigente',
      SCHEDULED: 'Programado',
      HISTORICAL: 'Histórico',
    }[this.statusOf(price)];
  }

  canVersion(price: ProcedurePrice): boolean {
    return !this.composed
      && this.canManagePrices
      && this.pricingCatalogService.latestVersion(
        this.prices(),
        price.procedureCode,
      )?.id === price.id;
  }

  get duplicateCode(): boolean {
    if (this.editing || !this.form.procedureCode.trim()) {
      return false;
    }

    if (this.composed) {
      return this.httpPrices.some(
        price => price.procedureCode.toLowerCase()
          === this.form.procedureCode.trim().toLowerCase(),
      );
    }

    return this.pricingCatalogService.hasProcedure(
      this.prices(),
      this.form.procedureCode,
    );
  }

  get minValidFrom(): string {
    if (this.composed) {
      if (!this.editing) return '';

      const dates = this.httpPrices
        .filter(price => price.procedureCode === this.form.procedureCode)
        .map(price => price.validFrom?.slice(0, 10))
        .filter((date): date is string => !!date);

      return dates.sort().at(-1) ?? '';
    }

    return this.editing
      ? this.pricingCatalogService.minVersionDate(
        this.prices(),
        this.form.procedureCode,
      )
      : '';
  }

  get validFromTooEarly(): boolean {
    return this.form.validFrom.length > 0
      && this.form.validFrom < this.minValidFrom;
  }

  openForm(): void {
    if (
      !this.canManagePrices
      || this.submitting()
      || this.creatingHttpPrice
      || this.destroyRef.destroyed
    ) return;

    this.clearMessages();
    this.resetForm();
    this.formVisible.set(true);
    this.editing = false;
    this.priceDialog?.nativeElement.showModal();
  }

  openForPrice(price: ProcedurePrice): void {
    if (
      this.composed
      || !this.canVersion(price)
      || this.submitting()
      || this.destroyRef.destroyed
    ) return;

    this.openForm();
    this.editing = true;
    this.form = {
      procedureCode: price.procedureCode,
      procedureName: price.procedureName,
      amount: price.amount,
      validFrom: '',
    };
  }

  closeForm(): void {
    if (this.submitting() || this.creatingHttpPrice) return;

    this.formVisible.set(false);
    this.priceDialog?.nativeElement.close();
  }

  submitPrice(): void {
    if (
      !this.canManagePrices
      || this.destroyRef.destroyed
      || this.submitting()
      || this.creatingHttpPrice
      || !this.isFormValid()
    ) return;

    if (this.composed) {
      if (!this.formVisible()) return;

      const request: CreateHttpProcedurePriceRequest = {
        procedureCode: this.form.procedureCode.trim(),
        name: this.form.procedureName.trim(),
        basePrice: copMoney(this.form.amount),
        validFrom: `${this.form.validFrom}T00:00:00Z`,
      };

      this.createPrice.emit(request);
      return;
    }

    this.startSubmitting();
    const request = { ...this.form };

    this.pendingTimer = setTimeout(() => {
      if (this.composed || this.destroyRef.destroyed) return;

      if (!this.canManagePrices) {
        this.submitting.set(false);
        return;
      }

      const editing = this.editing;
      const updatedPrices = editing
        ? this.pricingCatalogService.createNewVersion(
          this.prices(),
          request,
        )
        : this.pricingCatalogService.createProcedure(
          this.prices(),
          request,
        );

      this.prices.set(updatedPrices);
      this.finishSubmitting(editing);
    }, 900);
  }

  simulateError(): void {
    if (this.composed) return;

    this.successMessage.set('');
    this.prices.set([]);
    this.errorMessage.set(
      'Error simulado al consultar los precios de Billing.',
    );
  }

  simulateEmpty(): void {
    if (this.composed) return;

    this.clearMessages();
    this.prices.set([]);
  }

  restoreFixtures(): void {
    if (this.composed) return;

    this.clearMessages();
    this.prices.set(this.pricingCatalogService.getFixtures());
  }

  formatMoney(amount: CopMoney): string {
    return `COP ${formatCopMoney(amount)}`;
  }

  get validAmount(): boolean {
    try {
      return BigInt(copMoney(this.form.amount).replace('.', '')) > 0n;
    } catch {
      return false;
    }
  }

  private isFormValid(): boolean {
    return (
      this.form.procedureCode.trim().length > 0
      && this.form.procedureName.trim().length > 0
      && this.validAmount
      && /^\d{4}-\d{2}-\d{2}$/.test(this.form.validFrom)
      && Number.isFinite(Date.parse(`${this.form.validFrom}T00:00:00Z`))
      && !this.duplicateCode
      && !this.validFromTooEarly
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

    if (button) {
      button.disabled = false;
      button.focus();
    }

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
