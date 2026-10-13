import { expect, it } from 'vitest';
import { DemoInvoicePayments } from './demo-invoice-payments';
import { dummyInvoiceList } from './invoice-list.dummy';
import { copMoney } from '../model/cop-money';

it('requires half the invoice total only for the first payment, rounding fractional cents upward', () => {
  const session = new DemoInvoicePayments(dummyInvoiceList);
  expect(() => session.register('invoice-002', '59999.99', 'demo', 'low')).toThrow();
  session.register('invoice-002', '60000.00', 'demo', 'half');
  session.register('invoice-002', '0.01', 'demo', 'next');
  expect(session.detail('invoice-002')?.balance).toBe('59999.99');
  const tiny = new DemoInvoicePayments({ read: dummyInvoiceList.read,
    detail: id => ({ ...dummyInvoiceList.detail(id)!, amount: copMoney('0.03'), paidTotal: copMoney('0.00') }) });
  expect(() => tiny.register('invoice-002', '0.01', 'demo', 'low')).toThrow();
  tiny.register('invoice-002', '0.02', 'demo', 'half');
});

it('records exact partial and final payments without changing initial fixtures', () => {
  const session = new DemoInvoicePayments(dummyInvoiceList);
  session.register('invoice-001', '0.01', 'demo', 'first');
  expect(session.detail('invoice-001')).toMatchObject({ paidTotal: '30000.01', balance: '99999.99', status: 'PARTIALLY_PAID' });
  session.register('invoice-001', '99999.99', 'demo', 'final');
  expect(session.detail('invoice-001')).toMatchObject({ paidTotal: '130000.00', balance: '0.00', status: 'PAID' });
  expect(session.read()[0].status).toBe('PAID');
  expect(session.history('invoice-001')).toHaveLength(2);
  expect(new DemoInvoicePayments(dummyInvoiceList).detail('invoice-001')?.balance).toBe('100000.00');
});

it('deduplicates the same local intent and rejects changed payloads without changing balance', () => {
  const session = new DemoInvoicePayments(dummyInvoiceList);
  session.register('invoice-002', '120000.00', 'demo', 'key');
  session.register('invoice-002', '120000.00', 'demo', 'key');
  expect(session.history('invoice-002')).toHaveLength(1);
  expect(() => session.register('invoice-002', '1.00', 'demo', 'key')).toThrow();
  expect(session.detail('invoice-002')?.balance).toBe('0.00');
});

it('rejects invalid amounts, methods, missing invoices and nonpayable states', () => {
  const session = new DemoInvoicePayments(dummyInvoiceList);
  for (const amount of ['0.00', '-1.00', '1.001', '100000.01']) {
    expect(() => session.register('invoice-001', amount, 'demo', amount)).toThrow();
  }
  expect(() => session.register('invoice-001', '1.00', ' ', 'blank')).toThrow();
  expect(() => session.register('invoice-001', '1.00', 'x'.repeat(41), 'long')).toThrow();
  expect(() => session.register('missing', '1.00', 'demo', 'missing')).toThrow();
  expect(() => session.register('invoice-003', '1.00', 'demo', 'paid')).toThrow();
  for (const status of ['DRAFT', 'CANCELLED'] as const) {
    const blocked = new DemoInvoicePayments({ read: dummyInvoiceList.read,
      detail: id => ({ ...dummyInvoiceList.detail(id)!, status }) });
    expect(() => blocked.register('invoice-001', '1.00', 'demo', status)).toThrow();
  }
  expect(session.history('invoice-001')).toEqual([]);
  expect(session.detail('missing')).toBeUndefined();
});
