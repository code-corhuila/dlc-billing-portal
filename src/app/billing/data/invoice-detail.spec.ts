import { expect, it } from 'vitest';
import { dummyInvoiceList } from './invoice-list.dummy';

it('reads the selected fictional invoice with exact charges and matching list data', () => {
  for (const row of dummyInvoiceList.read()) {
    const detail = dummyInvoiceList.detail(row.id)!;
    expect(detail).toMatchObject(row);
    expect(detail.charges.length).toBeGreaterThan(0);
    const cents = (amount: string) => BigInt(amount.replace('.', ''));
    expect(detail.charges.reduce((sum, charge) => sum + cents(charge.amount), 0n))
      .toBe(cents(row.amount));
  }
});

it('returns no detail for unknown identifiers and isolates nested fixture mutations', () => {
  expect(dummyInvoiceList.detail('missing')).toBeUndefined();
  const first = dummyInvoiceList.detail('invoice-001')!;
  first.charges[0].description = 'local mutation';
  first.patientName = 'local patient';
  const next = dummyInvoiceList.detail('invoice-001')!;
  expect(next.charges[0].description).not.toBe('local mutation');
  expect(next.patientName).not.toBe('local patient');
});
