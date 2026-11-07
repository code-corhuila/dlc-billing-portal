import { expect, it, vi } from 'vitest';
import { correctPriceHttp } from './price-correction-http';
import type { PortalContext } from '../../shell-contract';
const id='11111111-1111-4111-8111-111111111111';
const key='22222222-2222-4222-8222-222222222222';
const input={itemId:id,unitPrice:'37.11',reason:'Administrative reason',expectedVersion:2,idempotencyKey:key};
const item={id,patientId:id,procedureId:id,description:'Financial concept',quantity:'0.5',unitPrice:'37.11',currency:'COP',approvalRequired:false,status:'BILLED',version:3};
function setup(data:unknown=item,status=200) {
  const request=vi.fn().mockResolvedValue({ok:status===200,status,data});
  return {request,context:{http:{request},signal:new AbortController().signal} as Pick<PortalContext,'http'|'signal'>};
}
it('uses the existing correction contract and validates the financial response',async()=>{
  const {request,context}=setup();
  expect(await correctPriceHttp(context,input)).toMatchObject(item);
  expect(request).toHaveBeenCalledWith({method:'POST',path:`/api/v1/billable-items/${id}/approvals`,
    body:{unitPrice:'37.11',reason:'Administrative reason',expectedVersion:2},headers:{'Idempotency-Key':key},signal:context.signal});
});
it('rejects malformed input before HTTP',async()=>{
  const {request,context}=setup();
  for(const change of [{unitPrice:'0.00'},{unitPrice:'1.234'},{reason:' '},{reason:'x'.repeat(1001)},
    {expectedVersion:0},{expectedVersion:1.2},{itemId:'wrong'},{idempotencyKey:'wrong'}])
    await expect(correctPriceHttp(context,{...input,...change})).rejects.toThrow();
  expect(request).not.toHaveBeenCalled();
});
it('rejects stale, unrelated or unresolved successful responses',async()=>{
  for(const change of [{id:key},{approvalRequired:true},{version:2},{unitPrice:'99.00'},{currency:'USD'}]) {
    const {context}=setup({...item,...change});
    await expect(correctPriceHttp(context,input)).rejects.toThrow();
  }
});
it('preserves the status for safe user messaging and rejects aborted calls',async()=>{
  for(const status of [401,403,404,409,503]) {
    const {context}=setup({},status);
    await expect(correctPriceHttp(context,input)).rejects.toMatchObject({status});
  }
  const {request,context}=setup(); const controller=new AbortController(); controller.abort();
  await expect(correctPriceHttp({...context,signal:controller.signal},input)).rejects.toThrow();
  expect(request).not.toHaveBeenCalled();
});
