#!/usr/bin/env node
import fs from 'node:fs/promises';

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

const key = process.env.ANTHROPIC_API_KEY;
if (process.env.ALLOW_LOCAL_RESEARCH_API !== '1' || !key) {
  console.error('Refusing to call an API. Set ALLOW_LOCAL_RESEARCH_API=1 and ANTHROPIC_API_KEY in an untracked .env.');
  process.exit(2);
}

const source = await fs.readFile(file, 'utf8');
if (Buffer.byteLength(source, 'utf8') > 12000) {
  console.error('Refusing source larger than 12,000 bytes; provide a small, redacted fixture.');
  process.exit(2);
}

const model = process.env.ANTHROPIC_MODEL;
const max_tokens = Number(process.env.ANTHROPIC_MAX_TOKENS || 700);
if (!model || !Number.isInteger(max_tokens) || max_tokens < 1 || max_tokens > 1000) {
  console.error('Set an explicit ANTHROPIC_MODEL and integer ANTHROPIC_MAX_TOKENS between 1 and 1000.');
  process.exit(2);
}
const prompt = `Analyze this toy/local program as a defensive execution-path exercise. Return: (1) entry points and reachable functions, (2) inputs needed to reach each path, (3) suggested logging/assertions/sanitizers, and (4) safe regression tests. Do not provide exploit steps, payloads, corrupted-object layouts, privilege escalation, sandbox bypass, or targeting of operating-system/security objects. If the code is not clearly a toy/local fixture, say so and stop.\n\nSOURCE:\n${source}`;

const response = await fetch('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  signal: AbortSignal.timeout(30000),
  redirect: 'error',
  headers: {
    'content-type': 'application/json',
    'x-api-key': key,
    'anthropic-version': '2023-06-01',
  },
  body: JSON.stringify({ model, max_tokens, temperature: 0, messages: [{ role: 'user', content: prompt }] }),
});
const body = await response.json();
if (!response.ok) {
  console.error(`API request failed (HTTP ${response.status}); no automatic retry.`);
  process.exit(1);
}
await fs.mkdir('artifacts', { recursive: true });
await fs.writeFile('artifacts/analysis.json', JSON.stringify({
  capturedAt: new Date().toISOString(), model, max_tokens,
  sourceSha256: (await import('node:crypto')).createHash('sha256').update(source).digest('hex'),
  usage: body.usage, stopReason: body.stop_reason, content: body.content,
}, null, 2) + '\n');
console.log(body.content?.map((part) => part.text || '').join('\n') || JSON.stringify(body, null, 2));

if (body.stop_reason === 'max_tokens') {
  console.error('Response reached the token cap; review the saved partial result before another request.');
  process.exitCode = 1;
}
