import { copMoney } from '../model/cop-money';
import type { InvoiceListItem } from '../model/invoice-list-item';
import type { InvoiceListSource } from './invoice-list-source';

// Synchronous fictional data, not owner responses or persistent financial records.
const fixtures: InvoiceListItem[] = [
  { id: 'invoice-001', number: 'INV-001', patientName: 'Paciente de demostración', amount: copMoney('130000.00'), status: 'PARTIALLY_PAID' },
  { id: 'invoice-002', number: 'INV-002', patientName: 'Paciente de demostración 2', amount: copMoney('120000.00'), status: 'ISSUED' },
  { id: 'invoice-003', number: 'INV-003', patientName: 'Paciente de demostración 3', amount: copMoney('250000.00'), status: 'PAID' },
];
export const dummyInvoiceList: InvoiceListSource = {
  read: () => fixtures.map(invoice => ({ ...invoice })),
  detail: id => {
    const invoice = fixtures.find(row => row.id === id);
    if (!invoice) return undefined;
    // Fictional financial charges only; no clinical narrative or owner-derived totals.
    const charges = id === 'invoice-001' ? [
      { description: 'Procedimiento de demostración', amount: copMoney('80000.00') },
      { description: 'Material de demostración', amount: copMoney('50000.00') },
    ] : [{ description: 'Procedimiento de demostración', amount: invoice.amount }];
    const paidTotal = copMoney(id === 'invoice-001' ? '30000.00' : id === 'invoice-003' ? '250000.00' : '0.00');
    const balance = copMoney(id === 'invoice-001' ? '100000.00' : id === 'invoice-003' ? '0.00' : '120000.00');
    return { ...invoice, charges, paidTotal, balance };
  },
};
