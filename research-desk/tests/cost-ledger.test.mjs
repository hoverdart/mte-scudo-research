import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeCosts } from '../scripts/cost-ledger.mjs';
test('ledger counts truncated billed results and flags unknown costs without estimating them', () => {
  const records = [
    {file:'a', record:{status:'completed', stopReason:'length', usage:{cost:0.005278}}},
    {file:'b', record:{status:'completed', usage:{cost:0.003575}}},
    {file:'c', record:{status:'failed'}},
    {file:'d', record:{usage:{cost:0}}},
  ];
  const r = summarizeCosts(records);
  assert.equal(r.requestCount, 4);
  assert.equal(r.reportedCostUSD, 0.008853);
  assert.equal(r.requestsWithUnknownCost, 1);
  assert.equal(r.entries.find(e=>e.file==='c').reportedCostUSD, null);
});
