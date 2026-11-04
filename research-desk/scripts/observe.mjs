#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const root = fileURLToPath(new URL('..', import.meta.url));
const mode = process.argv[2];
if (!['coverage', 'lifetime', 'detectors'].includes(mode)) throw Error('Expected coverage, lifetime or detectors');
const out = resolve(root, 'artifacts', mode);
await mkdir(out, { recursive: true });
const steps = [];
const run = (command, args, extra = {}) => {
  const r = spawnSync(command, args, { cwd: root, env: { ...process.env, ...extra }, encoding: 'utf8', timeout: 30000, maxBuffer: 8 * 1024 * 1024 });
  const step = { command, args, status: r.status, signal: r.signal, stdout: r.stdout || '', stderr: r.stderr || '', error: r.error?.message };
  steps.push(step);
  return step;
};
const requireOK = r => { if (r.status !== 0 || r.error) throw Error(`Step failed: ${r.command}; see record.json`); return r; };
const compiler = process.env.CC || 'clang';
const flags = ['-std=c11', '-g', '-O0', '-Wall', '-Wextra', '-Werror', '-fno-omit-frame-pointer'];
const sources = mode === 'coverage' ? ['fixtures/toy_path.c', 'fixtures/toy_path_driver.c'] : [mode === 'lifetime' ? 'fixtures/lifetime.c' : 'fixtures/sanitizer_probe.c'];
const hashes = {};
for (const file of sources) hashes[file] = createHash('sha256').update(await readFile(resolve(root, file))).digest('hex');
const revision = requireOK(run('git', ['rev-parse', 'HEAD'])).stdout.trim();
const worktree = requireOK(run('git', ['status', '--porcelain'])).stdout;
requireOK(run(compiler, ['--version']));
const binary = resolve(out, 'fixture');
const settings = { ASAN_OPTIONS: 'halt_on_error=1', UBSAN_OPTIONS: 'halt_on_error=1:print_stacktrace=1' };
let passed = false;
let summary;
try {
  if (mode === 'coverage') {
    const tool = name => process.platform === 'darwin' ? requireOK(run('xcrun', ['--find', name])).stdout.trim() : name;
    const profdata = tool('llvm-profdata');
    const cov = tool('llvm-cov');
    requireOK(run(profdata, ['--version']));
    requireOK(run(cov, ['--version']));
    const raw = resolve(out, 'run.profraw');
    await rm(raw, { force: true });
    requireOK(run(compiler, [...flags, '-fprofile-instr-generate', '-fcoverage-mapping', ...sources, '-o', binary]));
    requireOK(run(binary, [], { LLVM_PROFILE_FILE: raw }));
    const merged = resolve(out, 'run.profdata');
    requireOK(run(profdata, ['merge', '-sparse', raw, '-o', merged]));
    const args = [binary, `-instr-profile=${merged}`, resolve(root, sources[0])];
    const exported = requireOK(run(cov, ['export', ...args]));
    await writeFile(resolve(out, 'coverage.json'), exported.stdout);
    const data = JSON.parse(exported.stdout);
    const fixture = data.data.flatMap(d => d.files).find(f => f.filename === resolve(root, sources[0]));
    summary = fixture?.summary;
    if (!summary?.branches?.count || summary.branches.covered !== summary.branches.count) throw Error('Fixture branch coverage incomplete');
    const html = resolve(out, 'html');
    requireOK(run(cov, ['show', ...args, '-show-branches=count', '-format=html', `-output-dir=${html}`]));
    await writeFile(resolve(out, 'coverage.txt'), requireOK(run(cov, ['report', ...args])).stdout);
  } else {
    requireOK(run(compiler, [...flags, '-fsanitize=address,undefined', '-fno-sanitize-recover=all', ...sources, '-o', binary]));
    const executed = run(binary, [], settings);
    if (mode === 'detectors') {
      if (executed.error || (executed.signal ? executed.signal !== 'SIGABRT' : !Number.isInteger(executed.status) || executed.status === 0) || !/runtime error: signed integer overflow/.test(executed.stderr)) throw Error('Expected UBSan arithmetic diagnostic was not observed');
      summary = 'UBSan positive control detected; ASan enabled but no ASan fault injected.';
    } else {
      requireOK(executed);
      if (/ERROR: AddressSanitizer|runtime error:/.test(executed.stderr)) throw Error('Unexpected sanitizer diagnostic');
      if (!/alloc id=1[\s\S]*read id=1[\s\S]*free id=1[\s\S]*cleared id=1/.test(executed.stdout)) throw Error('Incomplete lifetime trace');
      summary = 'Real malloc/read/free/clear sequence; no claim about allocator reuse.';
    }
  }
  passed = true;
} catch (error) { summary = error.message; process.exitCode = 1; }
await writeFile(resolve(out, 'record.json'), JSON.stringify({ mode, passed, summary, capturedAt: new Date().toISOString(), sourceRevision: revision, worktree, sourceAndInputHashes: hashes, input: 'Fixed values embedded in hashed source; no external input.', sanitizerSettings: mode === 'coverage' ? {} : settings, steps }, null, 2) + '\n');
await writeFile(resolve(out, 'run.log'), steps.map(s => `${s.command} ${s.args.join(' ')}\nexit=${s.status} signal=${s.signal}\n${s.stdout}${s.stderr}`).join('\n'));
console.log(`${mode}: ${passed ? 'PASS' : 'FAIL'}; artifacts/${mode}/record.json`);
