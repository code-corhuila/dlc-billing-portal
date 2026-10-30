import {
  Component, DestroyRef, EventEmitter, Input, Output, inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  type ManualChargeItemType,
  type RecordManualChargeRequest,
} from '../data/manual-charge-http';
import { copMoney } from '../model/cop-money';

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const quantityPattern =
  /^(?!0(?:\.0{1,4})?$)(?:0|[1-9][0-9]*)(?:\.[0-9]{1,4})?$/;

const itemTypes: readonly ManualChargeItemType[] = [
  'BASE_PROCEDURE',
  'ADDITIONAL_MATERIAL',
  'ADDITIONAL_PROCEDURE',
  'COMPLEXITY_ADJUSTMENT',
  'OTHER_AUTHORIZED_CHARGE',
];

@Component({
  selector: 'dlc-manual-charge-form',
  standalone: true,
  imports: [FormsModule],
  template: `
    <section aria-label="Registrar cargo manual">
      <h1 tabindex="-1">Registrar cargo manual</h1>

      @if (!canRecordManualCharges) {
        <p role="status">
          No tiene permisos para registrar cargos manuales.
        </p>
      }

      <form (ngSubmit)="submit()">
        <label>
          Tipo de cargo
          <select name="itemType" [(ngModel)]="itemType"
            [disabled]="!canRecordManualCharges || recording">
            <option value="BASE_PROCEDURE">Procedimiento base</option>
            <option value="ADDITIONAL_MATERIAL">Material adicional</option>
            <option value="ADDITIONAL_PROCEDURE">Procedimiento adicional</option>
            <option value="COMPLEXITY_ADJUSTMENT">Ajuste por complejidad</option>
            <option value="OTHER_AUTHORIZED_CHARGE">Otro cargo autorizado</option>
          </select>
        </label>

        <label>
          Concepto
          <input name="concept" type="text" maxlength="500"
            [(ngModel)]="concept"
            [disabled]="!canRecordManualCharges || recording" />
        </label>

        <label>
          Cantidad
          <input name="quantity" type="text" inputmode="decimal"
            [(ngModel)]="quantity" placeholder="1.0000"
            [disabled]="!canRecordManualCharges || recording" />
        </label>

        <label>
          Precio unitario (COP)
          <input name="unitPrice" type="text" inputmode="decimal"
            [(ngModel)]="unitPrice" placeholder="35000.50"
            [disabled]="!canRecordManualCharges || recording" />
        </label>

        <label>
          Justificación
          <textarea name="justification" maxlength="1000"
            [(ngModel)]="justification"
            [disabled]="!canRecordManualCharges || recording">
          </textarea>
        </label>

        <p>
          La cantidad y el precio deben ser positivos.
          El concepto y la justificación son obligatorios.
        </p>

        <button type="submit" [disabled]="!canSubmit">
          {{ recording ? 'Registrando cargo...' : 'Registrar cargo' }}
        </button>

        <button type="button" (click)="discard()" [disabled]="recording">
          Descartar formulario
        </button>
      </form>
    </section>
  `,
})
export class ManualChargeFormComponent {
  private readonly destroyRef = inject(DestroyRef);
  private intent?: { fingerprint: string; key: string };

  @Input() patientId = '';
  @Input() appointmentId = '';
  @Input() procedureId = '';
  @Input() sourceRecordId = '';
  @Input() canRecordManualCharges = false;
  @Input() recording = false;

  @Output() readonly record =
    new EventEmitter<RecordManualChargeRequest>();

  itemType: ManualChargeItemType = 'ADDITIONAL_MATERIAL';
  concept = '';
  quantity = '';
  unitPrice = '';
  justification = '';

  get dirty(): boolean {
    return !!(
      this.concept
      || this.quantity
      || this.unitPrice
      || this.justification
    );
  }

  get canSubmit(): boolean {
    if (
      this.destroyRef.destroyed
      || !this.canRecordManualCharges
      || this.recording
      || ![
        this.patientId,
        this.appointmentId,
        this.procedureId,
        this.sourceRecordId,
      ].every(id => uuidPattern.test(id))
      || !itemTypes.includes(this.itemType)
      || !quantityPattern.test(this.quantity)
      || !this.concept.trim()
      || this.concept.trim().length > 500
      || !this.justification.trim()
      || this.justification.trim().length > 1000
    ) {
      return false;
    }

    try {
      const amount = copMoney(this.unitPrice);
      return BigInt(amount.replace('.', '')) > 0n;
    } catch {
      return false;
    }
  }

  submit(): void {
    if (!this.canSubmit) return;

    const concept = this.concept.trim();
    const justification = this.justification.trim();
    const unitPrice = copMoney(this.unitPrice);

    const fingerprint = JSON.stringify([
      this.patientId,
      this.appointmentId,
      this.procedureId,
      this.sourceRecordId,
      this.itemType,
      concept,
      this.quantity,
      unitPrice,
      justification,
    ]);

    if (this.intent?.fingerprint !== fingerprint) {
      this.intent = {
        fingerprint,
        key: crypto.randomUUID(),
      };
    }

    this.record.emit({
      patientId: this.patientId,
      appointmentId: this.appointmentId,
      procedureId: this.procedureId,
      sourceRecordId: this.sourceRecordId,
      itemType: this.itemType,
      concept,
      quantity: this.quantity,
      unitPrice,
      currency: 'COP',
      justification,
      idempotencyKey: this.intent.key,
    });
  }

  discard(): void {
    if (this.recording) return;

    this.itemType = 'ADDITIONAL_MATERIAL';
    this.concept = '';
    this.quantity = '';
    this.unitPrice = '';
    this.justification = '';
    this.intent = undefined;
  }
}
