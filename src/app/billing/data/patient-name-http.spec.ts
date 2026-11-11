import { describe, expect, it, vi } from 'vitest';
import { readPatientName } from './patient-name-http';
import type { PortalContext } from '../../shell-contract';

describe('patient name lookup', () => {
  it('uses the name returned for the requested patient', async () => {
    const request = vi.fn(async () => ({ ok: true, data: { id: 'p-1', name: 'Nombre Real' } }));
    const context = { http: { request }, signal: new AbortController().signal } as unknown as PortalContext;
    expect(await readPatientName(context, 'p-1')).toBe('Nombre Real');
    expect(request).toHaveBeenCalledWith(expect.objectContaining({ path: '/api/v1/patients/p-1' }));
  });
  it('does not substitute a different patient and tolerates unavailable Patients', async () => {
    const request = vi.fn().mockResolvedValueOnce({ ok: true, data: { id: 'other', name: 'Otro' } }).mockRejectedValueOnce(new Error('offline'));
    const context = { http: { request }, signal: new AbortController().signal } as unknown as PortalContext;
    expect(await readPatientName(context, 'p-1')).toBeUndefined();
    expect(await readPatientName(context, 'p-1')).toBeUndefined();
  });
});
