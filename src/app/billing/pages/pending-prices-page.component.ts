import { Component, DestroyRef, Input, OnInit, inject } from '@angular/core';
import type { PortalContext } from '../../shell-contract';
import { pageQuery, readPageMeta, type PageMeta } from '../data/pagination';

/** One declared source of an encounter that still has no billable item (ADR-015 decision 6). */
export interface PendingSource {
  sourceRecordId: string;
  procedureId: string;
  itemType: string;
  code: string;
  quantity: string;
  completedAt: string;
}

export interface PendingAccount {
  encounterAccountId: string;
  patientId: string;
  appointmentId: string;
  declaredAt: string;
  missingSources: PendingSource[];
}

const ITEM_TYPES: Readonly<Record<string, string>> = {
  BASE_PROCEDURE: 'Procedimiento',
  ADDITIONAL_MATERIAL: 'Material adicional',
  ADDITIONAL_PROCEDURE: 'Procedimiento adicional',
  COMPLEXITY_ADJUSTMENT: 'Ajuste por complejidad',
  OTHER_AUTHORIZED_CHARGE: 'Otro cargo autorizado',
};

const text = (value: unknown): string => {
  if (typeof value !== 'string') throw new Error('Invalid pending price');
  return value;
};

function readAccount(value: unknown): PendingAccount {
  const account = value as Record<string, unknown>;
  if (!account || !Array.isArray(account['missingSources']) || !account['missingSources'].length) {
    throw new Error('Invalid pending price');
  }
  return {
    encounterAccountId: text(account['encounterAccountId']), patientId: text(account['patientId']),
    appointmentId: text(account['appointmentId']), declaredAt: text(account['declaredAt']),
    missingSources: account['missingSources'].map(source => {
      const item = source as Record<string, unknown>;
      return { sourceRecordId: text(item['sourceRecordId']), procedureId: text(item['procedureId']),
        itemType: text(item['itemType']), code: text(item['code']), quantity: text(item['quantity']),
        completedAt: text(item['completedAt']) };
    }),
  };
}

/**
 * Encounters waiting for a price: Billing lists the declared sources with no price or rule valid at completion.
 * Creating the missing price or rule from that date lets Billing complete the encounter on its own.
 */
@Component({
  selector: 'dlc-pending-prices-page', standalone: true,
  template: `
    <section aria-label="Atenciones pendientes de precio">
      <h1 tabindex="-1">Atenciones pendientes de precio</h1>
      <p>Estas atenciones están cerradas, pero algún concepto no tenía precio vigente en la fecha del procedimiento.
        Cree el precio o la regla adicional con ese código y una vigencia desde esa fecha; Billing completará la
        atención automáticamente.</p>
      @if (loading) { <p role="status">Consultando atenciones pendientes...</p> }
      @if (message) { <p role="status">{{ message }}</p> }
      @for (account of accounts; track account.encounterAccountId) {
        <article class="pending-account">
          <h2>Atención declarada el {{ day(account.declaredAt) }}</h2>
          <p>Paciente {{ account.patientId }} · Cita {{ account.appointmentId }}</p>
          <ul>
            @for (source of account.missingSources; track source.sourceRecordId) {
              <li><strong>{{ source.code || 'Sin código' }}</strong> — {{ itemTypeLabel(source.itemType) }} —
                cantidad {{ quantity(source.quantity) }} — vigencia necesaria desde {{ day(source.completedAt) }}</li>
            }
          </ul>
        </article>
      }
      @if (meta && meta.totalPages > 1) {
        <nav aria-label="Paginación de atenciones pendientes">
          <button type="button" [disabled]="meta.page <= 1 || loading" (click)="load(meta.page - 1)">Anterior</button>
          <span>Página {{ meta.page }} de {{ meta.totalPages }}</span>
          <button type="button" [disabled]="meta.page >= meta.totalPages || loading" (click)="load(meta.page + 1)">Siguiente</button>
        </nav>
      }
    </section>`,
  styles: [`section { max-width: 900px; margin: 24px auto; padding: 24px; }
    .pending-account { margin: 16px 0; padding: 16px; border: 1px solid #d8dee4; border-radius: 8px; }
    button { min-height: 44px; margin: 8px; padding: 8px 16px; }`],
})
export class PendingPricesPageComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  @Input() context!: PortalContext;
  accounts: PendingAccount[] = [];
  meta: PageMeta | null = null;
  loading = false;
  message = '';
  private generation = 0;

  ngOnInit(): void { void this.load(1); }
  itemTypeLabel(type: string): string { return ITEM_TYPES[type] ?? type; }
  quantity(value: string): string { return value.replace(/\.?0+$/, ''); }
  day(value: string): string { return value.slice(0, 10); }

  async load(page = 1): Promise<void> {
    const generation = ++this.generation;
    this.loading = true; this.message = '';
    const current = () => !this.destroyRef.destroyed && !this.context.signal.aborted && generation === this.generation;
    try {
      const result = await this.context.http.request({ method: 'GET', path: '/api/v1/encounter-accounts/pending-prices',
        query: pageQuery(page), signal: this.context.signal });
      if (!result.ok) throw new Error('Pending prices unavailable');
      const body = result.data as { data?: unknown; meta?: unknown } | null;
      if (!body || !Array.isArray(body.data)) throw new Error('Invalid pending price page');
      const accounts = body.data.map(readAccount);
      const meta = readPageMeta(body.meta);
      if (current()) {
        this.accounts = accounts; this.meta = meta;
        if (!accounts.length) this.message = 'No hay atenciones esperando precio.';
      }
    } catch {
      if (current()) { this.accounts = []; this.message = 'No fue posible consultar las atenciones pendientes. Puede reintentar.'; }
    } finally { if (generation === this.generation) this.loading = false; }
  }
}
