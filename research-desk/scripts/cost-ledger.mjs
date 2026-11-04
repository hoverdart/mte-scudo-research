#!/usr/bin/env node
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function summarizeCosts(records) {
  const entries = records.map(({ file, record: r }) => {
    const cost = r.usage?.cost;
    const known = typeof cost === 'number' && Number.isFinite(cost) && cost >= 0;
    return { file, capturedAt: r.capturedAt, provider: r.provider, model: r.model, status: r.status, stopReason: r.stopReason, promptVersion: r.promptVersion, promptSha256: r.promptSha256, sourceSha256: r.sourceSha256, inputTokens: r.usage?.prompt_tokens ?? r.usage?.input_tokens, outputTokens: r.usage?.completion_tokens ?? r.usage?.output_tokens, reportedCostUSD: known ? cost : null };
  }).sort((a, b) => (a.capturedAt || '').localeCompare(b.capturedAt || '') || a.file.localeCompare(b.file));
  return { updatedAt: new Date().toISOString(), currency: 'USD', basis: 'Provider-reported usage.cost from each unique archived request; unknown costs are not treated as free. Excludes other key users, credit purchases and fees.', requestCount: entries.length, reportedCostUSD: Number(entries.reduce((sum, e) => sum + (e.reportedCostUSD ?? 0), 0).toFixed(12)), requestsWithUnknownCost: entries.filter(e => e.reportedCostUSD === null).length, entries };
}
export async function updateLedger(directory = 'artifacts') {
  const files = (await readdir(resolve(directory, 'analyses'))).filter(f => f.endsWith('.json'));
  const records = await Promise.all(files.map(async file => {
    const record = JSON.parse(await readFile(resolve(directory, 'analyses', file), 'utf8'));
    return { file, record };
  }));
  const ledger = summarizeCosts(records);
  await writeFile(resolve(directory, 'cost-ledger.json'), JSON.stringify(ledger, null, 2) + '\n');
  return ledger;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const ledger = await updateLedger();
  console.log(`${ledger.requestCount} archived requests; reported spend $${ledger.reportedCostUSD.toFixed(6)}; ${ledger.requestsWithUnknownCost} unknown-cost requests. See artifacts/cost-ledger.json`);
}
