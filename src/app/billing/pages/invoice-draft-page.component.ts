import { Component, DestroyRef, EventEmitter, Input, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { PortalContext } from '../../shell-contract';
import { createInvoiceDraftHttp, readUnbilledItemsHttp, isUuid, InvoiceDraftHttpError } from '../data/invoice-draft-http';
import type { ReadBillableItem } from '../data/invoice-read-adapter';
import type { PageMeta } from '../data/pagination';
import { formatCopMoney } from '../presentation/format-cop-money';

@Component({
  selector: 'dlc-invoice-draft-page', standalone: true, imports: [FormsModule],
  template: `
    <section aria-label="Crear borrador de factura">
      <h1 tabindex="-1">Crear borrador de factura</h1>
      <p>Selecciona cargos pendientes del paciente. Billing calcula los totales y verifica que la atención esté finalizada administrativamente.</p>
      <form (ngSubmit)="load(1)">
        <label>ID del paciente <input name="patientId" [ngModel]="patientId"
          (ngModelChange)="changePatient($event)" [disabled]="saving || !!createdId" /></label>
        <label>ID de la cita (opcional) <input name="appointmentId" [ngModel]="appointmentId"
          (ngModelChange)="changeAppointment($event)" [disabled]="saving || !!createdId" /></label>
        <button type="submit" [disabled]="!canCreate || !validPatient || loading || saving || !!createdId">Consultar cargos</button>
      </form>
      @if (loading) { <p role="status">Consultando cargos...</p> }
      @if (message) { <p role="status">{{ message }}</p> }
      @if (loaded && !loading && !createdId) {
        @if (!items.length) { <p>No hay cargos pendientes en esta página.</p> }
        <ul>
          @for (item of items; track item.id) {
            <li><label><input type="checkbox" [checked]="selected.has(item.id)"
              [disabled]="saving || !canCreate" (change)="toggle(item)" />
              {{ item.description }} — cantidad {{ item.quantity }} — COP {{ format(item.unitPrice) }} por unidad
            </label></li>
          }
        </ul>
        @if (meta) {
          <nav aria-label="Paginación de cargos">
            <button type="button" [disabled]="meta.page <= 1 || saving" (click)="load(meta.page - 1)">Anterior</button>
            <span>Página {{ meta.page }} de {{ meta.totalPages || 1 }}</span>
            <button type="button" [disabled]="meta.page >= meta.totalPages || saving" (click)="load(meta.page + 1)">Siguiente</button>
          </nav>
        }
        <p>{{ selected.size }} cargos seleccionados</p>
        <button type="button" [disabled]="!canSubmit" (click)="submit()">{{ saving ? 'Creando...' : 'Crear borrador' }}</button>
      }
      @if (createdId) { <button type="button" (click)="created.emit(createdId)">Abrir borrador creado</button> }
      <button type="button" [disabled]="saving" (click)="resetForSession()">Limpiar formulario</button>
    </section>`,
  styles: [`section { max-width: 900px; margin: 24px auto; padding: 24px; }
    form { display: grid; gap: 16px; } label { display: block; } input { padding: 10px; }
    button { min-height: 44px; margin: 8px; padding: 8px 16px; } li { margin: 16px 0; }`],
})
export class InvoiceDraftPageComponent {
  private readonly destroyRef = inject(DestroyRef);
  @Input() context!: PortalContext;
  @Input() canCreate = false;
  @Output() readonly created = new EventEmitter<string>();
  patientId = '';
  appointmentId = '';
  items: ReadBillableItem[] = [];
  selected = new Map<string, ReadBillableItem>();
  meta: PageMeta | null = null;
  loading = false;
  loaded = false;
  saving = false;
  message = '';
  createdId = '';
  private generation = 0;
  private attempt?: { fingerprint: string; key: string };
  readonly format = formatCopMoney;
  get validPatient(): boolean { return isUuid(this.patientId); }
  get dirty(): boolean { return this.saving || (!this.createdId && (this.selected.size > 0 || !!this.patientId || !!this.appointmentId)); }
  get canSubmit(): boolean {
    return this.canCreate && !this.saving && !this.loading && !this.createdId && this.validPatient
      && (!this.appointmentId || isUuid(this.appointmentId)) && this.selected.size > 0;
  }
  changePatient(value: string): void {
    if (this.saving) return;
    this.resetForSession(); this.patientId = value.trim();
  }
  changeAppointment(value: string): void {
    if (this.saving) return;
    this.appointmentId = value.trim(); this.attempt = undefined;
  }
  toggle(item: ReadBillableItem): void {
    if (this.saving || !this.canCreate || item.patientId !== this.patientId || item.status !== 'UNBILLED') return;
    if (this.selected.has(item.id)) this.selected.delete(item.id);
    else this.selected.set(item.id, item);
  }
  resetForSession(): void {
    ++this.generation;
    this.patientId = ''; this.appointmentId = ''; this.selected.clear(); this.items = [];
    this.meta = null; this.loaded = false; this.loading = false; this.message = '';
    this.attempt = undefined; this.createdId = '';
  }
  private accessKey(): string {
    const snapshot = this.context.session.getSnapshot();
    return JSON.stringify([snapshot.state, snapshot.user?.id, snapshot.user?.roles, snapshot.permissions]);
  }
  private authorized(): boolean {
    const session = this.context.session.getSnapshot();
    return !this.destroyRef.destroyed && !this.context.signal.aborted && this.canCreate
      && session.state === 'authenticated'
      && session.user?.roles.some(role => ['ADMINISTRATOR', 'SECRETARY_ASSISTANT'].includes(role)) === true;
  }
  async load(page: number): Promise<void> {
    if (!this.validPatient || !this.authorized() || this.saving) return;
    const generation = ++this.generation, key = this.accessKey();
    this.loading = true; this.message = ''; this.items = [];
    const current = () => this.authorized() && generation === this.generation && key === this.accessKey();
    try {
      const result = await readUnbilledItemsHttp(this.context, this.patientId, page);
      if (current()) { this.items = result.data; this.meta = result.meta; this.loaded = true; }
    } catch {
      if (current()) { this.loaded = false; this.message = 'No fue posible consultar los cargos. Puede reintentar.'; }
    } finally { if (generation === this.generation) this.loading = false; }
  }
  async submit(): Promise<void> {
    if (!this.canSubmit || !this.authorized()) return;
    const body = { patientId: this.patientId, ...(this.appointmentId ? { appointmentId: this.appointmentId } : {}),
      billableItemIds: [...this.selected.keys()].sort() };
    const key = this.accessKey(), generation = this.generation;
    const fingerprint = JSON.stringify([key, body]);
    if (this.attempt?.fingerprint !== fingerprint) this.attempt = { fingerprint, key: crypto.randomUUID() };
    this.saving = true; this.message = '';
    const current = () => this.authorized() && generation === this.generation && key === this.accessKey();
    try {
      const invoice = await createInvoiceDraftHttp(this.context, body, this.attempt.key);
      if (current()) {
        this.createdId = invoice.id; this.selected.clear(); this.attempt = undefined;
        this.saving = false;
        this.message = 'Borrador creado correctamente.'; this.created.emit(invoice.id);
      }
    } catch (error) {
      if (current()) this.message = error instanceof InvoiceDraftHttpError && error.status === 409
        ? 'Conflicto: revise la finalización de la atención y si los cargos ya fueron facturados.'
        : 'No se pudo confirmar la creación. Reintente con los mismos datos.';
    } finally { if (!this.destroyRef.destroyed) this.saving = false; }
  }
}
