import { describe, expect, it } from 'vitest';

import {
  canAcceptChargeSource,
  completeEncounterCharges,
  createEncounterAccount,
  declareEncounterSources,
  isEncounterChargesComplete,
  registerEncounterChargeSource,
  type EncounterAccount,
  type EncounterAccountStatus,
} from './encounter-account';

function createOpenAccount(): EncounterAccount {
  return {
    status: 'OPEN',
    declaredProcedureIds: [],
    declaredManualChargeIds: [],
    chargedProcedureIds: [],
    chargedManualChargeIds: [],
  };
}

function createDeclaredAccount(): EncounterAccount {
  return {
    status: 'DECLARED',
    declaredProcedureIds: [
      'procedure-001',
      'procedure-002',
    ],
    declaredManualChargeIds: [
      'manual-charge-001',
    ],
    chargedProcedureIds: [],
    chargedManualChargeIds: [],
  };
}

describe('encounter account rules', () => {
  it('creates an encounter account with its encounter identity and references', () => {
    const account = createEncounterAccount({
      clinicalRecordId: 'clinical-record-001',
      consultationId: 'consultation-001',
      appointmentId: 'appointment-001',
      patientId: 'patient-001',
    });

    expect(account).toEqual({
      clinicalRecordId: 'clinical-record-001',
      consultationId: 'consultation-001',
      appointmentId: 'appointment-001',
      patientId: 'patient-001',
      status: 'OPEN',
      declaredProcedureIds: [],
      declaredManualChargeIds: [],
      chargedProcedureIds: [],
      chargedManualChargeIds: [],
    });
  });

  it('keeps clinical record and consultation as the encounter identity', () => {
    const account = createEncounterAccount({
      clinicalRecordId: 'clinical-record-101',
      consultationId: 'consultation-202',
      appointmentId: 'appointment-303',
      patientId: 'patient-404',
    });

    expect(account.clinicalRecordId).toBe(
      'clinical-record-101',
    );
    expect(account.consultationId).toBe(
      'consultation-202',
    );
  });

  it('declares the fixed procedure and manual charge source lists', () => {
    const account = createOpenAccount();

    const declared = declareEncounterSources(
      account,
      ['procedure-001', 'procedure-002'],
      ['manual-charge-001'],
    );

    expect(declared.status).toBe('DECLARED');
    expect(declared.declaredProcedureIds).toEqual([
      'procedure-001',
      'procedure-002',
    ]);
    expect(
      declared.declaredManualChargeIds,
    ).toEqual([
      'manual-charge-001',
    ]);
  });

  it('accepts only declared sources after the encounter is declared', () => {
    const account = createDeclaredAccount();

    expect(
      canAcceptChargeSource(
        account,
        'procedure',
        'procedure-001',
      ),
    ).toBe(true);

    expect(
      canAcceptChargeSource(
        account,
        'procedure',
        'procedure-999',
      ),
    ).toBe(false);

    expect(
      canAcceptChargeSource(
        account,
        'manual',
        'manual-charge-001',
      ),
    ).toBe(true);

    expect(
      canAcceptChargeSource(
        account,
        'manual',
        'manual-charge-999',
      ),
    ).toBe(false);
  });

  it('registers a declared procedure charge', () => {
    const account = createDeclaredAccount();

    const updated =
      registerEncounterChargeSource(
        account,
        'procedure',
        'procedure-001',
      );

    expect(updated.chargedProcedureIds).toEqual([
      'procedure-001',
    ]);
    expect(
      updated.chargedManualChargeIds,
    ).toEqual([]);
  });

  it('registers a declared manual charge', () => {
    const account = createDeclaredAccount();

    const updated =
      registerEncounterChargeSource(
        account,
        'manual',
        'manual-charge-001',
      );

    expect(
      updated.chargedManualChargeIds,
    ).toEqual([
      'manual-charge-001',
    ]);
    expect(updated.chargedProcedureIds).toEqual([]);
  });

  it('ignores a charge source that was not declared', () => {
    const account = createDeclaredAccount();

    const updated =
      registerEncounterChargeSource(
        account,
        'procedure',
        'procedure-999',
      );

    expect(updated).toBe(account);
  });

  it('does not register the same procedure charge twice', () => {
    const account: EncounterAccount = {
      ...createDeclaredAccount(),
      chargedProcedureIds: [
        'procedure-001',
      ],
    };

    const updated =
      registerEncounterChargeSource(
        account,
        'procedure',
        'procedure-001',
      );

    expect(updated).toBe(account);
    expect(updated.chargedProcedureIds).toEqual([
      'procedure-001',
    ]);
  });

  it('does not register the same manual charge twice', () => {
    const account: EncounterAccount = {
      ...createDeclaredAccount(),
      chargedManualChargeIds: [
        'manual-charge-001',
      ],
    };

    const updated =
      registerEncounterChargeSource(
        account,
        'manual',
        'manual-charge-001',
      );

    expect(updated).toBe(account);
    expect(
      updated.chargedManualChargeIds,
    ).toEqual([
      'manual-charge-001',
    ]);
  });

  it('supports declared charges arriving in any order', () => {
    const account = createDeclaredAccount();

    const withManual =
      registerEncounterChargeSource(
        account,
        'manual',
        'manual-charge-001',
      );

    const withSecondProcedure =
      registerEncounterChargeSource(
        withManual,
        'procedure',
        'procedure-002',
      );

    const withFirstProcedure =
      registerEncounterChargeSource(
        withSecondProcedure,
        'procedure',
        'procedure-001',
      );

    expect(
      withFirstProcedure.chargedProcedureIds,
    ).toEqual([
      'procedure-002',
      'procedure-001',
    ]);

    expect(
      withFirstProcedure.chargedManualChargeIds,
    ).toEqual([
      'manual-charge-001',
    ]);

    expect(
      isEncounterChargesComplete(
        withFirstProcedure,
      ),
    ).toBe(true);
  });

  it('does not complete while declared sources are still missing charges', () => {
    const account: EncounterAccount = {
      ...createDeclaredAccount(),
      chargedProcedureIds: [
        'procedure-001',
      ],
      chargedManualChargeIds: [
        'manual-charge-001',
      ],
    };

    expect(
      isEncounterChargesComplete(account),
    ).toBe(false);

    expect(
      completeEncounterCharges(account),
    ).toBe(account);
  });

  it('completes when all declared procedures and manual charges have charges', () => {
    const account: EncounterAccount = {
      ...createDeclaredAccount(),
      chargedProcedureIds: [
        'procedure-001',
        'procedure-002',
      ],
      chargedManualChargeIds: [
        'manual-charge-001',
      ],
    };

    const completed =
      completeEncounterCharges(account);

    expect(completed.status).toBe(
      'CHARGES_COMPLETED',
    );
  });

  it('keeps a completed account completed when completion is evaluated again', () => {
    const account: EncounterAccount = {
      ...createDeclaredAccount(),
      status: 'CHARGES_COMPLETED',
      chargedProcedureIds: [
        'procedure-001',
        'procedure-002',
      ],
      chargedManualChargeIds: [
        'manual-charge-001',
      ],
    };

    const completed =
      completeEncounterCharges(account);

    expect(completed).toBe(account);
    expect(completed.status).toBe(
      'CHARGES_COMPLETED',
    );
  });

  it('does not accept new charge sources after charges are completed', () => {
    const account: EncounterAccount = {
      ...createDeclaredAccount(),
      status: 'CHARGES_COMPLETED',
      chargedProcedureIds: [
        'procedure-001',
        'procedure-002',
      ],
      chargedManualChargeIds: [
        'manual-charge-001',
      ],
    };

    expect(
      canAcceptChargeSource(
        account,
        'procedure',
        'procedure-001',
      ),
    ).toBe(false);

    expect(
      canAcceptChargeSource(
        account,
        'manual',
        'manual-charge-001',
      ),
    ).toBe(false);
  });

  it('does not register charges after charges are completed', () => {
    const account: EncounterAccount = {
      ...createDeclaredAccount(),
      status: 'CHARGES_COMPLETED',
      chargedProcedureIds: [
        'procedure-001',
        'procedure-002',
      ],
      chargedManualChargeIds: [
        'manual-charge-001',
      ],
    };

    const updated =
      registerEncounterChargeSource(
        account,
        'procedure',
        'procedure-001',
      );

    expect(updated).toBe(account);
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