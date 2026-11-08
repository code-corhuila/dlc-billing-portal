import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { load } from 'js-yaml';

const root = fileURLToPath(new URL('../', import.meta.url));
const file = join(root, 'contracts/billing-operations.snapshot.json');

export function operationProjection(docs) {
  const directory = join(docs, '07-api/contracts/openapi');
  const billing = load(readFileSync(join(directory, 'billing-service.yaml'), 'utf8'));
  const shared = load(readFileSync(join(directory, '_shared.yaml'), 'utf8'));
  const paths = {};
  for (const [path, methods] of Object.entries(billing.paths)) {
    if (path.startsWith('/internal/')) continue;
    paths[path] = {};
    for (const method of ['get', 'post', 'put', 'patch', 'delete']) {
      if (!methods[method]) continue;
      const operation = methods[method];
      paths[path][method] = { roles: operation['x-roles'], parameters: operation.parameters ?? [],
        request: operation.requestBody ?? null, responses: operation.responses,
        clarification: operation['x-contract-clarification'] ?? null };
    }
  }
  return { paths, schemas: billing.components.schemas, shared: shared.components };
}

export function verifyOperations(snapshot, docs) {
  for (const [path, method] of [['/billable-items', 'get'], ['/invoices', 'post'],
    ['/invoices/{id}/payments', 'post'], ['/procedure-prices', 'post'], ['/additional-price-rules', 'post']]) {
    if (!snapshot.contract.paths[path]?.[method]) throw new Error(`Missing Billing operation: ${method} ${path}`);
  }
  if (docs && JSON.stringify(snapshot.contract) !== JSON.stringify(operationProjection(docs))) {
    throw new Error('Billing operations differ from supplied docs; review and refresh the snapshot');
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [mode, docs] = process.argv.slice(2);
  if (mode === '--refresh' && docs) {
    writeFileSync(file, JSON.stringify({ reviewedOn: '2026-11-07',
      source: 'Local dlc-docs checkout, including owner-approved initial-payment policy; not a remote acceptance claim',
      contract: operationProjection(docs) }, null, 2) + '\n');
  } else if (mode !== '--check') throw new Error('Usage: --check [docs] | --refresh docs');
  verifyOperations(JSON.parse(readFileSync(file, 'utf8')), docs);
  console.log('Billing operation snapshot verified');
}
