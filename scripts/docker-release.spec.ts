import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

describe('Billing Docker release configuration', () => {
  it('builds the Docker image with the Billing 2.0.0 release identifier', () => {
    const dockerfile = readFileSync(
      join(root, 'deploy', 'Dockerfile'),
      'utf8',
    );

    expect(dockerfile).toContain('ARG BILLING_RELEASE=2.0.0');
    expect(dockerfile).toContain('ENV BILLING_RELEASE=$BILLING_RELEASE');
  });
});