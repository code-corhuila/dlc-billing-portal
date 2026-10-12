export type InvoiceListStatus = 'DRAFT' | 'ISSUED' | 'PARTIALLY_PAID' | 'PAID' | 'CANCELLED';
export interface InvoiceListItem {
  id: string;
  number: string;
  patientName: string;
  amount: number;
  status: InvoiceListStatus;
}
import type { InvoiceListSource } from './invoice-list-source';

// Synchronous fictional data, not owner responses or persistent financial records.
const fixtures: InvoiceListItem[] = [
  { id: 'invoice-001', number: 'INV-001', patientName: 'Paciente de demostración', amount: 130000, status: 'PARTIALLY_PAID' },
  { id: 'invoice-002', number: 'INV-002', patientName: 'Paciente de demostración 2', amount: 120000, status: 'ISSUED' },
  { id: 'invoice-003', number: 'INV-003', patientName: 'Paciente de demostración 3', amount: 250000, status: 'PAID' },
];
export const dummyInvoiceList: InvoiceListSource = {
  read: () => fixtures.map(invoice => ({ ...invoice })),
};
