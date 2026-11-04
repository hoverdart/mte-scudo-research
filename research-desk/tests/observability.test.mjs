import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

test('local instrumentation measures branch outcomes, lifetime and UBSan detection', { timeout: 120000 }, async () => {
  for (const mode of ['coverage', 'lifetime', 'detectors']) {
    const r = spawnSync(process.execPath, ['scripts/observe.mjs', mode], { encoding:'utf8', timeout:60000 });
    assert.equal(r.status, 0, `${r.stdout}\n${r.stderr}`);
    const record = JSON.parse(await readFile(`artifacts/${mode}/record.json`, 'utf8'));
    assert.equal(record.passed, true);
    assert.ok(Object.keys(record.sourceAndInputHashes).length);
    if (mode === 'coverage') {
      assert.equal(record.summary.branches.count, 10);
      assert.equal(record.summary.branches.covered, 10);
    }
    if (mode === 'detectors') {
      const execution = record.steps.at(-1);
      assert.ok(execution.status !== 0 || execution.signal);
      assert.match(execution.stderr, /runtime error: signed integer overflow/);
    }
  }
});
