import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { expect, it } from 'vitest';

const snapshot = {
  revision: '18813df4fca61f2d858edcbf6d873d507ef6729f',
  money: { type: 'string', pattern: '^\\d{1,12}\\.\\d{2}$' },
  status: { type: 'string', enum: ['DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'CANCELLED'] },
};
it('keeps the checked-in projection aligned with generated frontend constraints (regression)', async () => {
  const { verifyContract } = await import('./invoice-contract.mjs');
  const approved = JSON.parse(readFileSync('contracts/invoice-list.snapshot.json', 'utf8'));
  expect(() => verifyContract(approved, 'src/app/billing/model/generated/invoice-contract.generated.ts')).not.toThrow();
});
it('generates status types and money constraints from the reviewed projection', async () => {
  const { renderContract } = await import('./invoice-contract.mjs');
  const generated = renderContract(snapshot);
  expect(generated).toContain('PARTIALLY_PAID');
  expect(generated).toContain(JSON.stringify(snapshot.money.pattern));
  expect(generated).toContain(snapshot.revision);
  expect(() => renderContract({ ...snapshot, money: { ...snapshot.money, type: 'number' } })).toThrow();
});
it('detects status or money changes instead of silently retaining generated types', async () => {
  const { renderContract, verifyContract } = await import('./invoice-contract.mjs');
  const root = mkdtempSync(join(tmpdir(), 'billing-contract-'));
  const file = join(root, 'contract.ts');
  try {
    writeFileSync(file, renderContract(snapshot));
    expect(() => verifyContract(snapshot, file)).not.toThrow();
    expect(() => verifyContract({ ...snapshot, status: { type: 'string', enum: ['DRAFT'] } }, file)).toThrow(/drift/);
    expect(() => verifyContract({ ...snapshot, money: { type: 'string', pattern: '^\\d+\\.\\d{3}$' } }, file)).toThrow(/drift/);
    expect(readFileSync(file, 'utf8')).toBe(renderContract(snapshot));
    writeFileSync(file, readFileSync(file, 'utf8').replace('"PAID"', '"SETTLED"'));
    expect(() => verifyContract(snapshot, file)).toThrow(/drift/);
  } finally {
    expect(dirname(root)).toBe(tmpdir());
    rmSync(root, { recursive: true });
  }
});
