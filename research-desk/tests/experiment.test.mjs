import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, mkdir, copyFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const scratch = await mkdtemp(join(tmpdir(), 'path-test-'));
await mkdir(join(scratch, 'fixtures'));
await copyFile('fixtures/toy_path.c', join(scratch, 'fixtures/toy_path.c'));
import { after } from 'node:test';
after(() => rm(scratch, { recursive: true, force: true }));
import { spawnSync } from 'node:child_process';

// A preload intercepts fetch: these tests cannot reach the paid endpoint.
function analyze(env, status = 200) {
  const preload = `globalThis.fetch = async (_url, options) => { if (process.env.RESEARCH_API_PROVIDER === 'openrouter' && (_url !== 'https://openrouter.ai/api/v1/chat/completions' || options.headers.Authorization !== 'Bearer offline-router')) throw Error('wrong routing'); const b = JSON.parse(options.body); if (b.max_tokens !== 700) throw Error('wrong cap'); return { ok: ${status === 200}, status: ${status}, json: async () => process.env.RESEARCH_API_PROVIDER === 'openrouter' ? ({choices:[{message:{content:'offline router'},finish_reason:'stop'}],usage:{prompt_tokens:1,completion_tokens:1}}) : ({ content: [{text:'offline response'}], usage:{input_tokens:1,output_tokens:1}, stop_reason:'end_turn' }) }; };`;
  return spawnSync(process.execPath, ['--import', `data:text/javascript,${encodeURIComponent(preload)}`, resolve('scripts/analyze-path.mjs'), 'fixtures/toy_path.c'], {
    cwd: scratch, encoding: 'utf8', env: { ...process.env, RESEARCH_API_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'offline-placeholder', ANTHROPIC_MODEL: 'offline-model', ANTHROPIC_MAX_TOKENS: '700', ALLOW_LOCAL_RESEARCH_API: '0', ...env }, timeout: 5000,
  });
}
test('API requires explicit opt-in', () => assert.equal(analyze({}).status, 2));
test('invalid token caps fail closed', () => {
  for (const cap of ['NaN', '0', '-1', '1001', '1.5']) assert.equal(analyze({ ALLOW_LOCAL_RESEARCH_API:'1', ANTHROPIC_MAX_TOKENS:cap }).status, 2);
});
test('single offline request records usage and handles API failure', async () => {
  assert.equal(analyze({ALLOW_LOCAL_RESEARCH_API:'1'}).status, 0);
  const record = JSON.parse(await readFile(join(scratch, 'artifacts/analysis.json'), 'utf8'));
  assert.equal(record.model, 'offline-model');
  assert.equal(record.usage.output_tokens, 1);
  assert.equal(analyze({ALLOW_LOCAL_RESEARCH_API:'1'}, 429).status, 1);
});

test('OpenRouter uses its own endpoint, bearer key and response format', () => {
  const result = analyze({ALLOW_LOCAL_RESEARCH_API:'1', RESEARCH_API_PROVIDER:'openrouter', OPENROUTER_API_KEY:'offline-router', OPENROUTER_MODEL:'anthropic/offline'});
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /offline router/);
});
