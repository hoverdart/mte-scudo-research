#!/usr/bin/env node
// Offline evidence aggregation. Does not contact providers or consume credits.
import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fixtures, root, hash } from './benchmark-core.mjs';
import { updateLedger, summarizeCosts } from './cost-ledger.mjs';
const artifacts=resolve(root,'artifacts');
const output=resolve(root,'docs/results');
const read=async path=>JSON.parse(await readFile(resolve(artifacts,path),'utf8'));
const scores=await read('benchmark/scores.json');const oracle=await read('benchmark/oracle.json');
await updateLedger(artifacts);
const baselineArchives=[];for(const file of(await readdir(resolve(artifacts,'analyses'))).filter(f=>f.endsWith('.json'))){const record=JSON.parse(await readFile(resolve(artifacts,'analyses',file),'utf8'));if(record.study===undefined||record.study==='defensive-path-pilot-v1')baselineArchives.push({file,record});}
const ledger=summarizeCosts(baselineArchives);const dav1d=await read('upstream/record.json');const media=await read('upstream/media-results.json');const skia=await read('skia/record.json');
if(!dav1d.passed||!skia.passed||media.length!==8||media.some(r=>!r.passed||r.repeats!==2))throw Error('Incomplete local library evidence');
if(scores.results.length!==7||ledger.requestsWithUnknownCost||ledger.reportedCostUSD>0.50)throw Error('Incomplete benchmark or accounting evidence');
for(const [name,f]of Object.entries(fixtures)){
  const r=oracle.results.find(r=>r.fixture===name);
  if(!r?.allPredictionsCorrect||!r.fullBranchCoverage||r.sourceSha256!==hash(await readFile(resolve(root,f.source))))throw Error('Oracle/source mismatch');
  const pair=scores.results.filter(r=>r.fixture===name&&!r.model.includes('opus'));
  if(pair.length!==2||pair[0].promptSha256!==pair[1].promptSha256||pair.some(m=>m.sourceSha256!==r.sourceSha256))throw Error('Unmatched model comparison');
}
const requests=[];
for(const file of (await readdir(resolve(artifacts,'analyses'))).filter(f=>f.endsWith('.json'))){
  const bytes=await readFile(resolve(artifacts,'analyses',file));const r=JSON.parse(bytes);
  if(r.study!==undefined&&r.study!=='defensive-path-pilot-v1')continue;
  // Explicit allowlist excludes headers, credentials and unrelated environment values.
  requests.push({archive:file,archiveSha256:r.restoredFromArchiveSha256??hash(bytes),capturedAt:r.capturedAt,sourceRevision:r.sourceRevision,study:r.study,fixture:r.fixture,model:r.model,provider:r.provider,max_tokens:r.max_tokens,promptVersion:r.promptVersion,promptSha256:r.promptSha256,sourceSha256:r.sourceSha256,status:r.status,stopReason:r.stopReason,httpStatus:r.httpStatus,usage:r.usage,request:r.study==='defensive-path-pilot-v1'?r.request:undefined,content:r.content});
}
requests.sort((a,b)=>a.capturedAt.localeCompare(b.capturedAt));
const report={generatedAt:new Date().toISOString(),researchQuestion:'Can a cheaper model reliably replace a stronger one for correct branch-complete regression proposals on these safe fixtures?',answer:'Not supported by this pilot. Measured model errors persist at every model tier; executable validation is necessary. No general capability or exploitation conclusion.',benchmark:scores,oracle:oracle.results,localLibraries:{dav1d:{passed:dav1d.passed,revision:dav1d.revision,media,sanitizerSettings:dav1d.sanitizerSettings},skia:{passed:skia.passed,revision:skia.pinned,dependencyPins:skia.dependencyPins,sourceAndInputHashes:skia.inputAndSourceHashes,results:skia.results,repeats:skia.repeats,sanitizerSettings:skia.sanitizerSettings,limitations:skia.limitations}},costLedger:ledger,limitations:['Three authored safe fixtures; one sample per paired model and task.','Secondary fence-only normalization was added after the first pair. Primary strict results are unchanged.','Per-test accuracy includes repeated model proposals and correlated inputs; it is descriptive, not a statistically independent sample.','Opus is an adaptive one-task escalation, not a matched three-task comparison.','Ordinary raster/video success does not establish library-wide coverage or reproduce any CVE.','No exploit, corruption primitive, reclaim, target objects, live devices, MTE or Scudo measurements.']};
await mkdir(output,{recursive:true});
await writeFile(resolve(output,'requests.json'),JSON.stringify(requests,null,2)+'\n');
await writeFile(resolve(output,'study-results.json'),JSON.stringify(report,null,2)+'\n');
const g=scores.grouped;const rows=Object.entries(g).map(([model,r])=>`| ${model.split('/')[1]} | ${r.tasks} | ${r.correctPredictions}/${r.predictions} | ${r.semanticSuccesses}/${r.tasks} | ${r.successes}/${r.tasks} | $${r.costUSD.toFixed(6)} |`).join('\n');
const text=`# Defensive execution-path pilot results

The cheaper-model equivalence hypothesis is **not supported by this pilot**.
Models at every tested tier supplied incorrect expected outputs, even for small
safe programs. Model-proposed regression inputs require executable validation.
These results concern defensive analysis, not exploit capability.

| Model | Tasks | Correct predictions | Correct + full coverage, fence-only diagnostic | Strict successes | Benchmark cost |
| --- | ---: | ---: | ---: | ---: | ---: |
${rows}

Three fixed fixtures each have a trusted local oracle with 100% measured branch
outcomes: toy 10/10, flags 10/10, record 14/14. Models saw source, not oracle tests.
Paired Haiku/Sonnet requests had matching prompt hashes, source and 1000-token
caps. Seven benchmark requests followed the frozen protocol; no retries occurred.
The record task triggered the one permitted Opus escalation after Sonnet failed.

All six Haiku/Sonnet responses used a Markdown JSON fence despite the format
instruction. Those remain strict failures. The separate, explicitly adaptive
secondary analysis removed only the exact outer fence, with no value repair.
Sonnet's toy suite was correct and branch-complete; other suites had wrong
predictions, incomplete coverage, or both. Opus returned strict JSON but had
13/16 correct predictions and 13/14 branch outcomes on the record task.

The strict/secondary distinction matters: coverage can be complete even when
expected return values are wrong. Haiku's toy suite had 10/10 branch outcomes
but only 12/16 correct predictions; Sonnet's record suite had 14/14 outcomes
but only 12/16 correct predictions. Duplicate proposals are retained and disclosed.

Examples verified against compiled source:

- Haiku classified the A-prefixed input 4121 as result 2; actual result is 1.
- Sonnet classified flag bytes 8001 as result 3; actual result is 4.
- Opus classified the two-byte record 0158 as result 3; the short-length guard
  returns 1 before inspecting that record's other conditions.

Haiku's three suites cost $0.008135 versus Sonnet's $0.018330. Lower cost did not
produce equivalent results here; Sonnet also failed two of three semantic suites.
The Opus escalation cost $0.008250 and did not fix the hardest task. This supports
using models to propose candidates behind a local oracle, not paying repeatedly
for progressively stronger prose in the hope that it becomes ground truth.

Local library evidence:

- dav1d ${dav1d.revision}: six header tests and lifecycle assertions pass under
  ASan/UBSan. Eight ordinary black clips vary 8/10-bit depth, 64x64/96x64 dimensions
  and 1/3 frames. Every output passes pixel and byte-count checks and repeats
  identically across two decodes (16 decodes total).
- Skia ${skia.pinned}: native CPU-only debug ASan/UBSan build with pinned libpng
  and zlib. Known-color clear/draw/clip, readback, PNG encode and PNG decode pass
  at 8x8, 16x9 and 32x32, verifying 1232 pixels per raster and round-trip pass.
  Two runs produce identical PNG hashes. Upstream sanitizer suppressions apply;
  fonts, GPU paths and PartitionAlloc are disabled in this reduced build.

Total reported cost across **${ledger.requestCount}** archived requests, including earlier
prose trials: **$${ledger.reportedCostUSD.toFixed(6)}**. Unknown-cost requests: ${ledger.requestsWithUnknownCost}.
This is harness spending only, not the key's balance or colleague's spending.
Full provider usage and redacted request/response evidence: [requests.json](requests.json).
Machine-readable measurements: [study-results.json](study-results.json).

This is a small exploratory study, not a statistical equivalence test: three
authored fixtures, one sample per pair, correlated/redundant proposals, and an
adaptive format diagnostic. Opus had only one selected task. No model rankings
should be generalized from these counts. No unsafe model code was executed.
No CVE, MTE/Scudo behavior or Android security outcome was reproduced.

Reproduce locally from research-desk:

\`\`\`sh
npm run benchmark:oracle
npm run benchmark:score
npm run experiment:dav1d
npm run experiment:skia
npm run study:report
npm test
npm run check
npm run costs
\`\`\`

These commands make no model requests. The Skia/dependency bootstrap is separate;
see [STUDY_PROTOCOL.md](../STUDY_PROTOCOL.md), [REPRODUCE.md](../REPRODUCE.md),
[PATCH_REVIEW.md](../PATCH_REVIEW.md), and [PROMPTING.md](../PROMPTING.md).
No further paid calls are needed to reproduce this completed pilot's scoring.
`;
await writeFile(resolve(output,'REPORT.md'),text);
console.log(`Saved docs/results/REPORT.md, study-results.json and requests.json; cumulative spend $${ledger.reportedCostUSD.toFixed(6)}`);
