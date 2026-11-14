import { Component, DestroyRef, ElementRef, EventEmitter, Input, Output, ViewChild, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { copMoney } from '../../../model/cop-money';
import type { CreateHttpExtraChargeRuleRequest, ExtraChargeItemType, HttpExtraChargeRule } from '../../data/extra-charge-rules-http';

@Component({
  selector: 'dlc-extra-charge-rule-create-form',
  standalone: true,
  imports: [FormsModule],
  template: `
    @if (canManageRules) {
      <button type="button" class="primary" [disabled]="creating" (click)="open()">Nueva versión de regla</button>
    }
    <dialog #dialog aria-labelledby="additional-rule-title" (cancel)="onCancel($event)">
      <form (ngSubmit)="submit()">
        <h2 id="additional-rule-title">Crear versión de regla adicional</h2>
        <p>Use el mismo código para registrar una nueva versión con otra fecha de vigencia.</p>
        <label>Código
          <input name="code" required maxlength="80" [(ngModel)]="form.code" [disabled]="creating" />
        </label>
        <label>Tipo de cargo
          <select name="itemType" [(ngModel)]="form.itemType" [disabled]="creating">
            <option value="ADDITIONAL_MATERIAL">Material adicional</option>
            <option value="ADDITIONAL_PROCEDURE">Procedimiento adicional</option>
            <option value="COMPLEXITY_ADJUSTMENT">Ajuste por complejidad</option>
            <option value="OTHER_AUTHORIZED_CHARGE">Otro cargo autorizado</option>
          </select>
        </label>
        <label>Precio unitario (COP)
          <input name="unitPrice" type="text" inputmode="decimal" required
            placeholder="15000.00" [(ngModel)]="form.unitPrice" [disabled]="creating"
            aria-describedby="rule-money-help" />
        </label>
        <small id="rule-money-help">Escriba un valor positivo con dos decimales, sin separadores de miles.</small>
        <label>Vigente desde (hora local)
          <input name="validFrom" type="datetime-local" step="1" required
            [(ngModel)]="form.validFrom" [disabled]="creating" />
        </label>
        <footer>
          <button type="button" [disabled]="creating" (click)="close()">Cancelar</button>
          <button type="submit" class="primary" [disabled]="creating || !valid">
            {{ creating ? 'Guardando...' : 'Guardar nueva versión' }}
          </button>
        </footer>
      </form>
    </dialog>
  `,
  styles: [`
    :host { display: block; }
    button, input, select { font: inherit; min-height: 44px; border-radius: 8px; }
    button { padding: 10px 16px; border: 1px solid #cad4d9; cursor: pointer; }
    .primary { background: #375f65; color: white; border-color: #375f65; }
    button:disabled { opacity: .6; cursor: not-allowed; }
    dialog { width: min(520px, calc(100% - 32px)); max-height: calc(100vh - 40px);
      border: 1px solid #dde5e8; border-radius: 14px; padding: 24px; overflow-y: auto; }
    dialog::backdrop { background: rgb(21 31 37 / 55%); }
    label { display: grid; gap: 6px; margin-top: 16px; font-weight: 600; }
    input, select { padding: 8px 10px; border: 1px solid #cad4d9; width: 100%; box-sizing: border-box; }
    p, small { color: #53636d; }
    footer { display: flex; justify-content: flex-end; gap: 12px; margin-top: 24px; }
  `],
})
export class ExtraChargeRuleCreateFormComponent {
  private readonly destroyRef = inject(DestroyRef);
  private allowed = false;
  @ViewChild('dialog') dialog?: ElementRef<HTMLDialogElement>;
  @Input() creating = false;
  @Input() set canManageRules(value: boolean) {
    this.allowed = value;
    if (!value) this.resetAndClose();
  }
  get canManageRules(): boolean { return this.allowed; }
  @Input() set savedRule(rule: HttpExtraChargeRule | null) {
    if (rule) this.resetAndClose();
  }
  @Output() readonly createRule = new EventEmitter<CreateHttpExtraChargeRuleRequest>();
  readonly formVisible = signal(false);
  form = this.empty();
  get dirty(): boolean { return this.formVisible(); }
  get valid(): boolean {
    try {
      return !!this.form.code.trim() && this.form.code.trim().length <= 80
        && ['ADDITIONAL_MATERIAL', 'ADDITIONAL_PROCEDURE', 'COMPLEXITY_ADJUSTMENT',
          'OTHER_AUTHORIZED_CHARGE'].includes(this.form.itemType)
        && BigInt(copMoney(this.form.unitPrice).replace('.', '')) > 0n && !!this.timestamp();
    } catch { return false; }
  }
  open(): void {
    if (!this.allowed || this.creating || this.destroyRef.destroyed) return;
    this.formVisible.set(true);
    this.dialog?.nativeElement.showModal();
  }
  close(): void {
    if (!this.creating) this.resetAndClose();
  }
  onCancel(event: Event): void {
    if (this.creating) event.preventDefault();
    else this.close();
  }
  submit(): void {
    if (!this.allowed || !this.formVisible() || this.creating || this.destroyRef.destroyed || !this.valid) return;
    this.createRule.emit({
      code: this.form.code.trim(), itemType: this.form.itemType, unitPrice: copMoney(this.form.unitPrice),
      requiresApproval: false, validFrom: this.timestamp()!,
    });
  }
  private timestamp(): string | null {
    const parts = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(this.form.validFrom);
    if (!parts) return null;
    const date = new Date(this.form.validFrom);
    if (!Number.isFinite(date.getTime()) || date.getFullYear() !== Number(parts[1])
      || date.getMonth() + 1 !== Number(parts[2]) || date.getDate() !== Number(parts[3])
      || date.getHours() !== Number(parts[4]) || date.getMinutes() !== Number(parts[5])
      || date.getSeconds() !== Number(parts[6] ?? '0')) return null;
    return date.toISOString();
  }
  private resetAndClose(): void {
    this.formVisible.set(false); this.form = this.empty(); this.dialog?.nativeElement.close();
  }
  private empty(): { code: string; itemType: ExtraChargeItemType; unitPrice: string; validFrom: string } {
    return { code: '', itemType: 'ADDITIONAL_MATERIAL', unitPrice: '', validFrom: '' };
  }
}
