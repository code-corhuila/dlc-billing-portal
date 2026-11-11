import type { PortalContext } from '../../shell-contract';
import { readBillableItem, readInvoiceDetail, type ReadBillableItem, type ReadInvoice } from './invoice-read-adapter';
import { pageQuery, readPageMeta, type PageMeta } from './pagination';

export const isUuid = (value: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

export interface DraftInvoiceRequest {
  patientId: string;
  appointmentId?: string;
  billableItemIds: string[];
}

export class InvoiceDraftHttpError extends Error {
  constructor(readonly status: number, readonly code?: string) { super('Invoice draft request failed'); }
}

export interface PatientOption { id: string; label: string }

/** Patients-owned search (`GET /api/v1/patients`), active patients only; labels carry no contact data. */
export async function searchPatientsHttp(
  context: Pick<PortalContext, 'http' | 'signal'>, text: string,
): Promise<PatientOption[]> {
  if (context.signal.aborted) throw new Error('Cancelled request');
  const result = await context.http.request({ method: 'GET', path: '/api/v1/patients',
    query: { search: [text], status: ['ACTIVE'], page: ['1'], limit: ['10'] }, signal: context.signal });
  if (context.signal.aborted) throw new Error('Cancelled request');
  if (!result.ok) throw new InvoiceDraftHttpError(result.status);
  const body = result.data as { data?: unknown } | null;
  if (!body || !Array.isArray(body.data)) throw new Error('Invalid patient page');
  return body.data.map(value => {
    const patient = value as Record<string, unknown>;
    if (typeof patient['id'] !== 'string' || !isUuid(patient['id']) || typeof patient['name'] !== 'string') {
      throw new Error('Invalid patient');
    }
    const document = typeof patient['documentNumber'] === 'string'
      ? ` — ${String(patient['documentType'] ?? '')} ${patient['documentNumber']}`.replace('—  ', '— ') : '';
    return { id: patient['id'], label: `${patient['name']}${document}` };
  });
}

export async function readUnbilledItemsHttp(
  context: Pick<PortalContext, 'http' | 'signal'>, patientId: string, page = 1,
): Promise<{ data: ReadBillableItem[]; meta: PageMeta }> {
  if (!isUuid(patientId) || context.signal.aborted) throw new Error('Invalid patient or cancelled request');
  const result = await context.http.request({ method: 'GET',
    path: '/api/v1/billable-items',
    query: { ...pageQuery(page), patientId: [patientId] },
    signal: context.signal });
  if (context.signal.aborted) throw new Error('Cancelled request');
  if (!result.ok) throw new InvoiceDraftHttpError(result.status);
  const body = result.data as { data?: unknown; meta?: unknown } | null;
  if (!body || !Array.isArray(body.data)) throw new Error('Invalid billable items page');
  const data = body.data.map(readBillableItem);
  if (data.some(item => item.patientId !== patientId)) throw new Error('Patient mismatch');
  return { data: data.filter(item => item.status === 'UNBILLED'), meta: readPageMeta(body.meta) };
}

export async function createInvoiceDraftHttp(
  context: Pick<PortalContext, 'http' | 'signal'>, input: DraftInvoiceRequest, key: string,
): Promise<ReadInvoice> {
  if (context.signal.aborted || !isUuid(key) || !isUuid(input.patientId)
    || (input.appointmentId !== undefined && !isUuid(input.appointmentId))
    || !input.billableItemIds.length || !input.billableItemIds.every(isUuid)
    || new Set(input.billableItemIds).size !== input.billableItemIds.length) throw new Error('Invalid invoice draft');
  const body: DraftInvoiceRequest = { patientId: input.patientId, billableItemIds: [...input.billableItemIds] };
  if (input.appointmentId) body.appointmentId = input.appointmentId;
  const result = await context.http.request({ method: 'POST', path: '/api/v1/invoices', body,
    headers: { 'Idempotency-Key': key }, signal: context.signal });
  if (context.signal.aborted) throw new Error('Cancelled request');
  if (!result.ok) throw new InvoiceDraftHttpError(result.status, result.error);
  if (result.status !== 201) throw new InvoiceDraftHttpError(result.status);
  const invoice = readInvoiceDetail(result.data);
  if (invoice.items.length !== body.billableItemIds.length
    || invoice.items.some(item => !body.billableItemIds.includes(item.id))
    || !isUuid(invoice.id) || invoice.patientId !== input.patientId || invoice.status !== 'DRAFT'
    || (input.appointmentId && invoice.appointmentId !== input.appointmentId)) throw new Error('Invalid draft response');
  return invoice;
}
