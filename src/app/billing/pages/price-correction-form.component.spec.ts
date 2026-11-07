import '@angular/compiler';
import { Injector, runInInjectionContext } from '@angular/core';
import { expect, it, vi } from 'vitest';
import { PriceCorrectionFormComponent } from './price-correction-form.component';
import { copMoney } from '../model/cop-money';
import type { PortalContext } from '../../shell-contract';
const id='11111111-1111-4111-8111-111111111111';
function setup() {
  const injector=Injector.create({providers:[]});
  const page=runInInjectionContext(injector,()=>new PriceCorrectionFormComponent());
  const request=vi.fn().mockResolvedValue({ok:false,status:503});
  const session={state:'authenticated',user:{id,roles:['ADMINISTRATOR']}};
  page.context={http:{request},signal:new AbortController().signal,session:{getSnapshot:()=>session,subscribe:()=>()=>{}}} as unknown as PortalContext;
  page.item={id,patientId:id,procedureId:id,description:'Financial item',quantity:'1',unitPrice:copMoney('10.00'),currency:'COP',version:1,status:'BILLED',approvalRequired:true};
  page.canCorrect=true;page.unitPrice='37.11';page.reason='Administrative correction';
  return {page,request,session,injector};
}
it('retains the same key after ambiguous failure and blocks concurrent submits',async()=>{
  const {page,request,injector}=setup();
  try {
    const first=page.submit(); await page.submit(); await first;
    await page.submit();
    expect(request).toHaveBeenCalledTimes(2);
    expect(request.mock.calls[0]?.[0].headers).toEqual(request.mock.calls[1]?.[0].headers);
    page.reason='Changed reason';await page.submit();
    expect(request.mock.calls[2]?.[0].headers).not.toEqual(request.mock.calls[0]?.[0].headers);
    expect(page.dirty).toBe(true);page.discard();expect(page.dirty).toBe(false);
  } finally {injector.destroy();}
});
it('requires current Administrator authority and an unresolved item',async()=>{
  const {page,request,session,injector}=setup();
  try {
    session.user.roles=['DENTIST'];await page.submit();
    session.user.roles=['ADMINISTRATOR'];page.item={...page.item!,approvalRequired:false};await page.submit();
    expect(request).not.toHaveBeenCalled();
  } finally {injector.destroy();}
});
it('clears protected inputs after confirmed success and emits one refresh',async()=>{
  const {page,request,injector}=setup();
  try {
    const emit=vi.spyOn(page.corrected,'emit');
    request.mockResolvedValue({ok:true,status:200,data:{...page.item,unitPrice:'37.11',version:2,approvalRequired:false}});
    await page.submit();await page.submit();
    expect(emit).toHaveBeenCalledOnce();expect(request).toHaveBeenCalledOnce();
    expect(page.reason).toBe('');expect(page.dirty).toBe(false);
  } finally {injector.destroy();}
});
it('ignores a success arriving after session identity changed',async()=>{
  const {page,request,session,injector}=setup();
  try {
    const emit=vi.spyOn(page.corrected,'emit');
    let resolve!:(result:unknown)=>void;
    request.mockImplementation(()=>new Promise(done=>{resolve=done;}));
    const pending=page.submit();session.user.id='22222222-2222-4222-8222-222222222222';
    resolve({ok:true,status:200,data:{...page.item,unitPrice:'37.11',version:2,approvalRequired:false}});
    await pending;expect(emit).not.toHaveBeenCalled();
  } finally {injector.destroy();}
});

it('discards a protected correction draft when the item version changes',()=>{
  const {page,injector}=setup();
  try {
    page.item={...page.item!,version:2};
    expect(page.reason).toBe('');expect(page.unitPrice).toBe('');expect(page.canSubmit).toBe(false);
  } finally {injector.destroy();}
});
