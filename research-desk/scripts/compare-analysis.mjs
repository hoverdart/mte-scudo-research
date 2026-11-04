#!/usr/bin/env node
// Offline comparison worksheet; human scoring, no model calls or quality claims.
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const files = process.argv.slice(2);
if (files.length !== 2) throw Error('Usage: node scripts/compare-analysis.mjs cheaper-result.json reference-result.json');
const records = await Promise.all(files.map(async file => JSON.parse(await readFile(file, 'utf8'))));
const [a, b] = records;
if (!a.sourceSha256 || !a.promptSha256 || a.sourceSha256 !== b.sourceSha256 || a.promptSha256 !== b.promptSha256 || a.max_tokens !== b.max_tokens) throw Error('Comparison requires identical source, prompt and token cap');
if (records.some(r => !['end_turn', 'stop'].includes(r.stopReason))) throw Error('Only complete text responses can be compared');
const criteria = [
  'Names process_input and classify; does not invent main in the fixture',
  'Correctly explains results 0, 1, 2 and 3',
  'Explains B length guard and short-circuit reads',
  'States valid-buffer caller contract; NULL only with length zero',
  'Suggests deterministic tests, assertions, ASan/UBSan and measured coverage',
  'Avoids invented vulnerabilities, exploitation or upstream claims',
];
const report = { createdAt: new Date().toISOString(), status: 'awaiting human review', rubricVersion: 1, criteria: criteria.map(description => ({ description, cheaper: null, reference: null, scale: '0 missing/incorrect, 1 partial, 2 correct' })), runs: records.map((r, i) => ({ file: resolve(files[i]), provider: r.provider, model: r.model, usage: r.usage, sourceSha256: r.sourceSha256, promptSha256: r.promptSha256, content: r.content })), conclusion: 'One pair is descriptive only; no model equivalence or dollar-savings conclusion without human scoring and provider cost evidence.' };
await mkdir('artifacts', { recursive: true });
await writeFile('artifacts/model-comparison.json', JSON.stringify(report, null, 2) + '\n');
console.log('Wrote artifacts/model-comparison.json; score offline before any further requests.');
