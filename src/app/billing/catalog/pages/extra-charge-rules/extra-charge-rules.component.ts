import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { EXTRA_CHARGE_RULE_FIXTURES } from '../../data/extra-charge-rules.mock';
import {
  CreateExtraChargeRuleRequest,
  ExtraChargeRule,
  ExtraChargeRuleType,
} from '../../model/extra-charge-rule.model';

@Component({
  selector: 'dlc-extra-charge-rules',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
  ],
  template: `
    <main class="billing-page">

      <header class="page-header">
        <div>
          <a
            routerLink="/prices"
            class="back-link"
          >
            ← Volver a precios
          </a>

          <p class="eyebrow">
            Billing
          </p>

          <h1>
            Reglas de cargos adicionales
          </h1>

          <p class="description">
            Administra las versiones de reglas utilizadas para representar
            cargos adicionales dentro del dominio de Billing.
          </p>
        </div>

        <button
          type="button"
          class="primary-button"
          (click)="openForm()"
        >
          + Nueva regla
        </button>
      </header>

      <section class="mock-notice">
        <strong>Demostración Cut 2</strong>

        <span>
          Las reglas y valores mostrados son ficticios.
          No existe persistencia ni integración con Billing API todavía.
        </span>
      </section>

      <section class="toolbar">

        <label>
          <span>Buscar regla</span>

          <input
            type="search"
            placeholder="Nombre o código..."
            [(ngModel)]="searchTerm"
          />
        </label>

        <button
          type="button"
          class="secondary-button"
          (click)="simulateEmpty()"
        >
          Simular vacío
        </button>

        <button
          type="button"
          class="secondary-button"
          (click)="simulateError()"
        >
          Simular error
        </button>

        <button
          type="button"
          class="secondary-button"
          (click)="restoreFixtures()"
        >
          Restaurar
        </button>

      </section>

      @if (errorMessage()) {

        <section class="state-card error-state">
          <h2>
            No fue posible cargar las reglas
          </h2>

          <p>
            {{ errorMessage() }}
          </p>

          <button
            type="button"
            class="secondary-button"
            (click)="restoreFixtures()"
          >
            Intentar nuevamente
          </button>
        </section>

      } @else if (filteredRules.length === 0) {

        <section class="state-card">
          <h2>
            No hay reglas para mostrar
          </h2>

          <p>
            No se encontraron reglas de cargos adicionales.
          </p>
        </section>

      } @else {

        <section class="catalog-card">

          <div class="table-wrapper">

            <table>

              <thead>
                <tr>
                  <th>Regla</th>
                  <th>Tipo</th>
                  <th>Valor</th>
                  <th>Versión</th>
                  <th>Vigente desde</th>
                  <th>Estado</th>
                </tr>
              </thead>

              <tbody>

                @for (rule of filteredRules; track rule.id) {

                  <tr>

                    <td>
                      <strong>
                        {{ rule.name }}
                      </strong>

                      <small>
                        {{ rule.code }}
                      </small>
                    </td>

                    <td>
                      {{ getTypeLabel(rule.type) }}
                    </td>

                    <td>
                      {{ formatMoney(rule.amount) }}
                    </td>

                    <td>
                      v{{ rule.version }}
                    </td>

                    <td>
                      {{ rule.validFrom }}
                    </td>

                    <td>
                      <span
                        class="status"
                        [class.active]="rule.active"
                      >
                        {{ rule.active ? 'Vigente' : 'Histórico' }}
                      </span>
                    </td>

                  </tr>

                }

              </tbody>

            </table>

          </div>

        </section>

      }

      @if (successMessage()) {

        <section class="success-message">
          {{ successMessage() }}
        </section>

      }

      @if (formVisible()) {

        <div class="modal-backdrop">

          <section class="modal">

            <header class="modal-header">

              <div>
                <p class="eyebrow">
                  Nueva versión
                </p>

                <h2>
                  Registrar regla adicional
                </h2>
              </div>

              <button
                type="button"
                class="close-button"
                [disabled]="submitting()"
                (click)="closeForm()"
              >
                ×
              </button>

            </header>

            <form
              #ruleForm="ngForm"
              (ngSubmit)="submitRule()"
            >

              <div class="form-grid">

                <label>
                  <span>
                    Código *
                  </span>

                  <input
                    type="text"
                    name="code"
                    required
                    [(ngModel)]="form.code"
                    [disabled]="submitting()"
                  />
                </label>

                <label>
                  <span>
                    Nombre *
                  </span>

                  <input
                    type="text"
                    name="name"
                    required
                    [(ngModel)]="form.name"
                    [disabled]="submitting()"
                  />
                </label>

                <label>
                  <span>
                    Tipo *
                  </span>

                  <select
                    name="type"
                    required
                    [(ngModel)]="form.type"
                    [disabled]="submitting()"
                  >
                    <option value="MATERIAL">
                      Material
                    </option>

                    <option value="COMPLEXITY">
                      Complejidad
                    </option>

                    <option value="ADDITIONAL_PROCEDURE">
                      Procedimiento adicional
                    </option>

                    <option value="OTHER">
                      Otro
                    </option>
                  </select>
                </label>

                <label>
                  <span>
                    Valor en COP *
                  </span>

                  <input
                    type="number"
                    name="amount"
                    required
                    min="1"
                    [(ngModel)]="form.amount"
                    [disabled]="submitting()"
                  />

                  @if (
                    form.amount !== null &&
                    form.amount <= 0
                  ) {
                    <small class="validation-message">
                      El valor debe ser mayor que cero.
                    </small>
                  }

                </label>

                <label>
                  <span>
                    Vigente desde *
                  </span>

                  <input
                    type="date"
                    name="validFrom"
                    required
                    [(ngModel)]="form.validFrom"
                    [disabled]="submitting()"
                  />
                </label>

                <label class="full-width">
                  <span>
                    Descripción *
                  </span>

                  <textarea
                    name="description"
                    required
                    rows="4"
                    [(ngModel)]="form.description"
                    [disabled]="submitting()"
                  ></textarea>
                </label>

              </div>

              <footer class="modal-actions">

                <button
                  type="button"
                  class="secondary-button"
                  [disabled]="submitting()"
                  (click)="closeForm()"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  class="primary-button"
                  [disabled]="
                    ruleForm.invalid ||
                    form.amount === null ||
                    form.amount <= 0 ||
                    submitting()
                  "
                >
                  {{
                    submitting()
                      ? 'Guardando...'
                      : 'Guardar nueva versión'
                  }}
                </button>

              </footer>

            </form>

          </section>

        </div>

      }

    </main>
  `,
  styles: [`
    :host {
      display: block;
      min-height: 100%;
      background: #f7f9fb;
      color: #17212b;
      font-family:
        Inter,
        system-ui,
        -apple-system,
        BlinkMacSystemFont,
        "Segoe UI",
        sans-serif;
    }

    * {
      box-sizing: border-box;
    }

    button,
    input,
    select,
    textarea {
      font: inherit;
    }

    .billing-page {
      width: min(1180px, calc(100% - 32px));
      margin: auto;
      padding: 40px 0 64px;
    }

    .page-header {
      display: flex;
      justify-content: space-between;
      gap: 24px;
      margin-bottom: 24px;
    }

    h1 {
      margin: 5px 0 10px;
      font-size: 36px;
    }

    h2 {
      margin-top: 0;
    }

    .eyebrow {
      margin: 0;
      font-size: 13px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .08em;
      color: #4d6f75;
    }

    .description {
      max-width: 720px;
      color: #64727d;
      line-height: 1.6;
    }

    .back-link {
      display: inline-block;
      margin-bottom: 20px;
      color: #375f65;
      text-decoration: none;
      font-weight: 600;
    }

    .mock-notice {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      padding: 14px 16px;
      margin-bottom: 24px;
      border: 1px solid #d6e0e3;
      border-radius: 12px;
      background: white;
      color: #53636d;
    }

    .toolbar {
      display: flex;
      align-items: end;
      gap: 12px;
      flex-wrap: wrap;
      margin-bottom: 20px;
    }

    .toolbar label {
      flex: 1;
      min-width: 280px;
    }

    label {
      display: flex;
      flex-direction: column;
      gap: 7px;
      font-weight: 600;
    }

    input,
    select,
    textarea {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid #cad4d9;
      border-radius: 8px;
      background: white;
    }

    input,
    select {
      min-height: 44px;
    }

    textarea {
      resize: vertical;
    }

    input:focus,
    select:focus,
    textarea:focus {
      outline: none;
      border-color: #52757b;
      box-shadow:
        0 0 0 3px rgba(82, 117, 123, .12);
    }

    button {
      min-height: 42px;
      padding: 10px 16px;
      border: 0;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 700;
    }

    button:disabled {
      opacity: .6;
      cursor: not-allowed;
    }

    .primary-button {
      background: #375f65;
      color: white;
    }

    .secondary-button {
      border: 1px solid #cad4d9;
      background: white;
      color: #37505a;
    }

    .catalog-card,
    .state-card {
      border: 1px solid #dde5e8;
      border-radius: 14px;
      background: white;
      overflow: hidden;
    }

    .table-wrapper {
      overflow-x: auto;
    }

    table {
      width: 100%;
      border-collapse: collapse;
    }

    th,
    td {
      padding: 16px;
      border-bottom: 1px solid #edf1f3;
      text-align: left;
      white-space: nowrap;
    }

    th {
      background: #f8fafb;
      color: #687781;
      font-size: 13px;
    }

    td small {
      display: block;
      margin-top: 5px;
      color: #71808a;
    }

    .status {
      display: inline-flex;
      padding: 5px 9px;
      border-radius: 999px;
      background: #edf0f1;
      font-size: 12px;
      font-weight: 700;
    }

    .status.active {
      background: #e7f5ed;
      color: #266246;
    }

    .state-card {
      padding: 40px;
      text-align: center;
    }

    .error-state {
      border-color: #efcaca;
      background: #fffafa;
      color: #852d2d;
    }

    .success-message {
      margin-top: 16px;
      padding: 14px 16px;
      border: 1px solid #cde6d6;
      border-radius: 10px;
      background: #eff9f3;
      color: #266246;
    }

    .modal-backdrop {
      position: fixed;
      inset: 0;
      display: grid;
      place-items: center;
      padding: 20px;
      background: rgba(21, 31, 37, .55);
      z-index: 1000;
    }

    .modal {
      width: min(720px, 100%);
      max-height: calc(100vh - 40px);
      overflow-y: auto;
      padding: 24px;
      border-radius: 16px;
      background: white;
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 24px;
    }

    .close-button {
      width: 40px;
      padding: 0;
      border: 1px solid #d5dde0;
      background: white;
      font-size: 24px;
    }

    .form-grid {
      display: grid;
      grid-template-columns:
        repeat(2, minmax(0, 1fr));
      gap: 18px;
    }

    .full-width {
      grid-column: 1 / -1;
    }

    .validation-message {
      color: #b3261e;
      font-weight: 500;
    }

    .modal-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      margin-top: 28px;
      padding-top: 20px;
      border-top: 1px solid #e7edef;
    }

    @media (max-width: 720px) {
      .page-header {
        flex-direction: column;
      }

      .form-grid {
        grid-template-columns: 1fr;
      }

      .full-width {
        grid-column: auto;
      }
    }
  `],
})
export class ExtraChargeRulesComponent {

  readonly rules = signal<ExtraChargeRule[]>([
    ...EXTRA_CHARGE_RULE_FIXTURES,
  ]);

  readonly formVisible = signal(false);
  readonly submitting = signal(false);
  readonly successMessage = signal('');
  readonly errorMessage = signal('');

  searchTerm = '';

  form: Omit<CreateExtraChargeRuleRequest, 'amount'> & {
    amount: number | null;
  } = this.createEmptyForm();

  get filteredRules(): ExtraChargeRule[] {

    const term =
      this.searchTerm.trim().toLowerCase();

    if (!term) {
      return this.rules();
    }

    return this.rules().filter((rule) =>
      rule.name.toLowerCase().includes(term) ||
      rule.code.toLowerCase().includes(term),
    );
  }

  formatMoney(amount: number): string {

    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(amount);
  }

  getTypeLabel(type: ExtraChargeRuleType): string {

    const labels:
      Record<ExtraChargeRuleType, string> = {

      MATERIAL: 'Material',

      COMPLEXITY:
        'Complejidad',

      ADDITIONAL_PROCEDURE:
        'Procedimiento adicional',

      OTHER:
        'Otro',
    };

    return labels[type];
  }

  openForm(): void {

    this.successMessage.set('');
    this.errorMessage.set('');

    this.form =
      this.createEmptyForm();

    this.formVisible.set(true);
  }

  closeForm(): void {

    if (this.submitting()) {
      return;
    }

    this.formVisible.set(false);
  }

  submitRule(): void {

    if (
      this.form.amount === null ||
      this.form.amount <= 0 ||
      !this.form.code.trim() ||
      !this.form.name.trim() ||
      !this.form.description.trim() ||
      !this.form.validFrom
    ) {
      return;
    }

    this.submitting.set(true);
    this.successMessage.set('');
    this.errorMessage.set('');

    setTimeout(() => {

      const currentRules =
        this.rules();

      const sameRuleVersions =
        currentRules.filter(
          (rule) =>
            rule.code ===
            this.form.code.trim(),
        );

      const latestVersion =
        sameRuleVersions.reduce(
          (max, rule) =>
            Math.max(max, rule.version),
          0,
        );

      const updatedRules =
        currentRules.map((rule) => {

          if (
            rule.code ===
              this.form.code.trim() &&
            rule.active
          ) {
            return {
              ...rule,
              active: false,
            };
          }

          return rule;
        });

      const newRule: ExtraChargeRule = {

        id:
          `mock-rule-${Date.now()}`,

        code:
          this.form.code.trim(),

        name:
          this.form.name.trim(),

        description:
          this.form.description.trim(),

        type:
          this.form.type,

        amount:
          this.form.amount!,

        currency:
          'COP',

        validFrom:
          this.form.validFrom,

        version:
          latestVersion + 1,

        active:
          true,
      };

      this.rules.set([
        newRule,
        ...updatedRules,
      ]);

      this.submitting.set(false);
      this.formVisible.set(false);

      this.successMessage.set(
        'Nueva versión de la regla registrada correctamente en la demostración.',
      );

      this.form =
        this.createEmptyForm();

    }, 900);
  }

  simulateEmpty(): void {

    this.successMessage.set('');
    this.errorMessage.set('');
    this.rules.set([]);
  }

  simulateError(): void {

    this.successMessage.set('');

    this.rules.set([]);

    this.errorMessage.set(
      'Error simulado al consultar las reglas adicionales.',
    );
  }

  restoreFixtures(): void {

    this.successMessage.set('');
    this.errorMessage.set('');

    this.rules.set([
      ...EXTRA_CHARGE_RULE_FIXTURES,
    ]);
  }

  private createEmptyForm():
    Omit<CreateExtraChargeRuleRequest, 'amount'> & {
      amount: number | null;
    } {

    return {
      code: '',
      name: '',
      description: '',
      type: 'MATERIAL',
      amount: null,
      validFrom: '',
    };
  }
}