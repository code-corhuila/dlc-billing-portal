import '@angular/compiler';
import { Injector, runInInjectionContext } from '@angular/core';
import { describe, expect, it, vi } from 'vitest';
import { BILLING_CONTEXT, BillingCompositionRoot } from './billing-root.component';
import { provideInvoiceListSource } from '../billing/data/invoice-list-source';
import { copMoney } from '../billing/model/cop-money';

const actor = '11111111-1111-4111-8111-111111111111';
const body = { code: 'MAT-001', itemType: 'ADDITIONAL_MATERIAL' as const,
  unitPrice: copMoney('15000.01'), requiresApproval: false as const, validFrom: '2026-11-05T13:00:00Z' };
const rule = { id: '22222222-2222-4222-8222-222222222222', ...body, version: 1 };
const page = { data: [rule], meta: { page: 1, limit: 20, total: 1, totalPages: 1 } };
function setup() {
  const request = vi.fn().mockImplementation(async (input: { method: string }) =>
    ({ ok: true, status: input.method === 'POST' ? 201 : 200, data: input.method === 'POST' ? rule : page }));
  const controller = new AbortController();
  const reportFailure = vi.fn();
  const session = { state: 'authenticated', revision: 1, user: { id: actor, name: 'Admin',
    roles: ['ADMINISTRATOR'] }, permissions: [], expiresAt: null, reason: null };
  const injector = Injector.create({ providers: [provideInvoiceListSource(), {
    provide: BILLING_CONTEXT, useValue: {
      route: { localPath: '/procedures/rules', compositionId: 'billing' }, signal: controller.signal,
      http: { request }, reportFailure, session: { getSnapshot: () => session, subscribe: () => () => {} },
    },
  }] });
  const root = runInInjectionContext(injector, () => new BillingCompositionRoot());
  return { root, injector, request, reportFailure, controller };
}
describe('additional rule creation composition', () => {
  it('creates through shared HTTP, reloads, confirms the form, and blocks leaving while writing', async () => {
    const s = setup();
    try {
      const pending = s.root.requestExtraChargeRuleCreation(body);
      expect(s.root.creatingExtraChargeRule()).toBe(true);
      expect(s.root.canLeave()).toBe(false);
      await pending;
      expect(s.request.mock.calls.map(([request]) => request.method)).toEqual(['POST', 'GET']);
      expect(s.root.createdExtraChargeRule()?.id).toBe(rule.id);
      expect(s.root.extraChargeRulesReadState().rules).toEqual([rule]);
      expect(s.root.canLeave()).toBe(true);
    } finally { s.injector.destroy(); }
  });
  it('reuses the key after an uncertain failure with the same request', async () => {
    const s = setup();
    try {
      s.request.mockResolvedValueOnce({ ok: false, status: 0, kind: 'network' });
      await s.root.requestExtraChargeRuleCreation(body);
      expect(s.root.createdExtraChargeRule()).toBeNull();
      await s.root.requestExtraChargeRuleCreation(body);
      const posts = s.request.mock.calls.map(([request]) => request).filter(r => r.method === 'POST');
      expect(posts[0].headers['Idempotency-Key']).toBe(posts[1].headers['Idempotency-Key']);
      expect(s.root.createdExtraChargeRule()?.id).toBe(rule.id);
    } finally { s.injector.destroy(); }
  });
  it('does not reuse an attempt for changed data or a different actor', async () => {
    const s = setup();
    try {
      s.request.mockResolvedValue({ ok: false, status: 409 });
      await s.root.requestExtraChargeRuleCreation(body);
      await s.root.requestExtraChargeRuleCreation({ ...body, unitPrice: copMoney('15001.00') });
      s.root.session.set({ ...s.root.session(), user: { id: '33333333-3333-4333-8333-333333333333',
        name: 'Other admin', roles: ['ADMINISTRATOR'] } });
      await s.root.requestExtraChargeRuleCreation({ ...body, unitPrice: copMoney('15001.00') });
      const keys = s.request.mock.calls.map(([request]) => request.headers['Idempotency-Key']);
      expect(new Set(keys).size).toBe(3);
    } finally { s.injector.destroy(); }
  });
  it('denies non-admin, unrelated-route, and cancelled writes', async () => {
    const s = setup();
    try {
      s.root.session.set({ ...s.root.session(), user: { id: actor, name: 'Reader', roles: ['SECRETARY_ASSISTANT'] } });
      await s.root.requestExtraChargeRuleCreation(body);
      s.root.session.set({ ...s.root.session(), user: { id: actor, name: 'Admin', roles: ['ADMINISTRATOR'] } });
      s.root.route.set({ ...s.root.route(), localPath: '/procedures' });
      await s.root.requestExtraChargeRuleCreation(body);
      s.root.route.set({ ...s.root.route(), localPath: '/procedures/rules' });
      s.controller.abort(); await s.root.requestExtraChargeRuleCreation(body);
      expect(s.request).not.toHaveBeenCalled();
    } finally { s.injector.destroy(); }
  });
  it('does not duplicate a pending request or publish a response for another actor', async () => {
    const s = setup();
    let resolve!: (value: unknown) => void;
    s.request.mockImplementationOnce(() => new Promise(r => { resolve = r; }));
    try {
      const pending = s.root.requestExtraChargeRuleCreation(body);
      await s.root.requestExtraChargeRuleCreation(body);
      expect(s.request).toHaveBeenCalledTimes(1);
      s.root.session.set({ ...s.root.session(), user: { id: '33333333-3333-4333-8333-333333333333',
        name: 'Other admin', roles: ['ADMINISTRATOR'] } });
      resolve({ ok: true, status: 201, data: rule }); await pending;
      expect(s.root.createdExtraChargeRule()).toBeNull();
      expect(s.request).toHaveBeenCalledTimes(1);
    } finally { s.injector.destroy(); }
  });
  it('keeps a confirmed write successful when catalog reloading fails', async () => {
    const s = setup();
    try {
      s.request.mockResolvedValueOnce({ ok: true, status: 201, data: rule })
        .mockResolvedValueOnce({ ok: false, status: 503 });
      await s.root.requestExtraChargeRuleCreation(body);
      expect(s.root.createdExtraChargeRule()?.id).toBe(rule.id);
      expect(s.root.extraChargeRuleMessage()).toContain('registrada');
      expect(s.reportFailure).not.toHaveBeenCalled();
    } finally { s.injector.destroy(); }
  });
  it('does not publish a read response after the session loses access', async () => {
    const s = setup();
    let resolve!: (value: unknown) => void;
    s.request.mockImplementationOnce(() => new Promise(r => { resolve = r; }));
    try {
      const pending = s.root.loadExtraChargeRules();
      s.root.session.set({ ...s.root.session(), state: 'anonymous', user: null });
      resolve({ ok: true, status: 200, data: page }); await pending;
      expect(s.root.extraChargeRulesReadState().rules).toEqual([]);
    } finally { s.injector.destroy(); }
  });
});
