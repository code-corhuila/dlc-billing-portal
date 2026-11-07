import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

describe('Billing Docker release configuration', () => {
  it('builds the Docker image with the package release identifier', () => {
    const dockerfile = readFileSync(
      join(root, 'deploy', 'Dockerfile'),
      'utf8',
    );

    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
    expect(dockerfile).toContain(`ARG BILLING_RELEASE=${pkg.version}`);
    expect(dockerfile).toContain('ENV BILLING_RELEASE=$BILLING_RELEASE');
  });
});