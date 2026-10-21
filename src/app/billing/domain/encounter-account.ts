export type EncounterAccountStatus =
  | 'OPEN'
  | 'DECLARED'
  | 'CHARGES_COMPLETED';

export type EncounterChargeSourceType =
  | 'procedure'
  | 'manual';

export interface EncounterAccount {
  status: EncounterAccountStatus;
  declaredProcedureIds: string[];
  declaredManualChargeIds: string[];
  chargedProcedureIds: string[];
  chargedManualChargeIds: string[];
}

export function declareEncounterSources(
  account: EncounterAccount,
  procedureIds: string[],
  manualChargeIds: string[],
): EncounterAccount {
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
  if (account.status !== 'DECLARED') {
    return false;
  }

  if (sourceType === 'procedure') {
    return account.declaredProcedureIds.includes(sourceId);
  }

  return account.declaredManualChargeIds.includes(sourceId);
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