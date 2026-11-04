#!/usr/bin/env node
import fs from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';

// Minimal dotenv loader so the user can keep credentials in an untracked .env
// without adding a runtime dependency.
for (const path of ['.env', '.env.local', '../.env', '../.env.local']) {
  try {
    const text = await fs.readFile(path, 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (match && match[1] !== 'ALLOW_LOCAL_RESEARCH_API' && process.env[match[1]] === undefined) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
    }
  } catch { /* optional file */ }
}

const file = process.argv[2];
if (!file) {
  console.error('Usage: node scripts/analyze-path.mjs path/to/toy-program.c');
  process.exit(2);
}

const provider = process.env.RESEARCH_API_PROVIDER || 'anthropic';
if (!['anthropic', 'openrouter'].includes(provider)) {
  console.error('RESEARCH_API_PROVIDER must be anthropic or openrouter.');
  process.exit(2);
}
const openrouter = provider === 'openrouter';
const key = openrouter ? process.env.OPENROUTER_API_KEY : process.env.ANTHROPIC_API_KEY;
if (process.env.ALLOW_LOCAL_RESEARCH_API !== '1' || !key) {
  console.error('Refusing to call an API. Set ALLOW_LOCAL_RESEARCH_API=1 and the selected provider API key in an untracked .env.');
  process.exit(2);
}

const source = await fs.readFile(file, 'utf8');
if (Buffer.byteLength(source, 'utf8') > 12000) {
  console.error('Refusing source larger than 12,000 bytes; provide a small, redacted fixture.');
  process.exit(2);
}

const model = openrouter ? process.env.OPENROUTER_MODEL : process.env.ANTHROPIC_MODEL;
const max_tokens = Number(process.env.ANTHROPIC_MAX_TOKENS || 700);
if (!model || !Number.isInteger(max_tokens) || max_tokens < 1 || max_tokens > 1000) {
  console.error('Set an explicit provider model and integer ANTHROPIC_MAX_TOKENS between 1 and 1000.');
  process.exit(2);
}
const prompt = `Analyze this toy/local program as a defensive execution-path exercise. Return: (1) entry points and reachable functions, (2) inputs needed to reach each path, (3) suggested logging/assertions/sanitizers, and (4) safe regression tests. Do not provide exploit steps, payloads, corrupted-object layouts, privilege escalation, sandbox bypass, or targeting of operating-system/security objects. If the code is not clearly a toy/local fixture, say so and stop.\n\nSOURCE:\n${source}`;

await fs.mkdir('artifacts', { recursive: true });
let lock;
try { lock = await fs.open('artifacts/analysis.lock', 'wx', 0o600); }
catch { console.error('Another request may be running; inspect artifacts/analysis.lock before continuing.'); process.exit(2); }
const archive = `artifacts/analyses/${randomUUID()}.json`;
const record = {
  capturedAt: new Date().toISOString(), provider, model, max_tokens,
  sourceSha256: createHash('sha256').update(source).digest('hex'),
  promptSha256: createHash('sha256').update(prompt).digest('hex'),
  sourceRevision: spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout?.trim(),
  rubricVersion: 1, status: 'started',
};
try {
  await fs.mkdir('artifacts/analyses', { recursive: true });
  await fs.writeFile(archive, JSON.stringify(record, null, 2) + '\n');
  const response = await fetch(openrouter ? 'https://openrouter.ai/api/v1/chat/completions' : 'https://api.anthropic.com/v1/messages', {
    method: 'POST',
    signal: AbortSignal.timeout(30000),
    redirect: 'error',
    headers: {
      'content-type': 'application/json',
      ...(openrouter ? { Authorization: `Bearer ${key}` } : { 'x-api-key': key, 'anthropic-version': '2023-06-01' }),
    },
    body: JSON.stringify({ model, max_tokens, temperature: 0, ...(openrouter ? { provider: { allow_fallbacks: false } } : {}), messages: [{ role: 'user', content: prompt }] }),
  });
  record.httpStatus = response.status;
  const body = await response.json();
  if (!response.ok || body.error) {
    console.error(`API request failed (HTTP ${response.status}); no automatic retry.`);
    throw new Error('Analysis stopped; no retry performed.');
  }
  const content = openrouter ? [{ type: 'text', text: body.choices?.[0]?.message?.content || '' }] : body.content;
  const stopReason = openrouter ? body.choices?.[0]?.finish_reason : body.stop_reason;
  if (!Array.isArray(content) || !content.some(part => typeof part.text === 'string' && part.text.length)) {
    console.error('API returned no text; stop and review before another request.');
    throw new Error('Analysis stopped; no retry performed.');
  }
  Object.assign(record, { status: 'completed', usage: body.usage, stopReason, content });
  const serialized = JSON.stringify(record, null, 2) + '\n';
  await fs.writeFile(archive, serialized);
  await fs.writeFile('artifacts/analysis.json', serialized);
  console.log(content.map(part => part.text || '').join('\n'));

  if (['max_tokens', 'length'].includes(stopReason)) {
    console.error('Response reached the token cap; review the saved partial result before another request.');
    process.exitCode = 1;
  }
} catch {
  record.status = 'failed';
  record.note = 'No retry. Charges may have occurred; review provider activity.';
  await fs.writeFile(archive, JSON.stringify(record, null, 2) + '\n').catch(() => {});
  console.error('Request or response processing failed; inspect saved evidence before another call. No retry performed.');
  process.exitCode = 1;
} finally {
  await lock.close();
  await fs.unlink('artifacts/analysis.lock');
}
