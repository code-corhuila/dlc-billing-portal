import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { verifyOperations } from './billing-operations-contract.mjs';

const snapshot = JSON.parse(readFileSync('contracts/billing-operations.snapshot.json', 'utf8'));

it('pins amount-free draft creation and authorized roles', () => {
  const operation = snapshot.contract.paths['/invoices'].post;
  const schema = operation.request.content['application/json'].schema;
  expect(Object.keys(schema.properties).sort()).toEqual(['appointmentId', 'billableItemIds', 'patientId']);
  expect(schema.required).toEqual(['patientId', 'billableItemIds']);
  expect(operation.roles).toEqual(['ADMINISTRATOR', 'SECRETARY_ASSISTANT']);
  expect(schema.properties.billableItemIds.uniqueItems).toBe(true);
});

it('pins the first-payment minimum and its conflict code', () => {
  const policy = snapshot.contract.paths['/invoices/{id}/payments'].post.clarification;
  expect(policy).toContain('50%');
  expect(policy).toContain('INITIAL_PAYMENT_BELOW_MINIMUM');
  expect(policy).toContain('rounded upward to a cent');
});

it('rejects an incomplete operation snapshot', () => {
  const altered = structuredClone(snapshot);
  delete altered.contract.paths['/invoices'].post;
  expect(() => verifyOperations(altered)).toThrow('Missing Billing operation');
});
