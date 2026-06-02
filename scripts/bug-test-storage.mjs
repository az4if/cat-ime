#!/usr/bin/env node
/** @deprecated Use: npm test */
import { spawnSync } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const r = spawnSync('npm', ['test'], { cwd: root, stdio: 'inherit', shell: true });
process.exit(r.status ?? 1);
