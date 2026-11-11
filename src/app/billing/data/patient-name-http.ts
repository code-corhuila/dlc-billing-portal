import type { PortalContext } from '../../shell-contract';

/** Patient identity belongs to Patients; a failure leaves the invoice usable by ID. */
export async function readPatientName(
  context: Pick<PortalContext, 'http' | 'signal'>, id: string,
): Promise<string | undefined> {
  if (!id || context.signal.aborted) return undefined;
  try {
    const result = await context.http.request({
      method: 'GET', path: `/api/v1/patients/${encodeURIComponent(id)}`, signal: context.signal,
    });
    if (!result.ok || context.signal.aborted || !result.data || typeof result.data !== 'object') return undefined;
    const patient = result.data as { id?: unknown; name?: unknown };
    return patient.id === id && typeof patient.name === 'string' && patient.name.trim()
      ? patient.name.trim() : undefined;
  } catch { return undefined; }
}
