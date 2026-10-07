import { ProcedurePrice } from '../model/procedure-price.model';

export const PRICING_CATALOG_FIXTURES: ProcedurePrice[] = [
  {
    id: 'price-001',
    procedureCode: 'PROC-001',
    procedureName: 'Profilaxis dental',
    amount: 80000,
    currency: 'COP',
    validFrom: '2026-09-01',
    version: 1,
    active: true,
  },
  {
    id: 'price-002',
    procedureCode: 'PROC-002',
    procedureName: 'Extracción simple',
    amount: 120000,
    currency: 'COP',
    validFrom: '2026-09-01',
    version: 1,
    active: true,
  },
  {
    id: 'price-003',
    procedureCode: 'PROC-003',
    procedureName: 'Blanqueamiento dental',
    amount: 250000,
    currency: 'COP',
    validFrom: '2026-10-01',
    version: 2,
    active: true,
  },
];