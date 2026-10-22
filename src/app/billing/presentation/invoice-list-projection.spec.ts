
import { describe, expect, it } from 'vitest';
import { copMoney } from '../model/cop-money';
import type { ReadInvoice } from '../data/invoice-read-adapter';
import { projectInvoiceList } from './invoice-list-projection';

describe('invoice list projection', () => {
  const invoice: ReadInvoice = {
    id: '11111111-1111-4111-8111-111111111111',
    patientId: '22222222-2222-4222-8222-222222222222',
    items: [],
    total: copMoney('150000.00'),
    balance: copMoney('150000.00'),
    currency: 'COP',
    status: 'DRAFT',
    version: 1,
  };

  it('projects the official invoice number when available', () => {
    const result = projectInvoiceList([
      {
        ...invoice,
        invoiceNumber: 'FAC-2026-001',
        status: 'ISSUED',
      },
    ]);

    expect(result).toEqual([
      {
        id: invoice.id,
        number: 'FAC-2026-001',
        patientName: invoice.patientId,
        amount: '150000.00',
        status: 'ISSUED',
      },
    ]);
  });

  it('identifies an unnumbered draft without inventing a number', () => {
    const result = projectInvoiceList([invoice]);

    expect(result[0].number).toBe('Borrador sin número');
    expect(result[0].id).toBe(invoice.id);
  });

  it('uses the patient identifier without inventing a patient name', () => {
    const result = projectInvoiceList([invoice]);

    expect(result[0].patientName).toBe(invoice.patientId);
    expect(result[0].patientName).not.toContain('Paciente de demostración');
  });

  it('preserves exact COP amounts and documented statuses', () => {
    const result = projectInvoiceList([
      {
        ...invoice,
        total: copMoney('999999999999.99'),
        status: 'PARTIALLY_PAID',
      },
    ]);

    expect(result[0].amount).toBe('999999999999.99');
    expect(result[0].status).toBe('PARTIALLY_PAID');
  });

  it('returns an empty list when no invoices are supplied', () => {
    expect(projectInvoiceList([])).toEqual([]);
  });

  it('does not mutate the original invoice data', () => {
    const original = { ...invoice };

    projectInvoiceList([invoice]);

    expect(invoice).toEqual(original);
  });
});
