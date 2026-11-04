#!/usr/bin/env node
// Local-only study: dependencies must already exist; no network or installs here.
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const root = fileURLToPath(new URL('..', import.meta.url));
const out = resolve(root, 'artifacts/upstream');
const source = resolve(out, 'dav1d');
const build = resolve(out, 'build');
const pinned = 'e5af12796d46cd7788e5f5349da1a27c5f7a8f1a';
const steps = [];
const settings = { ASAN_OPTIONS: 'halt_on_error=1', UBSAN_OPTIONS: 'halt_on_error=1:print_stacktrace=1' };
await mkdir(out, { recursive: true });
const run = (command, args, cwd = root) => {
  const r = spawnSync(command, args, { cwd, env: { ...process.env, ...settings, PATH: `${resolve(out, 'tools/bin')}:${process.env.PATH}` }, encoding: 'utf8', timeout: 120000, maxBuffer: 8 * 1024 * 1024 });
  const entry = { command, args, status: r.status, signal: r.signal, stdout: r.stdout || '', stderr: r.stderr || '', error: r.error?.message };
  steps.push(entry);
  if (r.status !== 0 || r.error) throw Error(`Failed ${command}; inspect artifacts/upstream/record.json`);
  return entry.stdout.trim();
};
let passed = false;
let error;
let revision;
let hashes;
try {
  revision = run('git', ['rev-parse', 'HEAD'], source);
  if (revision !== pinned || run('git', ['status', '--porcelain', '--', '.', ':(exclude)subprojects/.wraplock'], source)) throw Error('Expected clean pinned upstream checkout');
  hashes = { 'fixtures/dav1d_smoke.c': createHash('sha256').update(await readFile(resolve(root, 'fixtures/dav1d_smoke.c'))).digest('hex') };
  run('git', ['rev-parse', 'HEAD']);
  run('git', ['status', '--porcelain']);
  run('clang', ['--version']);
  const meson = resolve(out, 'tools/bin/meson');
  run(meson, ['--version']);
  run(resolve(out, 'tools/bin/ninja'), ['--version']);
  run(meson, ['setup', ...(existsSync(resolve(build, 'meson-private/coredata.dat')) ? ['--reconfigure'] : []), build, source, '--wrap-mode=nodownload', '--buildtype=debug', '-Db_sanitize=address,undefined', '-Db_lundef=false', '-Denable_asm=false', '-Denable_tests=true', '-Denable_tools=true', '-Dtestdata_tests=false', '-Denable_docs=false']);
  run(meson, ['compile', '-C', build, '-j', '2']);
  const tests = JSON.parse(run(meson, ['introspect', build, '--tests']));
  if (!tests.length) throw Error('No upstream tests registered');
  run(meson, ['test', '-C', build, '--no-rebuild', '--num-processes', '1', '--print-errorlogs']);
  const binary = resolve(out, 'dav1d-smoke');
  run('clang', ['-g', '-O0', '-Wall', '-Wextra', '-Werror', '-fsanitize=address,undefined', '-fno-sanitize-recover=all', '-I', resolve(source, 'include'), '-I', resolve(build, 'include'), 'fixtures/dav1d_smoke.c', '-L', resolve(build, 'src'), '-ldav1d', `-Wl,-rpath,${resolve(build, 'src')}`, '-o', binary]);
  run(binary, []);
  run('ffmpeg', ['-version']);
  const mediaResults = [];
  for (const depth of [8, 10]) for (const [width, height] of [[64,64],[96,64]]) for (const frames of [1,3]) {
    const id = `black-${width}x${height}-${depth}bit-${frames}frames`;
    const media = resolve(out, `${id}.ivf`);
    run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', `color=c=black:s=${width}x${height}:r=1`, '-frames:v', String(frames), '-pix_fmt', depth === 8 ? 'yuv420p' : 'yuv420p10le', '-c:v', 'libsvtav1', '-preset', '12', '-crf', '30', '-svtav1-params', 'lp=1', '-f', 'ivf', media]);
    const inputSha256 = createHash('sha256').update(await readFile(media)).digest('hex');
    hashes[`generated:${id}.ivf`] = inputSha256;
    const outputHashes = [];
    for (let repeat = 0; repeat < 2; repeat++) {
      const decoded = resolve(out, `${id}-${repeat}.yuv`);
      run(resolve(build, 'tools/dav1d'), ['--input', media, '--output', decoded, '--muxer', 'yuv', '--threads', '1', '--framedelay', '1']);
      const pixels = await readFile(decoded);
      const bytesPerSample = depth === 8 ? 1 : 2;
      const samplesPerFrame = width * height * 3 / 2;
      if (pixels.length !== samplesPerFrame * frames * bytesPerSample) throw Error(`Unexpected decoded size: ${id}`);
      for (let i = 0; i < pixels.length / bytesPerSample; i++) {
        const expected = (i % samplesPerFrame < width * height ? 16 : 128) * (depth === 8 ? 1 : 4);
        const actual = depth === 8 ? pixels[i] : pixels.readUInt16LE(i * 2);
        if (Math.abs(actual - expected) > (depth === 8 ? 1 : 4)) throw Error(`Black-frame pixel regression: ${id}`);
      }
      outputHashes.push(createHash('sha256').update(pixels).digest('hex'));
    }
    if (outputHashes[0] !== outputHashes[1]) throw Error(`Nondeterministic decoded output: ${id}`);
    hashes[`decoded:${id}.yuv`] = outputHashes[0];
    mediaResults.push({ id, depth, width, height, frames, inputSha256, outputSha256: outputHashes[0], repeats: 2, expectedBytes: width * height * 3 / 2 * frames * (depth === 8 ? 1 : 2), passed: true });
  }
  await writeFile(resolve(out, 'media-results.json'), JSON.stringify(mediaResults, null, 2) + '\n');
  passed = true;
} catch (e) { error = e.message; process.exitCode = 1; }
await writeFile(resolve(out, 'record.json'), JSON.stringify({ capturedAt: new Date().toISOString(), passed, error, upstream: 'https://github.com/videolan/dav1d', revision, pinned, sourceAndInputHashes: hashes, input: 'Fixed empty decoder lifecycle plus eight generated ordinary black AV1 clips; generation commands and hashes recorded.', sanitizerSettings: settings, limits: { jobs: 2, testProcesses: 1, stepTimeoutMs: 120000 }, steps, limitations: 'Eight ordinary generated black clips across depth/size/frame count, decoded twice each; no public crash corpus, assembly, MTE or Scudo claims.' }, null, 2) + '\n');
await writeFile(resolve(out, 'run.log'), steps.map(s => `${s.command} ${s.args.join(' ')}\nexit=${s.status} signal=${s.signal}\n${s.stdout}${s.stderr}`).join('\n'));
console.log(`dav1d: ${passed ? 'PASS' : 'FAIL'}; artifacts/upstream/record.json`);
