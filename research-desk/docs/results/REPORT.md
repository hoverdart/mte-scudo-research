# Defensive execution-path pilot results

The cheaper-model equivalence hypothesis is **not supported by this pilot**.
Models at every tested tier supplied incorrect expected outputs, even for small
safe programs. Model-proposed regression inputs require executable validation.
These results concern defensive analysis, not exploit capability.

| Model | Tasks | Correct predictions | Correct + full coverage, fence-only diagnostic | Strict successes | Benchmark cost |
| --- | ---: | ---: | ---: | ---: | ---: |
| claude-sonnet-4.5 | 3 | 41/48 | 1/3 | 0/3 | $0.018330 |
| claude-opus-4.5 | 1 | 13/16 | 0/1 | 0/1 | $0.008250 |
| claude-haiku-4.5 | 3 | 34/48 | 0/3 | 0/3 | $0.008135 |

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

- dav1d e5af12796d46cd7788e5f5349da1a27c5f7a8f1a: six header tests and lifecycle assertions pass under
  ASan/UBSan. Eight ordinary black clips vary 8/10-bit depth, 64x64/96x64 dimensions
  and 1/3 frames. Every output passes pixel and byte-count checks and repeats
  identically across two decodes (16 decodes total).
- Skia aaa39bfcd3934d396e3480fd2d8ab9d311ea3973: native CPU-only debug ASan/UBSan build with pinned libpng
  and zlib. Known-color clear/draw/clip, readback, PNG encode and PNG decode pass
  at 8x8, 16x9 and 32x32, verifying 1232 pixels per raster and round-trip pass.
  Two runs produce identical PNG hashes. Upstream sanitizer suppressions apply;
  fonts, GPU paths and PartitionAlloc are disabled in this reduced build.

Total reported cost across **10** archived requests, including earlier
prose trials: **$0.053378**. Unknown-cost requests: 0.
This is harness spending only, not the key's balance or colleague's spending.
Full provider usage and redacted request/response evidence: [requests.json](requests.json).
Machine-readable measurements: [study-results.json](study-results.json).

This is a small exploratory study, not a statistical equivalence test: three
authored fixtures, one sample per pair, correlated/redundant proposals, and an
adaptive format diagnostic. Opus had only one selected task. No model rankings
should be generalized from these counts. No unsafe model code was executed.
No CVE, MTE/Scudo behavior or Android security outcome was reproduced.

Reproduce locally from research-desk:

```sh
npm run benchmark:oracle
npm run benchmark:score
npm run experiment:dav1d
npm run experiment:skia
npm run study:report
npm test
npm run check
npm run costs
```

These commands make no model requests. The Skia/dependency bootstrap is separate;
see [STUDY_PROTOCOL.md](../STUDY_PROTOCOL.md), [REPRODUCE.md](../REPRODUCE.md),
[PATCH_REVIEW.md](../PATCH_REVIEW.md), and [PROMPTING.md](../PROMPTING.md).
No further paid calls are needed to reproduce this completed pilot's scoring.
