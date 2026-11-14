import '@angular/compiler';
import { Injector, runInInjectionContext } from '@angular/core';
import { describe, expect, it, vi } from 'vitest';
import { ExtraChargeRuleCreateFormComponent } from './extra-charge-rule-create-form.component';

function setup() {
  const injector = Injector.create({ providers: [] });
  const form = runInInjectionContext(injector, () => new ExtraChargeRuleCreateFormComponent());
  const emitted = vi.fn();
  form.createRule.subscribe(emitted);
  form.canManageRules = true;
  form.open();
  form.form = { code: 'MAT-001', itemType: 'ADDITIONAL_MATERIAL',
    unitPrice: '999999999999.99', validFrom: '2026-11-05T08:30' };
  return { form, emitted, injector };
}
describe('additional rule creation form', () => {
  it('emits exact money and the contract fields without creating local records', () => {
    const { form, emitted, injector } = setup();
    try {
      form.submit();
      expect(emitted).toHaveBeenCalledExactlyOnceWith({
        code: 'MAT-001', itemType: 'ADDITIONAL_MATERIAL', unitPrice: '999999999999.99',
        requiresApproval: false, validFrom: new Date('2026-11-05T08:30').toISOString(),
      });
      expect(form.dirty).toBe(true);
      form.savedRule = { id: '11111111-1111-4111-8111-111111111111',
        ...emitted.mock.calls[0][0], version: 1 };
      expect(form.dirty).toBe(false);
      expect(form.form.unitPrice).toBe('');
    } finally { injector.destroy(); }
  });
  it.each([{ unitPrice: '0.00' }, { unitPrice: '1.001' }, { unitPrice: '1e3' },
    { unitPrice: '15,000' }, { code: ' ' }, { code: 'X'.repeat(81) },
    { validFrom: '2026-02-30T08:30' }, { validFrom: 'invalid' }, { itemType: 'UNKNOWN' }])(
    'blocks invalid input %j', invalid => {
      const { form, emitted, injector } = setup();
      try { Object.assign(form.form, invalid); form.submit(); expect(emitted).not.toHaveBeenCalled(); }
      finally { injector.destroy(); }
    });
  it('blocks writes and discards drafts after permission loss', () => {
    const { form, emitted, injector } = setup();
    try {
      form.canManageRules = false;
      form.open(); form.submit();
      expect(form.dirty).toBe(false);
      expect(emitted).not.toHaveBeenCalled();
    } finally { injector.destroy(); }
  });
  it('blocks duplicate submission and dismissal while saving', () => {
    const { form, emitted, injector } = setup();
    try {
      form.creating = true;
      form.submit(); form.close();
      const cancel = { preventDefault: vi.fn() };
      form.onCancel(cancel as unknown as Event);
      expect(form.dirty).toBe(true);
      expect(emitted).not.toHaveBeenCalled();
      expect(cancel.preventDefault).toHaveBeenCalledOnce();
      form.creating = false; form.close();
      expect(form.dirty).toBe(false);
    } finally { injector.destroy(); }
  });
  it('cannot submit after destruction', () => {
    const { form, emitted, injector } = setup();
    injector.destroy(); form.submit();
    expect(emitted).not.toHaveBeenCalled();
  });
});
