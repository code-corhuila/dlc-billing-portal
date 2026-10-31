import { describe, expect, it, vi } from 'vitest';
import type { PortalContext } from '../../../shell-contract';
import {
  readExtraChargeRulesHttp,
  readExtraChargeRulePage,
} from './extra-charge-rules-http';

type HttpContext = Pick<PortalContext, 'http' | 'signal'>;

const rule = {
  id: '11111111-1111-4111-8111-111111111111',
  code: 'MAT-001',
  itemType: 'ADDITIONAL_MATERIAL',
  unitPrice: '15000.00',
  requiresApproval: false,
  validFrom: '2026-10-31T08:00:00-05:00',
  version: 1,
};

const page = {
  data: [rule],
  meta: {
    page: 1,
    limit: 20,
    total: 1,
    totalPages: 1,
  },
};

function createContext(
  response: unknown = page,
  ok = true,
) {
  const controller = new AbortController();
  const request = vi.fn().mockResolvedValue({
    ok,
    data: response,
  });

  return {
    controller,
    request,
    context: {
      http: { request } as unknown as PortalContext['http'],
      signal: controller.signal,
    } satisfies HttpContext,
  };
}

describe('extra charge rules HTTP adapter', () => {
  it('reads rules through the compositor HTTP context', async () => {
    const { context, request } = createContext();

    const result = await readExtraChargeRulesHttp(context);

    expect(request).toHaveBeenCalledWith({
      method: 'GET',
      path: '/api/v1/additional-price-rules',
      signal: context.signal,
    });
    expect(result).toEqual(page);
  });

  it('accepts an empty paginated result', () => {
    const result = readExtraChargeRulePage({
      data: [],
      meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });

    expect(result.data).toEqual([]);
  });

  it('rejects an invalid page structure', () => {
    expect(() => readExtraChargeRulePage({
      data: {},
      meta: page.meta,
    })).toThrow();
  });

  it('rejects incomplete rules', () => {
    const { unitPrice: _unitPrice, ...incomplete } = rule;

    expect(() => readExtraChargeRulePage({
      ...page,
      data: [incomplete],
    })).toThrow();
  });

  it('rejects unsupported item types', () => {
    expect(() => readExtraChargeRulePage({
      ...page,
      data: [{ ...rule, itemType: 'UNKNOWN' }],
    })).toThrow();
  });

  it('rejects nonpositive prices', () => {
    expect(() => readExtraChargeRulePage({
      ...page,
      data: [{ ...rule, unitPrice: '0.00' }],
    })).toThrow();
  });

  it('rejects malformed COP prices', () => {
    expect(() => readExtraChargeRulePage({
      ...page,
      data: [{ ...rule, unitPrice: '15,000' }],
    })).toThrow();
  });

  it('rejects invalid approval metadata', () => {
    expect(() => readExtraChargeRulePage({
      ...page,
      data: [{ ...rule, requiresApproval: 'false' }],
    })).toThrow();
  });

  it('rejects invalid timestamps', () => {
    expect(() => readExtraChargeRulePage({
      ...page,
      data: [{ ...rule, validFrom: '31/10/2026' }],
    })).toThrow();
  });

  it('rejects invalid versions', () => {
    expect(() => readExtraChargeRulePage({
      ...page,
      data: [{ ...rule, version: 0 }],
    })).toThrow();
  });

  it('rejects invalid pagination metadata', () => {
    expect(() => readExtraChargeRulePage({
      ...page,
      meta: { ...page.meta, page: 0 },
    })).toThrow();
  });

  it('rejects unsuccessful HTTP responses', async () => {
    const { context } = createContext(null, false);

    await expect(readExtraChargeRulesHttp(context))
      .rejects.toThrow();
  });

  it('does not send a request when already cancelled', async () => {
    const { context, controller, request } = createContext();
    controller.abort();

    await expect(readExtraChargeRulesHttp(context))
      .rejects.toThrow();

    expect(request).not.toHaveBeenCalled();
  });

  it('rejects a request cancelled during execution', async () => {
    const { context, controller, request } = createContext();

    request.mockImplementation(async () => {
      controller.abort();
      return { ok: true, data: page };
    });

    await expect(readExtraChargeRulesHttp(context))
      .rejects.toThrow();
  });
});
