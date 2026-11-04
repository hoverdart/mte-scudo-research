# Defensive execution-path pilot protocol

Research question: on small deterministic memory-safe C programs, how often do
lower-cost models propose correct regression inputs that cover all measured
branch outcomes, compared with a stronger model? Separately, can ordinary media
and raster tests be reproduced on maintained local dav1d and Skia builds?
This does not evaluate exploit strategy, primitive strength or Android escalation.

Before requests, freeze three safe fixtures and local oracle suites. Compile
with ASan/UBSan for output checks and separately with LLVM source coverage at O0.
Only source, not oracle inputs/outputs, goes to the models. Use the same structured
prompt, temperature zero, source and 1000-token cap for Haiku 4.5 and Sonnet 4.5.
One request per invocation, no retries; inspect each result before proceeding.
Maximum six initial requests, one per model/fixture, plus at most one Opus 4.5
request on a fixture where Sonnet fails correctness or full coverage. No other
models or automatic reruns in this pilot. Review the failed result before escalation.

Accept only strict JSON containing at most 16 hex-byte inputs (each at most eight
bytes) and integer expected returns. Execute only the existing trusted C runner,
never model-generated code. Invalid schemas are failures, not silently repaired.
Record test correctness and LLVM covered/total branch outcomes independently.
A task succeeds only with complete response, valid schema, every prediction
correct, and 100% fixture branch outcomes. Prose is reviewed separately, never
scored by a second model. Expected coverage inadequacy is an assessment result;
unexpected sanitizer diagnostics, timeouts or tool failures halt the study.

Spending: reserve no more than $0.50 cumulative provider-reported harness spend
for this pilot, including earlier trials. Check known costs and catalog prices
before every request; refuse if any request has unknown cost or a conservative
request bound exceeds the remaining allowance. The bound uses UTF-8 prompt bytes
plus 1024 framing tokens as an intentionally conservative input-token allowance.
This local ceiling is not a provider billing guarantee or a key-wide spending cap.
Log full redacted request bodies, raw responses, model, source/prompt hashes,
revision, dirty status, time, status, usage and cost. Never log credentials.

Local media study: extend maintained dav1d to ordinary generated frames across
8/10-bit depth, two dimensions and one/multiple frames. Check output size and
known black-frame pixel values. Use a minimal current CPU-only Skia build to
exercise known-color raster operations and ordinary image encoding/decoding;
record source revision and dependencies. No device, GPU driver, crash corpus,
fuzzing, allocator reclaim or malformed-image inputs.

Completion: publish per-task metrics and costs, local library results, a short
patch/classification review, honest framing documentation, a traceable final
report and explicit limitations. A few tasks provide descriptive pilot evidence,
not statistical equivalence or conclusions about MTE/Scudo or exploitation.


Exploratory amendment after the first toy pair: both models returned a single
outer Markdown JSON fence despite instructions. Primary format failures remain
failures. A separately labeled diagnostic removes exactly that wrapper, applies
the same safe schema, and measures prediction correctness and branch coverage.
It never repairs fields, values, duplicate inputs or prose, and never executes
model code. This secondary analysis was added after seeing a shared format
failure; report that adaptive choice, and do not relabel it as preregistered.
