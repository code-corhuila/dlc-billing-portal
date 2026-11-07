import type { PortalContext } from '../../shell-contract';
import { copMoney } from '../model/cop-money';
import { readBillableItem, type ReadBillableItem } from './invoice-read-adapter';

export interface PriceCorrectionRequest {
  readonly itemId: string;
  readonly unitPrice: string;
  readonly reason: string;
  readonly expectedVersion: number;
  readonly idempotencyKey: string;
}
export class PriceCorrectionHttpError extends Error {
  constructor(readonly status: number) { super('Price correction failed'); }
}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function correctPriceHttp(context: Pick<PortalContext,'http'|'signal'>,
  request: PriceCorrectionRequest): Promise<ReadBillableItem> {
  const unitPrice=copMoney(request.unitPrice);
  if(context.signal.aborted || !uuid.test(request.itemId) || !uuid.test(request.idempotencyKey)
    || BigInt(unitPrice.replace('.',''))<=0n || !request.reason.trim() || request.reason.length>1000
    || !Number.isSafeInteger(request.expectedVersion) || request.expectedVersion<1) throw new Error('Invalid correction');
  const result=await context.http.request({method:'POST',path:`/api/v1/billable-items/${request.itemId}/approvals`,
    body:{unitPrice,reason:request.reason,expectedVersion:request.expectedVersion},
    headers:{'Idempotency-Key':request.idempotencyKey},signal:context.signal});
  if(context.signal.aborted) throw new Error('Correction cancelled');
  if(!result.ok) throw new PriceCorrectionHttpError(result.status);
  if(result.status!==200) throw new Error('Unexpected correction status');
  const item=readBillableItem(result.data);
  if(item.id!==request.itemId || item.approvalRequired!==false || item.unitPrice!==unitPrice
    || item.version!==request.expectedVersion+1) throw new Error('Invalid correction response');
  return item;
}
