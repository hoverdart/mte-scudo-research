#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const root = fileURLToPath(new URL('..', import.meta.url));
const out = resolve(root, 'artifacts');
await mkdir(out, { recursive: true });
const hash = (data) => createHash('sha256').update(data).digest('hex');
const run = (command, args, env = process.env) => {
  const r = spawnSync(command, args, { cwd: root, env, encoding: 'utf8', timeout: 30000, maxBuffer: 1024 * 1024 });
  return { command, args, status: r.status, signal: r.signal, stdout: r.stdout || '', stderr: r.stderr || '', error: r.error?.message };
};
const sources = {};
for (const f of ['fixtures/toy_path.c', 'fixtures/toy_path_driver.c']) sources[f] = hash(await readFile(resolve(root, f)));
const flags = ['-std=c11', '-g', '-O1', '-Wall', '-Wextra', '-Werror', '-fno-omit-frame-pointer', '-fsanitize=address,undefined', '-fno-sanitize-recover=all'];
const compiler = process.env.CC || 'clang';
const settings = { ASAN_OPTIONS: 'halt_on_error=1', UBSAN_OPTIONS: 'halt_on_error=1:print_stacktrace=1' };
const compile = run(compiler, [...flags, ...Object.keys(sources), '-o', resolve(out, 'toy-path')]);
const execution = compile.status === 0 ? run(resolve(out, 'toy-path'), [], { ...process.env, ...settings }) : null;
const revision = run('git', ['rev-parse', 'HEAD']);
const worktree = run('git', ['status', '--porcelain']);
const record = { capturedAt: new Date().toISOString(), sourceRevision: revision.stdout.trim(), worktree: worktree.stdout, sources, inputNote: 'Seven fixed cases embedded in the hashed driver; no external inputs.', compiler: run(compiler, ['--version']), flags, sanitizerSettings: settings, compile, execution, coverage: 'Seven asserted cases; instrumented branch coverage is not measured.' };
await writeFile(resolve(out, 'baseline.json'), JSON.stringify(record, null, 2) + '\n');
await writeFile(resolve(out, 'baseline.log'), [compile.stdout, compile.stderr, execution?.stdout, execution?.stderr].filter(Boolean).join('\n'));
console.log('Wrote artifacts/baseline.json and artifacts/baseline.log');
if (compile.status !== 0 || execution?.status !== 0) process.exitCode = 1;
