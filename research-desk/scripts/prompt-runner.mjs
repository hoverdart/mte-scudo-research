#!/usr/bin/env node
import { mkdir, readFile, writeFile, open, unlink } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { createHash, randomUUID } from 'node:crypto';
import { updateLedger } from './cost-ledger.mjs';

export function unwrapFence(text) {
  return text.trim().match(/^```[\w+-]*\s*\n([\s\S]*?)\n```$/)?.[1] ?? text;
}
export function validateFiles(value) {
  if (!value || Array.isArray(value) || Object.keys(value).join() !== 'files' || !Array.isArray(value.files) || value.files.length < 1 || value.files.length > 16) throw Error('Expected {"files":[{"path":"...","content":"..."}]} with 1..16 files');
  const seen = []; let bytes = 0;
  for (const file of value.files) {
    if (!file || Object.keys(file).sort().join() !== 'content,path' || typeof file.path !== 'string' || typeof file.content !== 'string') throw Error('Each file requires only string path and content fields');
    const parts = file.path.split('/');
    if (file.path.length > 200 || parts.some(p => !p || p === '.' || p === '..' || /[\x00-\x1f\x7f\\<>:"|?*]/.test(p) || /[. ]$/.test(p) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(p))) throw Error('File paths must be portable relative paths without traversal');
    const key = file.path.normalize('NFC').toLowerCase();
    if (seen.some(p => p === key || p.startsWith(key + '/') || key.startsWith(p + '/'))) throw Error('Duplicate or conflicting file paths');
    seen.push(key); bytes += Buffer.byteLength(file.content);
    if (bytes > 256 * 1024) throw Error('Generated files exceed 256 KiB');
  }
  return value.files;
}
const instructions = {
  text: 'Answer the user request directly.',
  code: 'Return only the requested source code as plain text. Do not include explanations or Markdown fences.',
  files: 'Return only a JSON object with this schema: {"files":[{"path":"relative/path.ext","content":"complete UTF-8 text"}]}. Use 1..16 files with portable relative paths and no other fields. Do not use Markdown fences. File contents must be complete, not patches or placeholders.',
};

export async function runPrompt(options, { root = fileURLToPath(new URL('..', import.meta.url)), fetchImpl = fetch } = {}) {
  const mode = options.mode ?? 'text'; const maxTokens = Number(options.maxTokens ?? 1000);
  const requestBudget = Number(options.requestBudget ?? 0.10); const totalBudget = Number(options.totalBudget ?? 1);
  if (!Object.hasOwn(instructions, mode)) throw Error('Mode must be text, code or files');
  if (!Number.isInteger(maxTokens) || maxTokens < 1 || maxTokens > 4096) throw Error('max-tokens must be an integer from 1 to 4096');
  if (![requestBudget, totalBudget].every(n => Number.isFinite(n) && n > 0)) throw Error('Budgets must be positive finite USD amounts');
  const prompt = await readFile(resolve(root, options.promptFile), 'utf8');
  if (!prompt.trim() || Buffer.byteLength(prompt) > 32768) throw Error('Prompt must contain 1..32768 UTF-8 bytes');
  const config = { ...process.env };
  for (const name of ['.env', '.env.local', '../.env', '../.env.local']) {
    try {
      for (const line of (await readFile(resolve(root, name), 'utf8')).split(/\r?\n/)) {
        const m = line.match(/^\s*(OPENROUTER_API_KEY|OPENROUTER_MODEL)\s*=\s*(.*?)\s*$/);
        if (m && config[m[1]] === undefined) config[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
      }
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  if (process.env.ALLOW_LOCAL_RESEARCH_API !== '1') throw Error('Set ALLOW_LOCAL_RESEARCH_API=1 explicitly to make a request');
  const key = config.OPENROUTER_API_KEY, model = options.model || config.OPENROUTER_MODEL;
  if (!key || !model) throw Error('Set OPENROUTER_API_KEY and select a model with --model or OPENROUTER_MODEL');
  if (prompt.includes(key)) throw Error('The prompt contains the configured credential; remove it');
  const artifacts = resolve(root, 'artifacts'); const archives = resolve(artifacts, 'analyses');
  await mkdir(archives, { recursive: true });
  const lockPath = resolve(artifacts, 'analysis.lock'); const lock = await open(lockPath, 'wx', 0o600);
  const id = randomUUID(); const runDir = resolve(artifacts, 'generations', id); const archive = resolve(archives, `${id}.json`);
  const request = { model, max_tokens: maxTokens, temperature: 0, provider: { allow_fallbacks: false }, messages: [{ role: 'system', content: instructions[mode] }, { role: 'user', content: prompt }] };
  const record = { study: 'prompt-runner-v1', capturedAt: new Date().toISOString(), provider: 'openrouter', model, max_tokens: maxTokens, mode, promptSha256: createHash('sha256').update(prompt).digest('hex'), request, status: 'preflight' };
  const safe = value => JSON.stringify(value, null, 2).replaceAll(key, '[REDACTED]') + '\n';
  let invoked = false;
  try {
    const ledger = await updateLedger(artifacts);
    if (ledger.requestsWithUnknownCost) throw Error('Earlier requests have unknown cost; review provider activity before another request');
    const catalogResponse = await fetchImpl('https://openrouter.ai/api/v1/models', { signal: AbortSignal.timeout(15000), redirect: 'error' });
    if (!catalogResponse.ok) throw Error('Model catalog request failed');
    const info = (await catalogResponse.json()).data?.find(m => m.id === model);
    if (!info) throw Error('Model unavailable');
    const rates = [info.pricing, ...(info.pricing?.overrides ?? [])];
    const inputs = rates.map(p => Number(p?.prompt ?? info.pricing?.prompt));
    const outputRates = rates.map(p => Number(p?.completion ?? info.pricing?.completion));
    const fixedFee = Number(info.pricing?.request ?? 0);
    if (![...inputs, ...outputRates, fixedFee].every(n => Number.isFinite(n) && n >= 0)) throw Error('Model pricing unknown');
    const inputAllowance = Buffer.byteLength(JSON.stringify(request.messages)) + 1024;
    const bound = inputAllowance * Math.max(...inputs) + maxTokens * Math.max(...outputRates) + fixedFee;
    if (bound > requestBudget || ledger.reportedCostUSD + bound > totalBudget) throw Error('Conservative request estimate exceeds the per-request or cumulative budget');
    record.conservativeRequestBoundUSD = bound; record.pricing = info.pricing; record.priorReportedCostUSD = ledger.reportedCostUSD;
    await mkdir(dirname(runDir), { recursive: true }); await mkdir(runDir, { mode: 0o700 });
    record.status = 'started'; await writeFile(archive, safe(record), { mode: 0o600 }); invoked = true;
    const response = await fetchImpl('https://openrouter.ai/api/v1/chat/completions', { method: 'POST', signal: AbortSignal.timeout(60000), redirect: 'error', headers: { 'content-type': 'application/json', Authorization: `Bearer ${key}` }, body: JSON.stringify(request) });
    record.httpStatus = response.status;
    const body = await response.json(); record.rawResponse = body; record.usage = body.usage;
    if (!response.ok || body.error) throw Error(`Provider returned HTTP ${response.status}; no retry performed`);
    record.stopReason = body.choices?.[0]?.finish_reason;
    const text = body.choices?.[0]?.message?.content;
    if (typeof text !== 'string' || !text.trim()) throw Error('Provider returned no text');
    record.content = [{ type: 'text', text }];
    await writeFile(resolve(runDir, 'response.txt'), text.replaceAll(key, '[REDACTED]'), { flag: 'wx', mode: 0o600 });
    if (record.stopReason !== 'stop') throw Error(`Response incomplete (${record.stopReason}); raw response saved, generated files not materialized`);
    let outputs;
    if (mode === 'files') outputs = validateFiles(JSON.parse(unwrapFence(text)));
    else outputs = [{ path: mode === 'code' ? 'code.txt' : 'answer.txt', content: mode === 'code' ? unwrapFence(text) : text }];
    const filesRoot = resolve(runDir, 'files'); await mkdir(filesRoot, { mode: 0o700 });
    for (const file of outputs) {
      const target = resolve(filesRoot, file.path);
      await mkdir(dirname(target), { recursive: true, mode: 0o700 });
      await writeFile(target, file.content.replaceAll(key, '[REDACTED]'), { flag: 'wx', mode: 0o600 });
    }
    record.status = 'completed'; record.outputFiles = outputs.map(f => `files/${f.path}`);
  } catch (error) {
    if (invoked) { record.status = 'failed'; record.error = error.message.replaceAll(key, '[REDACTED]'); }
    throw new Error(error.message.replaceAll(key, '[REDACTED]'));
  } finally {
    try {
      if (invoked) { record.finishedAt = new Date().toISOString(); await writeFile(archive, safe(record)); await writeFile(resolve(runDir, 'record.json'), safe(record), { mode: 0o600 }); }
      await updateLedger(artifacts);
    } finally { await lock.close(); await unlink(lockPath); }
  }
  return { runDir, usage: record.usage, outputFiles: record.outputFiles, costKnown: typeof record.usage?.cost === 'number' && Number.isFinite(record.usage.cost) && record.usage.cost >= 0 };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { values } = parseArgs({ options: { 'prompt-file': { type: 'string' }, model: { type: 'string' }, mode: { type: 'string', default: 'text' }, 'max-tokens': { type: 'string', default: '1000' }, 'request-budget-usd': { type: 'string', default: '0.10' }, 'total-budget-usd': { type: 'string', default: '1' }, help: { type: 'boolean', short: 'h' } } });
    if (values.help) console.log('Usage: npm run prompt -- --prompt-file FILE [--model ID] [--mode text|code|files] [--max-tokens 1..4096] [--request-budget-usd 0.10] [--total-budget-usd 1]');
    else {
      if (!values['prompt-file']) throw Error('--prompt-file is required');
      const result = await runPrompt({ promptFile: values['prompt-file'], model: values.model, mode: values.mode, maxTokens: values['max-tokens'], requestBudget: values['request-budget-usd'], totalBudget: values['total-budget-usd'] });
      console.log(`Saved ${result.outputFiles.length} output(s) under ${result.runDir}`);
      console.log(result.costKnown ? `Reported cost: $${result.usage.cost.toFixed(6)}; cumulative ledger updated.` : 'Cost unavailable; review provider activity before another request.');
      if (!result.costKnown) process.exitCode = 1;
    }
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
