import { describe, expect, it } from 'vitest';

import {
  EncounterAccount,
  EncounterAccountStatus,
  canAcceptChargeSource,
  completeEncounterCharges,
  declareEncounterSources,
  isEncounterChargesComplete,
  registerEncounterChargeSource,
} from './encounter-account';

describe('encounter account rules', () => {
  const createOpenAccount = (): EncounterAccount => ({
    status: 'OPEN',
    declaredProcedureIds: [],
    declaredManualChargeIds: [],
    chargedProcedureIds: [],
    chargedManualChargeIds: [],
  });

  it('declares the fixed procedure and manual charge source lists', () => {
    const account = createOpenAccount();

    const declared = declareEncounterSources(
      account,
      ['procedure-1', 'procedure-2'],
      ['manual-charge-1'],
    );

    expect(declared.status).toBe('DECLARED');
    expect(declared.declaredProcedureIds).toEqual([
      'procedure-1',
      'procedure-2',
    ]);
    expect(declared.declaredManualChargeIds).toEqual([
      'manual-charge-1',
    ]);
  });

  it('accepts only declared sources after the encounter is declared', () => {
    const account = declareEncounterSources(
      createOpenAccount(),
      ['procedure-1'],
      ['manual-charge-1'],
    );

    expect(
      canAcceptChargeSource(
        account,
        'procedure',
        'procedure-1',
      ),
    ).toBe(true);

    expect(
      canAcceptChargeSource(
        account,
        'manual',
        'manual-charge-1',
      ),
    ).toBe(true);

    expect(
      canAcceptChargeSource(
        account,
        'procedure',
        'procedure-2',
      ),
    ).toBe(false);

    expect(
      canAcceptChargeSource(
        account,
        'manual',
        'manual-charge-2',
      ),
    ).toBe(false);
  });

  it('registers a declared procedure charge', () => {
    const account = declareEncounterSources(
      createOpenAccount(),
      ['procedure-1'],
      [],
    );

    const updated = registerEncounterChargeSource(
      account,
      'procedure',
      'procedure-1',
    );

    expect(updated.chargedProcedureIds).toEqual([
      'procedure-1',
    ]);
  });

  it('registers a declared manual charge', () => {
    const account = declareEncounterSources(
      createOpenAccount(),
      [],
      ['manual-charge-1'],
    );

    const updated = registerEncounterChargeSource(
      account,
      'manual',
      'manual-charge-1',
    );

    expect(updated.chargedManualChargeIds).toEqual([
      'manual-charge-1',
    ]);
  });

  it('ignores a charge source that was not declared', () => {
    const account = declareEncounterSources(
      createOpenAccount(),
      ['procedure-1'],
      [],
    );

    const updated = registerEncounterChargeSource(
      account,
      'procedure',
      'procedure-2',
    );

    expect(updated).toEqual(account);
  });

  it('does not register the same procedure charge twice', () => {
    const account: EncounterAccount = {
      status: 'DECLARED',
      declaredProcedureIds: ['procedure-1'],
      declaredManualChargeIds: [],
      chargedProcedureIds: ['procedure-1'],
      chargedManualChargeIds: [],
    };

    const updated = registerEncounterChargeSource(
      account,
      'procedure',
      'procedure-1',
    );

    expect(updated.chargedProcedureIds).toEqual([
      'procedure-1',
    ]);
  });

  it('does not register the same manual charge twice', () => {
    const account: EncounterAccount = {
      status: 'DECLARED',
      declaredProcedureIds: [],
      declaredManualChargeIds: ['manual-charge-1'],
      chargedProcedureIds: [],
      chargedManualChargeIds: ['manual-charge-1'],
    };

    const updated = registerEncounterChargeSource(
      account,
      'manual',
      'manual-charge-1',
    );

    expect(updated.chargedManualChargeIds).toEqual([
      'manual-charge-1',
    ]);
  });

  it('supports declared charges arriving in any order', () => {
    let account = declareEncounterSources(
      createOpenAccount(),
      ['procedure-1', 'procedure-2'],
      ['manual-charge-1'],
    );

    account = registerEncounterChargeSource(
      account,
      'procedure',
      'procedure-2',
    );

    account = registerEncounterChargeSource(
      account,
      'manual',
      'manual-charge-1',
    );

    account = registerEncounterChargeSource(
      account,
      'procedure',
      'procedure-1',
    );

    expect(account.chargedProcedureIds).toEqual([
      'procedure-2',
      'procedure-1',
    ]);
    expect(account.chargedManualChargeIds).toEqual([
      'manual-charge-1',
    ]);
    expect(isEncounterChargesComplete(account)).toBe(true);
  });

  it('does not complete while declared sources are still missing charges', () => {
    const account: EncounterAccount = {
      status: 'DECLARED',
      declaredProcedureIds: [
        'procedure-1',
        'procedure-2',
      ],
      declaredManualChargeIds: [
        'manual-charge-1',
      ],
      chargedProcedureIds: [
        'procedure-1',
      ],
      chargedManualChargeIds: [
        'manual-charge-1',
      ],
    };

    expect(
      isEncounterChargesComplete(account),
    ).toBe(false);

    expect(
      completeEncounterCharges(account).status,
    ).toBe('DECLARED');
  });

  it('completes when all declared procedures and manual charges have charges', () => {
    const account: EncounterAccount = {
      status: 'DECLARED',
      declaredProcedureIds: [
        'procedure-1',
        'procedure-2',
      ],
      declaredManualChargeIds: [
        'manual-charge-1',
      ],
      chargedProcedureIds: [
        'procedure-1',
        'procedure-2',
      ],
      chargedManualChargeIds: [
        'manual-charge-1',
      ],
    };

    expect(
      isEncounterChargesComplete(account),
    ).toBe(true);

    expect(
      completeEncounterCharges(account).status,
    ).toBe('CHARGES_COMPLETED');
  });

  it('keeps a completed account completed when completion is evaluated again', () => {
    const account: EncounterAccount = {
      status: 'CHARGES_COMPLETED',
      declaredProcedureIds: [
        'procedure-1',
      ],
      declaredManualChargeIds: [],
      chargedProcedureIds: [
        'procedure-1',
      ],
      chargedManualChargeIds: [],
    };

    expect(
      completeEncounterCharges(account).status,
    ).toBe('CHARGES_COMPLETED');
  });

  it('does not accept new charge sources after charges are completed', () => {
    const account: EncounterAccount = {
      status: 'CHARGES_COMPLETED',
      declaredProcedureIds: [
        'procedure-1',
      ],
      declaredManualChargeIds: [],
      chargedProcedureIds: [
        'procedure-1',
      ],
      chargedManualChargeIds: [],
    };

    expect(
      canAcceptChargeSource(
        account,
        'procedure',
        'procedure-1',
      ),
    ).toBe(false);
  });

  it('does not register charges after charges are completed', () => {
    const account: EncounterAccount = {
      status: 'CHARGES_COMPLETED',
      declaredProcedureIds: [
        'procedure-1',
      ],
      declaredManualChargeIds: [],
      chargedProcedureIds: [
        'procedure-1',
      ],
      chargedManualChargeIds: [],
    };

    const updated = registerEncounterChargeSource(
      account,
      'procedure',
      'procedure-1',
    );

    expect(updated).toEqual(account);
  });

  it('defines only the encounter account lifecycle states', () => {
    const statuses: EncounterAccountStatus[] = [
      'OPEN',
      'DECLARED',
      'CHARGES_COMPLETED',
    ];

    expect(statuses).toEqual([
      'OPEN',
      'DECLARED',
      'CHARGES_COMPLETED',
    ]);
  });
});