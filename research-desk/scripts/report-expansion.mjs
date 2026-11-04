#!/usr/bin/env node
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { updateLedger } from './cost-ledger.mjs';
import { scoreLifetime } from './upstream-score.mjs';
const root=fileURLToPath(new URL('..',import.meta.url));const base=resolve(root,'artifacts/expansion');const output=resolve(root,'docs/expansion');await mkdir(output,{recursive:true});
const read=async p=>JSON.parse(await readFile(resolve(base,p),'utf8'));
const dav=await read('coverage/record.json'),skia=await read('skia-coverage/record.json'),allocator=await read('allocator/record.json'),task=await read('upstream-model/task.json');
if(!dav.passed||!skia.passed||!allocator.passed)throw Error('A local expansion track is incomplete');
const requests=[];
for(const file of(await readdir(resolve(root,'artifacts/analyses'))).filter(f=>f.endsWith('.json'))){const bytes=await readFile(resolve(root,'artifacts/analyses',file));const r=JSON.parse(bytes);if(r.study!=='expansion-data-lifetime-v1')continue;const scored=scoreLifetime(task.expected,r.content?.[0]?.text??'');requests.push({archive:file,archiveSha256:r.restoredFromArchiveSha256??createHash('sha256').update(bytes).digest('hex'),status:r.status,model:r.model,study:r.study,capturedAt:r.capturedAt,sourceRevision:r.sourceRevision,upstreamRevision:r.upstreamRevision,promptSha256:r.promptSha256,sourceSha256:r.sourceSha256,driverSha256:r.driverSha256,max_tokens:r.max_tokens,request:r.request,content:r.content,usage:r.usage,stopReason:r.stopReason,...scored});}
if(requests.length!==2||requests[0].promptSha256!==requests[1].promptSha256||requests.some(r=>r.stopReason!=='stop'))throw Error('Incomplete matched upstream model pair');
const ledger=await updateLedger(resolve(root,'artifacts'));if(ledger.requestsWithUnknownCost||ledger.reportedCostUSD>0.25)throw Error('Accounting gap or ceiling exceeded');
const newCost=Number(requests.reduce((s,r)=>s+r.usage.cost,0).toFixed(12));
const select=s=>({totals:s.totals,files:s.files.map(f=>({file:f.file,branches:{count:f.summary.branches.count,covered:f.summary.branches.covered},functions:{count:f.summary.functions.count,covered:f.summary.functions.covered}})),executedFunctionEntries:s.executedFunctions.length,unexecutedFunctionEntries:s.unexecutedFunctions.length});
const runtime=allocator.steps.find(s=>s.args?.at(-1)==='/out/scudo-events'&&s.stdout?.includes('"mallocProvider"'));
const baseline=allocator.steps.find(s=>s.args?.at(-1)==='/out/plain-events'&&s.stdout?.includes('"mallocProvider"'));
const summary={generatedAt:new Date().toISOString(),coverage:{dav1d:{baseline:select(dav.results.baseline),combined:select(dav.results.combined),newlyExecutedEntries:dav.results.newlyExecutedFunctions},skia:select(skia.summary)},upstream:{expected:task.expected,requests},allocator:{passed:allocator.passed,sourceSha256:allocator.sourceSha256,dockerfileSha256:allocator.dockerfileSha256,scudo:allocator.scudo,mte:allocator.mte,controlStdout:baseline?.stdout,scudoStdout:runtime?.stdout,scudoStats:runtime?.stderr,imageId:allocator.steps.find(s=>s.args?.includes('inspect'))?.stdout.trim(),interpretation:allocator.interpretation},accounting:{newRequests:requests.length,newCostUSD:newCost,totalRequests:ledger.requestCount,totalReportedCostUSD:ledger.reportedCostUSD,unknown:ledger.requestsWithUnknownCost},limitations:['LLVM-mapped linked source only; excludes disabled/unlinked paths and third-party dependencies. Counts are not dynamic call edges.','The upstream task is prediction on a supplied valid driver, not generation of branch-complete tests. One matched sample, not a general model comparison.','MTE is not advertised by the local Linux VM; no MTE enforcement claim.','Scudo statistics include runtime/stdio activity and are not isolated application allocation counts; no reuse/address characterization.']};
await writeFile(resolve(output,'results.json'),JSON.stringify(summary,null,2)+'\n');
const db=dav.results.baseline.totals.branches,dc=dav.results.combined.totals.branches,sb=skia.summary.totals.branches;
const rows=requests.map(r=>`| ${r.model.split('/')[1]} | ${r.correctScenarios}/4 | ${r.strictFormat?'yes':'no (outer fence)'} | $${r.usage.cost.toFixed(6)} |`).join('\n');
const text=`# Three expansion tracks — November 4, 2026

All three local tracks completed with separate evidence. No corruption/reclaim,
target-object, privilege, driver or live-device experiment was added.

## 1. Actual library execution coverage

| Local corpus/build | Covered mapped branch outcomes | Coverage |
| --- | ---: | ---: |
| dav1d: eight ordinary black clips | ${db.covered}/${db.count} | ${db.percent.toFixed(2)}% |
| dav1d: those clips plus one textured six-frame clip | ${dc.covered}/${dc.count} | ${dc.percent.toFixed(2)}% |
| Skia: three known-color raster/PNG round trips | ${sb.covered}/${sb.count} | ${sb.percent.toFixed(2)}% |

The dav1d addition gained ${dc.covered-db.covered} mapped branch outcomes and
raised mapped source-function coverage from ${dav.results.baseline.totals.functions.covered}/${dav.results.baseline.totals.functions.count} to ${dav.results.combined.totals.functions.covered}/${dav.results.combined.totals.functions.count}. Newly executed
entries include CDEF filtering and directional intra-prediction helpers. There
are ${dav.results.newlyExecutedFunctions.length} newly executed exported function entries; this
is a different instantiation/mapping count from the file-summary function metric.
Skia executed ${skia.summary.totals.functions.covered}/${skia.summary.totals.functions.count} mapped source functions, including raster and PNG codec
operations. Low coverage makes the successful-path baseline's narrowness explicit.

Coverage builds are separate O0 LLVM builds. Decoded/raster outputs are compared
with the sanitizer builds' hashes. The textured clip is also decoded under
ASan/UBSan and repeat-checked. These percentages cover LLVM mappings in linked
library src files only, not every project file, third-party codec, assembly or
GPU path. Function counters establish execution, not call edges or exhaustive paths.

## 2. Model predictions on actual upstream code

The pinned dav1d data API task supplies exact upstream functions and a trusted
valid driver. Models predict callback order and state after setup, release and
a second empty-object release, across four ownership/metadata scenarios.
The compiled ASan/UBSan driver is the oracle. Only instrumented callbacks count.

| Model | Semantically correct scenarios | Strict JSON | Reported cost |
| --- | ---: | --- | ---: |
${rows}

Both models predicted every scenario correctly after the separately labeled
outer-fence removal. The state check includes size zero, timestamp INT64_MIN and
offset -1; the latter defaults require reading the implementation rather than
assuming every field remains zero. This task provides source plus driver and
asks for predictions, unlike the earlier test-generation benchmark. The results
must not be pooled or treated as proof that upstream code is easier in general.
No generated code was executed and no additional escalation was needed.
Upstream excerpts retain attribution in [dav1d-LICENSE](dav1d-LICENSE).

## 3. Allocator and MTE/Scudo observability

An unprivileged local ARM64 Linux container runs the same safe malloc/calloc/
realloc/free fixture with libc and with clang's Scudo runtime. It verifies
calloc zeroing, preserved realloc prefix, and zero fixture-owned requested bytes after
cleanup. Provider inspection identifies libc for the control and the linked
executable for Scudo; defined allocator symbols and Scudo statistics corroborate
binding. No addresses or allocation reuse are characterized.

The local Linux VM reports **MTE not advertised** and tagged-address control
**0**, using read-only capability queries. No mode or page permissions changed.
This is real Scudo userspace evidence but no MTE enforcement measurement.
Scudo statistics include stdio/runtime activity, so they are not an exact count
of the fixture's two logical allocations. Runtime tests have network disabled,
all capabilities dropped, no devices, 256 MiB memory and a 64-PID ceiling.

## Costs, reproduction and limits

Two new requests cost **$${newCost.toFixed(6)}**. Cumulative harness usage is
**$${ledger.reportedCostUSD.toFixed(6)} across ${ledger.requestCount} requests**, with no unknown costs.
The original pilot's report remains a separate ten-request snapshot.
Exact nonsecret requests/responses and summarized measurements are in
[results.json](results.json); full command records are under artifacts/expansion/.

From research-desk, with the previous pinned library dependencies prepared:

\`\`\`sh
npm run study:restore
npm run paths:dav1d
npm run paths:skia
npm run upstream:prepare
npm run allocator:prepare
npm run allocator:observe
npm run expansion:report
npm run costs
npm test
npm run check
\`\`\`

Only allocator preparation downloads container dependencies. None of these
commands makes a paid model request. The two upstream requests are already
archived and the request script rejects duplicates. Query executed functions
with npm run paths:list -- dav1d cdef, or add an empty/literal filter and
--uncovered to inspect gaps. Do not infer a CVE reproduction or mitigation
strength from these safe successful-path observations.

The next small coverage step can add ordinary image transforms/alpha paths and
ordinary decoder content guided by the uncovered-function lists. A separate
supported MTE environment would be required before any MTE measurements.
`;
await writeFile(resolve(output,'REPORT.md'),text);console.log(`Saved expansion report. Two-request cost $${newCost.toFixed(6)}; total $${ledger.reportedCostUSD.toFixed(6)}.`);
