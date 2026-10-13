import { ProcedurePrice } from '../model/procedure-price.model';
import { copMoney } from '../../model/cop-money';

export const PRICING_CATALOG_FIXTURES: ProcedurePrice[] = [
  {
    id: 'price-001',
    procedureCode: 'PROC-001',
    procedureName: 'Profilaxis dental',
    amount: copMoney('80000.00'),
    currency: 'COP',
    validFrom: '2026-09-01',
    version: 1,
    validTo: null,
  },
  {
    id: 'price-002',
    procedureCode: 'PROC-002',
    procedureName: 'Extracción simple',
    amount: copMoney('120000.00'),
    currency: 'COP',
    validFrom: '2026-09-01',
    version: 1,
    validTo: null,
  },
  {
    id: 'price-003',
    procedureCode: 'PROC-003',
    procedureName: 'Blanqueamiento dental',
    amount: copMoney('250000.00'),
    currency: 'COP',
    validFrom: '2026-10-01',
    version: 2,
    validTo: null,
  },
];
