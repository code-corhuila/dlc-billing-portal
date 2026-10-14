import {
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  renameSync,
  rmSync,
  rmdirSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { hostname } from 'node:os';

export function publishRelease(
  root,
  release,
  build,
  copy = cpSync,
  chmod = chmodSync,
) {
  if (!/^(?!\.+$)[A-Za-z0-9._-]+$/.test(release)) {
    throw new Error('Invalid Billing release');
  }

  const releases = resolve(root, 'dist/portals/billing');
  const target = join(releases, release);

  mkdirSync(releases, { recursive: true });

  const lock = join(releases, '.build-lock');

  try {
    mkdirSync(lock);
  } catch (error) {
    if (error.code === 'EEXIST') {
      throw new Error('Billing build already in progress');
    }

    throw error;
  }

  let stage;

  try {
    if (existsSync(target)) {
      throw new Error(
        'Billing release already exists; choose a new release',
      );
    }

    stage = mkdtempSync(
      join(releases, '.staging-'),
    );

    writeFileSync(
      join(lock, 'owner.json'),
      JSON.stringify({
        pid: process.pid,
        host: hostname(),
        stage,
      }),
      { flag: 'wx' },
    );

    build();

    copy(
      join(root, 'dist/billing-composition'),
      stage,
      {
        recursive: true,
        force: false,
        errorOnExist: true,
      },
    );

    renameSync(
      join(stage, 'main.js'),
      join(stage, 'entry.js'),
    );

    // mkdtemp creates the staging directory with restrictive permissions.
    // Make it traversable/readable by the Nginx worker before atomic publish.
    chmod(stage, 0o755);

    // Same-filesystem rename publishes the complete directory atomically.
    renameSync(stage, target);
  } finally {
    try {
      if (
        stage &&
        dirname(stage) === releases
      ) {
        rmSync(stage, {
          recursive: true,
          force: true,
        });
      }
    } finally {
      rmSync(
        join(lock, 'owner.json'),
        { force: true },
      );

      rmdirSync(lock);
    }
  }
}