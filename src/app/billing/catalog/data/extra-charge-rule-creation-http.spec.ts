import { describe, expect, it, vi } from 'vitest';
import type { PortalContext } from '../../../shell-contract';
import { copMoney } from '../../model/cop-money';
import { createExtraChargeRuleHttp } from './extra-charge-rules-http';

const body = { code: 'MAT-001', itemType: 'ADDITIONAL_MATERIAL' as const,
  unitPrice: copMoney('15000.01'), requiresApproval: false as const,
  validFrom: '2026-11-05T13:00:00Z' };
const key = 'b0b2bd09-fd8d-433b-90c5-af78215224fb';
const rule = { id: '11111111-1111-4111-8111-111111111111', ...body, version: 1 };
function setup(status = 201, data: unknown = rule) {
  const controller = new AbortController();
  const request = vi.fn().mockResolvedValue({ ok: status === 201, status, data });
  const context = { http: { request }, signal: controller.signal } as unknown as
    Pick<PortalContext, 'http' | 'signal'>;
  return { context, request, controller };
}
describe('additional rule creation HTTP adapter', () => {
  it('uses the shared HTTP client and preserves exact money and key', async () => {
    const { context, request } = setup();
    expect(await createExtraChargeRuleHttp(context, body, key)).toEqual(rule);
    expect(request).toHaveBeenCalledExactlyOnceWith({
      method: 'POST', path: '/api/v1/additional-price-rules',
      body, headers: { 'Idempotency-Key': key }, signal: context.signal,
    });
  });
  it.each([
    { ...body, requiresApproval: true },
    { ...body, itemType: 'UNSUPPORTED' },
    { ...body, unitPrice: '0.00' },
    { ...body, unitPrice: 15000.01 },
    { ...body, code: ' ' },
    { ...body, validFrom: 'invalid' },
  ])('rejects invalid data before HTTP: %j', async invalid => {
    const { context, request } = setup();
    await expect(createExtraChargeRuleHttp(context, invalid as typeof body, key)).rejects.toThrow();
    expect(request).not.toHaveBeenCalled();
  });
  it.each(['invalid', '1-1-1-1-1'])('requires a UUID key: %s', async invalid => {
    const { context, request } = setup();
    await expect(createExtraChargeRuleHttp(context, body, invalid)).rejects.toThrow();
    expect(request).not.toHaveBeenCalled();
  });
  it.each([400, 401, 403, 409, 503])('rejects unsuccessful status %i', async status => {
    const { context } = setup(status);
    await expect(createExtraChargeRuleHttp(context, body, key)).rejects.toThrow();
  });
  it.each([{ ...rule, requiresApproval: true }, { ...rule, id: 'invalid' },
    { ...rule, unitPrice: '0.00' }])('does not accept an invalid creation response', async data => {
    const { context } = setup(201, data);
    await expect(createExtraChargeRuleHttp(context, body, key)).rejects.toThrow();
  });
  it('does not send a cancelled request or accept a late response', async () => {
    const { context, request, controller } = setup();
    controller.abort();
    await expect(createExtraChargeRuleHttp(context, body, key)).rejects.toThrow();
    expect(request).not.toHaveBeenCalled();
    const pending = setup();
    pending.request.mockImplementation(async () => {
      pending.controller.abort();
      return { ok: true, status: 201, data: rule };
    });
    await expect(createExtraChargeRuleHttp(pending.context, body, key)).rejects.toThrow();
  });
});
