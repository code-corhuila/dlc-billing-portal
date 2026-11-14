

export type EncounterAccountStatus =
  | 'OPEN'
  | 'DECLARED'
  | 'CHARGES_COMPLETED';

export type EncounterChargeSourceType =
  | 'procedure'
  | 'manual';

export interface EncounterAccountIdentity {
  clinicalRecordId: string;
  consultationId: string;
  appointmentId: string;
  patientId: string;
}

export interface EncounterAccount {
  clinicalRecordId?: string;
  consultationId?: string;
  appointmentId?: string;
  patientId?: string;
  status: EncounterAccountStatus;
  declaredProcedureIds: string[];
  declaredManualChargeIds: string[];
  chargedProcedureIds: string[];
  chargedManualChargeIds: string[];
}

export function createEncounterAccount(
  identity: EncounterAccountIdentity,
): EncounterAccount {
  return {
    clinicalRecordId: identity.clinicalRecordId,
    consultationId: identity.consultationId,
    appointmentId: identity.appointmentId,
    patientId: identity.patientId,
    status: 'OPEN',
    declaredProcedureIds: [],
    declaredManualChargeIds: [],
    chargedProcedureIds: [],
    chargedManualChargeIds: [],
  };
}

export function declareEncounterSources(
  account: EncounterAccount,
  procedureIds: string[],
  manualChargeIds: string[],
): EncounterAccount {
  if (account.status !== 'OPEN') {
    return account;
  }

  return {
    ...account,
    status: 'DECLARED',
    declaredProcedureIds: [...procedureIds],
    declaredManualChargeIds: [...manualChargeIds],
  };
}

export function canAcceptChargeSource(
  account: EncounterAccount,
  sourceType: EncounterChargeSourceType,
  sourceId: string,
): boolean {
  return account.status === 'OPEN';
}

export function registerEncounterChargeSource(
  account: EncounterAccount,
  sourceType: EncounterChargeSourceType,
  sourceId: string,
): EncounterAccount {
  if (
    !canAcceptChargeSource(
      account,
      sourceType,
      sourceId,
    )
  ) {
    return account;
  }

  if (sourceType === 'procedure') {
    if (
      account.chargedProcedureIds.includes(
        sourceId,
      )
    ) {
      return account;
    }

    return {
      ...account,
      chargedProcedureIds: [
        ...account.chargedProcedureIds,
        sourceId,
      ],
    };
  }

  if (
    account.chargedManualChargeIds.includes(
      sourceId,
    )
  ) {
    return account;
  }

  return {
    ...account,
    chargedManualChargeIds: [
      ...account.chargedManualChargeIds,
      sourceId,
    ],
  };
}

export function isEncounterChargesComplete(
  account: EncounterAccount,
): boolean {
  if (account.status === 'OPEN') {
    return false;
  }

  const hasAllProcedureCharges =
    account.declaredProcedureIds.every(
      (procedureId) =>
        account.chargedProcedureIds.includes(
          procedureId,
        ),
    );

  const hasAllManualCharges =
    account.declaredManualChargeIds.every(
      (manualChargeId) =>
        account.chargedManualChargeIds.includes(
          manualChargeId,
        ),
    );

  return (
    hasAllProcedureCharges &&
    hasAllManualCharges
  );
}

export function completeEncounterCharges(
  account: EncounterAccount,
): EncounterAccount {
  if (
    account.status ===
    'CHARGES_COMPLETED'
  ) {
    return account;
  }

  if (
    !isEncounterChargesComplete(account)
  ) {
    return account;
  }

  return {
    ...account,
    status: 'CHARGES_COMPLETED',
  };
}
