import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { load } from 'js-yaml';

export function renderContract(snapshot) {
  if (!/^[a-f0-9]{40}$/.test(snapshot.revision) || snapshot.money.type !== 'string'
    || typeof snapshot.money.pattern !== 'string' || snapshot.status.type !== 'string'
    || !Array.isArray(snapshot.status.enum) || !snapshot.status.enum.length
    || snapshot.status.enum.some(value => typeof value !== 'string')) throw new Error('Invalid Billing contract projection');
  return `// Generated from dlc-docs OpenAPI at ${snapshot.revision}; do not edit.\n`
    + '// Sources: billing-service.yaml#/components/schemas/Invoice/properties/status; _shared.yaml#/components/schemas/Money.\n'
    + `export const INVOICE_STATUSES = ${JSON.stringify(snapshot.status.enum)} as const;\n`
    + 'export type InvoiceStatus = typeof INVOICE_STATUSES[number];\n'
    + `export const COP_MONEY_PATTERN = ${JSON.stringify(snapshot.money.pattern)};\n`;
}
export function verifyContract(snapshot, file) {
  if (readFileSync(file, 'utf8').replace(/\r\n/g, '\n') !== renderContract(snapshot)) {
    throw new Error('Billing contract drift: review the snapshot and regenerate types');
  }
}
function readProjection(docs) {
  const folder = join(docs, '07-api/contracts/openapi');
  const shared = load(readFileSync(join(folder, '_shared.yaml'), 'utf8'));
  const billing = load(readFileSync(join(folder, 'billing-service.yaml'), 'utf8'));
  const money = shared.components.schemas.Money;
  const status = billing.components.schemas.Invoice.properties.status;
  return { money: { type: money.type, pattern: money.pattern }, status: { type: status.type, enum: status.enum } };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const snapshotFile = join(root, 'contracts/invoice-list.snapshot.json');
  const target = join(root, 'src/app/billing/model/invoice-contract.generated.ts');
  const [mode, docs, revision] = process.argv.slice(2);
  if (mode === '--refresh' && docs && revision) {
    const snapshot = { revision, ...readProjection(docs) };
    const generated = renderContract(snapshot);
    writeFileSync(snapshotFile, JSON.stringify(snapshot, null, 2) + '\n');
    writeFileSync(target, generated);
  } else if (mode === '--check') {
    const snapshot = JSON.parse(readFileSync(snapshotFile, 'utf8'));
    verifyContract(snapshot, target);
    if (docs && JSON.stringify(readProjection(docs)) !== JSON.stringify({ money: snapshot.money, status: snapshot.status })) {
      throw new Error('Billing contract drift from the supplied documentation');
    }
    console.log('Billing contract projection verified');
  } else throw new Error('Usage: invoice-contract.mjs --check [docs] | --refresh docs revision');
}
