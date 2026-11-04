import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeCoverage } from '../scripts/coverage-summary.mjs';
test('coverage summaries exclude CLI/external files and retain uncovered source outcomes',()=>{
  const summary=branches=>({branches,functions:{count:1,covered:1},lines:{count:4,covered:2},regions:{count:4,covered:2}});
  const r=summarizeCoverage({data:[{files:[{filename:'/src/lib/a.c',summary:summary({count:10,covered:4})},{filename:'/src/tools/cli.c',summary:summary({count:100,covered:100})},{filename:'/src/library-other/b.c',summary:summary({count:20,covered:20})}],functions:[{name:'a',count:1,filenames:['/src/lib/a.c']},{name:'b',count:0,filenames:['/src/lib/a.c']},{name:'cli',count:1,filenames:['/src/tools/cli.c']}]}]},'/src/lib');
  assert.equal(r.totals.branches.count,10);
  assert.equal(r.totals.branches.covered,4);
  assert.equal(r.totals.branches.percent,40);
  assert.deepEqual(r.executedFunctions.map(f=>f.name),['a']);
  assert.deepEqual(r.unexecutedFunctions.map(f=>f.name),['b']);
});
