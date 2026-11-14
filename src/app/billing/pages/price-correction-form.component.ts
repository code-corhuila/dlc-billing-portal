import { Component, DestroyRef, EventEmitter, Input, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { PortalContext } from '../../shell-contract';
import type { ReadBillableItem } from '../data/invoice-read-adapter';
import { correctPriceHttp, PriceCorrectionHttpError } from '../data/price-correction-http';
import { copMoney } from '../model/cop-money';

@Component({selector:'dlc-price-correction-form',standalone:true,imports:[FormsModule],template:`
  @if (canCorrect && item?.approvalRequired) {
    <form (ngSubmit)="submit()" aria-label="Corrección administrativa de precio">
      <p>Este cargo requiere una corrección administrativa antes de emitir la factura.</p>
      <label>Precio unitario corregido (COP)
        <input name="correctionPrice" type="text" inputmode="decimal" [(ngModel)]="unitPrice" [disabled]="recording || completed" />
      </label>
      <label>Motivo de la corrección
        <textarea name="correctionReason" maxlength="1000" [(ngModel)]="reason" [disabled]="recording || completed"></textarea>
      </label>
      <button type="submit" [disabled]="!canSubmit">{{ recording ? 'Guardando...' : 'Corregir precio' }}</button>
      <button type="button" (click)="discard()" [disabled]="recording">Descartar</button>
      @if (message) { <p role="alert">{{ message }}</p> }
    </form>
  }
`})
export class PriceCorrectionFormComponent {
  private readonly destroyRef=inject(DestroyRef);
  private currentContext?: PortalContext;
  private unsubscribe?: () => void;
  @Input() set context(value: PortalContext | undefined) {
    this.unsubscribe?.(); this.currentContext=value;
    let actor=value?.session.getSnapshot().user?.id;
    this.unsubscribe=value?.session.subscribe(snapshot=>{
      const next=snapshot.state==='authenticated'?snapshot.user?.id:undefined;
      if(actor!==next) {this.reason='';this.unitPrice='';this.attempt=undefined;this.message='';this.completed=false;actor=next;}
    });
  }
  get context(): PortalContext | undefined { return this.currentContext; }
  private currentItem?: ReadBillableItem;
  @Input() set item(value: ReadBillableItem | undefined) {
    if(this.currentItem && (this.currentItem.id!==value?.id || this.currentItem.version!==value?.version)) {
      this.reason='';this.unitPrice='';this.attempt=undefined;this.message='';this.completed=false;
    }
    this.currentItem=value;
  }
  get item(): ReadBillableItem | undefined { return this.currentItem; }
  @Input() canCorrect=false;
  @Output() readonly corrected=new EventEmitter<void>();
  unitPrice=''; reason=''; recording=false; message=''; completed=false;
  private attempt?: { fingerprint: string; key: string };
  constructor() { this.destroyRef.onDestroy(()=>{this.unsubscribe?.();this.reason='';this.unitPrice='';this.attempt=undefined;}); }
  get dirty(): boolean { return this.recording || (!this.completed && !!(this.unitPrice || this.reason)); }
  private authorized(): boolean {
    const session=this.context?.session.getSnapshot();
    return !!this.context && !this.context.signal.aborted && !this.destroyRef.destroyed
      && session?.state==='authenticated' && session.user?.roles.includes('ADMINISTRATOR')===true;
  }
  get canSubmit(): boolean {
    if(!this.authorized() || !this.canCorrect || !this.item?.approvalRequired || this.recording || this.completed
      || !this.reason.trim() || this.reason.length>1000) return false;
    try { return BigInt(copMoney(this.unitPrice).replace('.',''))>0n; } catch { return false; }
  }
  discard(): void { if(!this.recording) {this.unitPrice='';this.reason='';this.attempt=undefined;this.message='';} }
  async submit(): Promise<void> {
    if(!this.canSubmit || !this.context || !this.item) return;
    const item=this.item,context=this.context,actor=context.session.getSnapshot().user?.id;
    const fingerprint=JSON.stringify([actor,item.id,item.version,this.unitPrice,this.reason]);
    if(this.attempt?.fingerprint!==fingerprint) this.attempt={fingerprint,key:crypto.randomUUID()};
    const isCurrent=()=>this.authorized() && this.context===context && this.item===item
      && context.session.getSnapshot().user?.id===actor;
    this.recording=true;this.message='';
    try {
      await correctPriceHttp(context,{itemId:item.id,expectedVersion:item.version,unitPrice:this.unitPrice,
        reason:this.reason,idempotencyKey:this.attempt.key});
      if(isCurrent()) {this.completed=true;this.reason='';this.unitPrice='';this.message='Corrección guardada. Actualice el detalle si no se recarga.';this.corrected.emit();}
    } catch(error:unknown) {
      if(isCurrent()) this.message=error instanceof PriceCorrectionHttpError && error.status===409
        ? 'El cargo cambió. Actualice el detalle antes de corregirlo.' : 'No se pudo guardar la corrección. Puede reintentar.';
    } finally {if(!this.destroyRef.destroyed) this.recording=false;}
  }
}
