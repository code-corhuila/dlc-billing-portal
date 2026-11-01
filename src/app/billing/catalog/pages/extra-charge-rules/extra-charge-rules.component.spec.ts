import '@angular/compiler';
import { Injector, runInInjectionContext } from '@angular/core';
import { describe, expect, it, vi } from 'vitest';

import type { HttpExtraChargeRule } from '../../data/extra-charge-rules-http';
import { ExtraChargeRulesComponent } from './extra-charge-rules.component';

const httpRule: HttpExtraChargeRule = {
  id: 'http-rule-001',
  code: 'REAL-001',
  itemType: 'ADDITIONAL_MATERIAL',
  unitPrice: '150000.00' as HttpExtraChargeRule['unitPrice'],
  requiresApproval: true,
  validFrom: '2026-10-01T00:00:00Z',
  version: 1,
};

function createPage(): {
  page: ExtraChargeRulesComponent;
  destroy: () => void;
} {
  const injector = Injector.create({ providers: [] });

  return {
    page: runInInjectionContext(
      injector,
      () => new ExtraChargeRulesComponent(),
    ),
    destroy: () => injector.destroy(),
  };
}

describe('ExtraChargeRulesComponent HTTP composed mode', () => {
  it('displays HTTP rules instead of demo fixtures', () => {
    const { page, destroy } = createPage();

    try {
      page.composed = true;
      page.httpRules = [httpRule];
      page.httpReadStatus = 'success';

      expect(page.displayedRules.map(rule => rule.id)).toEqual([
        'http-rule-001',
      ]);
      expect(page.displayedRules[0].code).toBe('REAL-001');
    } finally {
      destroy();
    }
  });

  it('never falls back to demo fixtures on empty or error responses', () => {
    const { page, destroy } = createPage();

    try {
      page.composed = true;
      page.httpRules = [];
      page.httpReadStatus = 'success';

      expect(page.displayedRules).toEqual([]);

      page.httpReadStatus = 'error';

      expect(page.displayedRules).toEqual([]);
    } finally {
      destroy();
    }
  });

  it('does not display stale rules while loading', () => {
    const { page, destroy } = createPage();

    try {
      page.composed = true;
      page.httpRules = [httpRule];
      page.httpReadStatus = 'loading';

      expect(page.displayedRules).toEqual([]);
    } finally {
      destroy();
    }
  });

  it('blocks demo creation and simulation in composed mode', () => {
    vi.useFakeTimers();
    const { page, destroy } = createPage();

    try {
      page.composed = true;

      page.openForm();
      page.simulateEmpty();
      page.simulateError();
      page.restoreFixtures();

      expect(page.formVisible()).toBe(false);
      expect(page.errorMessage()).toBe('');
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      destroy();
      vi.useRealTimers();
    }
  });

  it('preserves standalone demo fixtures', () => {
    const { page, destroy } = createPage();

    try {
      expect(page.composed).toBe(false);
      expect(page.displayedRules.length).toBeGreaterThan(0);
    } finally {
      destroy();
    }
  });

  it('provides HTTP rule details for the composed presentation', () => {
    const { page, destroy } = createPage();

    try {
      page.composed = true;
      page.httpRules = [httpRule];
      page.httpReadStatus = 'success';

      expect(page.displayedRules).toEqual([httpRule]);
      expect(page.composedRuleDetails).toEqual([{
        code: 'REAL-001',
        itemType: 'ADDITIONAL_MATERIAL',
        unitPrice: '150000.00',
        requiresApproval: true,
        validFrom: '2026-10-01T00:00:00Z',
        version: 1,
      }]);
    } finally {
      destroy();
    }
  });

  it('exposes loading, error and empty HTTP presentation states', () => {
    const { page, destroy } = createPage();

    try {
      page.composed = true;
      page.httpRules = [];

      page.httpReadStatus = 'loading';
      expect(page.composedReadMessage).toBe(
        'Cargando reglas adicionales...',
      );

      page.httpReadStatus = 'error';
      expect(page.composedReadMessage).toBe(
        'No fue posible cargar las reglas adicionales.',
      );

      page.httpReadStatus = 'success';
      expect(page.composedReadMessage).toBe(
        'No hay reglas adicionales para mostrar.',
      );
    } finally {
      destroy();
    }
  });
});