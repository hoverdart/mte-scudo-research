# Defensive experiment scope and current status

The user authorized autonomous defensive research, within the exclusions below.
The completed pilot asks whether a cheaper model can reliably supply correct,
branch-complete tests on small safe C fixtures, and establishes ordinary local
Skia/dav1d baselines. It does not measure exploit capability.

## Boundaries

Local userspace only. No corruption-primitive characterization, allocator reclaim
strategies, target-object selection, prompt disguise, bypasses, permission changes,
escalation, kernel/driver targets, privileged services or live-device experiments.
No unpatched upstream build or malformed/crash corpus is used. Unexpected crashes
are defensive diagnostics, never evidence of exploitability.

## Measured results

See [the result report](research-desk/docs/results/REPORT.md) and its committed
machine-readable evidence. The cheaper-model equivalence hypothesis is not
supported on this small pilot. Models at all tested tiers supplied wrong expected
outputs. Only Sonnet's simplest suite combined correct predictions with full
branch coverage after an explicitly labeled fence-only format normalization.

- Three safe C oracles cover 10/10, 10/10 and 14/14 LLVM branch outcomes.
- Real safe allocation/read/free/clear tracing passes under ASan/UBSan.
- An arithmetic-only UBSan positive control verifies a matching diagnostic;
  no memory-corruption positive control is included.
- Maintained pinned dav1d: six header tests, lifecycle checks, eight ordinary
  8/10-bit clips across two dimensions and 1/3 frames; each decoded twice with
  pixel, byte-count and repeatability checks.
- Maintained pinned native Skia: three known-color CPU raster sizes and PNG
  encode/decode round trips, each repeated twice under ASan/UBSan. Minimal build
  excludes fonts, GPU paths, PartitionAlloc and unrelated codecs; upstream
  sanitizer suppressions apply.
- Initial pilot: ten model requests, including the earlier prose trials. Provider-reported
  cumulative harness cost: $0.053378. No unknown-cost requests. This is not the
  key balance and excludes other users or billing fees.

## Reproduce without model spending

From `research-desk/`, once local dependencies are prepared:

```sh
npm run study:restore
npm run experiment
npm run experiment:coverage
npm run experiment:lifetime
npm run experiment:detectors
npm run benchmark:oracle
npm run benchmark:score
npm run experiment:dav1d
npm run experiment:skia
npm run study:report
npm test
npm run check
npm run costs
```

Preparation/download commands and platform requirements are in
[REPRODUCE.md](research-desk/docs/REPRODUCE.md). Existing credentials are never
replaced. Native Skia's reviewed build is macOS-only. The model records can be
restored from committed redacted evidence for fresh-clone offline rescoring.
No paid calls are needed to reproduce the completed pilot.

## Inputs, entry points and evidence

The original fixture has the call graph `process_input -> classify`:

| Input | Result | Branch |
| --- | --- | --- |
| empty (NULL, length 0) | 0 | returns before reading |
| A or A! | 1 | first byte A |
| B! | 2 | B, length at least 2, second byte ! |
| B | 3 | B with short length |
| Bx | 3 | B with a different second byte |
| C | 3 | neither A nor B |

All nonempty inputs must point to readable initialized bytes for the supplied
length. The trusted benchmark driver accepts only 0..8 hex bytes; it never
executes model-generated code. Model expected outputs are checked by compiled
source, separately from branch coverage. Full branch coverage does not imply
correct expected outputs or absence of defects.

Local `artifacts/` contains command-by-command records, source/input SHA-256,
source revision and dirty status, compiler/tool versions, flags, sanitizer
settings, exit status/signals, stdout/stderr, coverage data, raw model archives
and a cost ledger. Named local run records overwrite on rerun; preserve them
before changing inputs. Committed redacted model records, measurements and
summaries live in `research-desk/docs/results/`.

## Spending and model protocol

[STUDY_PROTOCOL.md](research-desk/docs/STUDY_PROTOCOL.md) freezes the three tasks,
paired models, response schema, measurement criteria and $0.50 cumulative pilot
ceiling. Seven benchmark requests were made: three each for Haiku/Sonnet 4.5,
then one Opus 4.5 escalation after a scored Sonnet failure. Earlier prose trials
are accounted for but excluded from benchmark scores. The prompt/task changed
from prose to structured test proposals, so those are separate experiments.

Each request is sequential, uses a 1000-token output cap, and has no retry. The
benchmark records the exact nonsecret request, response, hashes, revision,
timing, usage and provider-reported cost. It rejects duplicate model/task pairs,
unknown earlier costs and a conservative price bound exceeding the remaining
pilot allowance. The bound is not an account-wide billing guarantee. The local
`.env` selects provider/model and stores credentials; it cannot opt into requests.
Keys and local artifacts are ignored. Do not paste credentials into prompts.

Both providers remain supported by `npm run analyze-path`; that standalone
command has its own 1..1000 output-token validation. It is not permission for an
unbounded new batch. Any new paid study should state its amended protocol first.
`npm run costs` recomputes the local ledger without making requests.

## Stop conditions and limits

Stop on an unexpected sanitizer diagnostic, timeout, compiler/test failure,
pixel/size/repeatability mismatch, changed pinned upstream source or missing
tools. The fixed arithmetic UBSan diagnostic is expected only in the detector
command. API errors/truncation stop that attempt with no retry. Wrong model
predictions and invalid model schemas are study outcomes, not grounds to weaken
the oracle or silently repair answers. Preserve evidence before any continuation.

[PATCH_REVIEW.md](research-desk/docs/PATCH_REVIEW.md) records public fix/class
review and a verified temporal-safety literature candidate. No CVE is reproduced.
[PROMPTING.md](research-desk/docs/PROMPTING.md) keeps the cybersecurity purpose
explicit rather than concealing it.

This study does not establish general model rankings, equivalence, Android
security outcomes, library-wide coverage or MTE/Scudo behavior. A future MTE/Scudo
study needs a supported local userspace environment, pinned allocator/toolchain,
and evidence that the intended instrumentation is active. It does not inherit
permission for live devices or any excluded exploit work.


## Three-track expansion

The November 4 expansion separately measures real dav1d/Skia coverage, model
predictions on an actual upstream API driver, and safe Linux Scudo observability
with a read-only MTE capability probe. See
[the expansion report](research-desk/docs/expansion/REPORT.md) and
[its protocol](research-desk/docs/expansion/PROTOCOL.md). The historical pilot
cost above is retained; `npm run costs` reports current cumulative usage.
