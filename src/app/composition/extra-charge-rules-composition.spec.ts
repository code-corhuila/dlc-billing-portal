import '@angular/compiler';
import {
  Injector,
  reflectComponentType,
  runInInjectionContext,
} from '@angular/core';
import { describe, expect, it, vi } from 'vitest';

import {
  BILLING_CONTEXT,
  BillingCompositionRoot,
} from './billing-root.component';
import { provideInvoiceListSource } from '../billing/data/invoice-list-source';
import { ExtraChargeRulesComponent } from '../billing/catalog/pages/extra-charge-rules/extra-charge-rules.component';

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

function setup(
  response: unknown = { ok: true, data: page },
) {
  const request = vi.fn().mockResolvedValue(response);
  const controller = new AbortController();

  const injector = Injector.create({
    providers: [
      provideInvoiceListSource(),
      {
        provide: BILLING_CONTEXT,
        useValue: {
          route: { localPath: '/procedures/rules' },
          signal: controller.signal,
          http: { request },
          session: {
            getSnapshot: () => ({
              state: 'authenticated',
              user: { roles: ['ADMINISTRATOR'] },
            }),
            subscribe: () => () => {},
          },
        },
      },
    ],
  });

  const root = runInInjectionContext(
    injector,
    () => new BillingCompositionRoot(),
  );

  return { root, injector, request, controller };
}

describe('extra charge rules composition', () => {
  it('recognizes only the additional rules route', () => {
    const { root, injector } = setup();

    try {
      expect(root.isExtraChargeRules()).toBe(true);

      root.route.set({
        ...root.route(),
        localPath: '/procedures',
      });

      expect(root.isExtraChargeRules()).toBe(false);
    } finally {
      injector.destroy();
    }
  });

  it('loads rules using the compositor HTTP client', async () => {
    const { root, injector, request } = setup();

    try {
      await root.loadExtraChargeRules();

      expect(request).toHaveBeenCalledWith({
        method: 'GET',
        path: '/api/v1/additional-price-rules',
        signal: expect.any(AbortSignal),
      });

      expect(root.extraChargeRulesReadState()).toEqual({
        status: 'success',
        rules: [rule],
      });
    } finally {
      injector.destroy();
    }
  });

  it('reports an empty successful response', async () => {
    const { root, injector } = setup({
      ok: true,
      data: {
        ...page,
        data: [],
        meta: { ...page.meta, total: 0, totalPages: 0 },
      },
    });

    try {
      await root.loadExtraChargeRules();

      expect(root.extraChargeRulesReadState()).toEqual({
        status: 'success',
        rules: [],
      });
    } finally {
      injector.destroy();
    }
  });

  it('reports HTTP failures without showing stale rules', async () => {
    const { root, injector } = setup({
      ok: false,
      data: null,
    });

    try {
      await root.loadExtraChargeRules();

      expect(root.extraChargeRulesReadState()).toEqual({
        status: 'error',
        rules: [],
      });
    } finally {
      injector.destroy();
    }
  });

  it('does not request rules on unrelated routes', async () => {
    const { root, injector, request } = setup();

    try {
      root.route.set({
        ...root.route(),
        localPath: '/procedures',
      });

      await root.loadExtraChargeRules();

      expect(request).not.toHaveBeenCalled();
    } finally {
      injector.destroy();
    }
  });

  it('ignores a response after leaving the rules route', async () => {
    let resolveRequest!: (value: unknown) => void;
    const { root, injector, request } = setup();

    request.mockReturnValue(
      new Promise(resolve => {
        resolveRequest = resolve;
      }),
    );

    try {
      const pending = root.loadExtraChargeRules();

      expect(root.extraChargeRulesReadState().status)
        .toBe('loading');

      root.route.set({
        ...root.route(),
        localPath: '/procedures',
      });

      resolveRequest({ ok: true, data: page });
      await pending;

      expect(root.extraChargeRulesReadState().status)
        .not.toBe('success');
    } finally {
      injector.destroy();
    }
  });

  it('ignores older responses when a newer load succeeds', async () => {
    let resolveFirst!: (value: unknown) => void;
    const { root, injector, request } = setup();

    request
      .mockImplementationOnce(() => new Promise(resolve => {
        resolveFirst = resolve;
      }))
      .mockResolvedValueOnce({ ok: true, data: page });

    try {
      const first = root.loadExtraChargeRules();
      await root.loadExtraChargeRules();

      resolveFirst({
        ok: true,
        data: {
          ...page,
          data: [],
        },
      });

      await first;

      expect(root.extraChargeRulesReadState()).toEqual({
        status: 'success',
        rules: [rule],
      });
    } finally {
      injector.destroy();
    }
  });

  it('registers the additional rules presentation in the compositor', () => {
    const component = reflectComponentType(BillingCompositionRoot);

    expect(component).not.toBeNull();
    expect(component?.selector).toBeDefined();

    const dependencies = (BillingCompositionRoot as unknown as {
      ɵcmp: {
        dependencies?: Array<unknown> | (() => Array<unknown>);
      };
    }).ɵcmp.dependencies;

    const registered = typeof dependencies === 'function'
      ? dependencies()
      : dependencies ?? [];

    expect(registered).toContain(ExtraChargeRulesComponent);
  });
});