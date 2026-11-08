import type { PortalRoute } from '../../shell-contract';

export interface ManualChargeSource {
  readonly patientId: string;
  readonly appointmentId: string;
  readonly procedureId: string;
  readonly sourceRecordId: string;
}
const fields = ['patientId', 'appointmentId', 'procedureId', 'sourceRecordId'] as const;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Navigation carries source hints only; the API proves ownership and current care. */
export function manualChargeSource(route: PortalRoute): ManualChargeSource | null {
  if (route.localPath !== '/manual-charges/new') return null;
  const query = route.query ?? {};
  if (Object.keys(query).length !== fields.length || fields.some(field =>
    !Array.isArray(query[field]) || query[field].length !== 1
      || typeof query[field][0] !== 'string' || !uuid.test(query[field][0]))) return null;
  return {
    patientId: query['patientId'][0].toLowerCase(), appointmentId: query['appointmentId'][0].toLowerCase(),
    procedureId: query['procedureId'][0].toLowerCase(), sourceRecordId: query['sourceRecordId'][0].toLowerCase(),
  };
}
