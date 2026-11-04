# Experiment scope

## Phase 0 — baseline

- Keep all inputs local and deterministic.
- Use AddressSanitizer/UndefinedBehaviorSanitizer where available.
- Capture the command, commit, compiler flags, input hash, exit status, and sanitizer report.
- Establish a clean baseline with ordinary, non-malformed inputs.

## Phase 1 — toy execution paths

Use short programs that parse a byte buffer and call named functions. The question is: “Which input reaches which function, and what is the observed allocation/free sequence?” Add assertions and tracing before adding malformed inputs.

## Phase 2 — synthetic memory-safety fixtures

Use a deliberately tiny fixture that demonstrates detection of a stale handle or bounded-length error under sanitizers. Measure reachability and detector coverage only. Do not turn the fixture into a reusable overwrite, arbitrary-address write, control-flow hijack, or permission-changing payload.

## Phase 3 — patched upstream builds (approval required)

Only after written approval, build a fixed/current Skia or dav1d revision locally. Reproduce public regression tests or minimized, non-weaponized crash inputs. Validate documented regression expectations on the approved patched build. Do not test Android system services, security-critical objects, or escalation targets.

## Model and spending policy

Use the cheaper model for summarization, test-case naming, and log classification. Send only small, redacted snippets to the stronger model for ambiguous call-graph questions. Set a low per-request token cap, one request at a time, and keep prompts free of secrets and proprietary source. The included script defaults to Anthropic's small output budget and requires an explicit opt-in environment variable.

## Local run

From `research-desk/`:

```sh
test -e .env || cp ../.env.example .env   # preserve any existing credentials
npm run experiment         # no network; writes artifacts/baseline.json and baseline.log
ALLOW_LOCAL_RESEARCH_API=1 npm run analyze-path
```

The API command reads `.env` automatically, caps the response at 1,000 tokens, and sends only `fixtures/toy_path.c` for the default npm command. No request is made during local verification.

## Reviewed baseline and next experiment

`process_input(buf, len)` calls `classify`. The caller must supply a valid
buffer of at least `len` bytes; NULL is allowed only for zero length.

| Input | Result | Path |
| --- | --- | --- |
| empty | 0 | length check returns immediately |
| A, A! | 1 | first byte A |
| B! | 2 | B, length at least two, second byte ! |
| B | 3 | B but short length; second byte is never read |
| Bx | 3 | second byte differs |
| C | 3 | neither A nor B |

The smallest next experiment is the included seven-case C driver: compile and
execute it with ASan/UBSan, assert results, and preserve stdout/stderr. Run:

```sh
cd research-desk
npm run experiment
npm test
npm run check
```

Expected: seven case lines, exit zero, no sanitizer diagnostics. Local artifacts:
`artifacts/toy-path`, `artifacts/baseline.json`, `artifacts/baseline.log`.
The JSON records Git revision and dirty status, fixture and driver SHA-256
(the driver contains the exact inputs), compiler version and flags, sanitizer
settings, commands, exit statuses/signals, and logs. These are local ignored files.
The baseline asserts case results. `npm run experiment:coverage` separately measures
LLVM branch coverage; the reviewed run covers all 10 fixture branch outcomes.

Before optional API use, copy the template to `research-desk/.env`, select an
explicit supported low-cost model in your account, and add the key locally.
Run exactly one `ALLOW_LOCAL_RESEARCH_API=1 npm run analyze-path` request.
`artifacts/analysis.json` records source hash, model, output cap, returned usage,
stop reason and response. Review usage before another call; there are no retries.
The cap is 700 output tokens by default (hard ceiling 1000), input is capped at
12,000 bytes, and timeout is 30 seconds. These bounds are not a dollar budget:
configure the provider's spending limit separately. Never run this in a loop.
A timeout may still incur provider charges; do not retry automatically.

Stop on a compiler failure, timeout, assertion failure, sanitizer diagnostic,
unexpected path result, API error or truncated response. Preserve the evidence
and review before continuing. The user approved the defensive upstream pilot on November 3, 2026. The pinned
dav1d pilot below defines its revision, configuration, inputs, limits and criteria.
Review those details before changing the upstream revision or test corpus. No vulnerable-version
comparison or live-device work is authorized by this baseline.

## OpenRouter or direct Anthropic

The analysis script supports both providers, selected explicitly with
`RESEARCH_API_PROVIDER=anthropic` (default) or `openrouter` in the local `.env`.
For OpenRouter, fill `OPENROUTER_API_KEY` and `OPENROUTER_MODEL` (the exact model
ID including its provider prefix). For direct Anthropic, fill
`ANTHROPIC_API_KEY` and `ANTHROPIC_MODEL`. Do not interchange their keys.
`ANTHROPIC_MAX_TOKENS` is the shared output cap for either route.
OpenRouter provider fallbacks are disabled. Neither route retries automatically.
Before opting in, set a small key spending limit in your provider dashboard;
the script cannot enforce an account-wide dollar budget. Start with a $1 key
limit rather than exposing the whole $50 balance to this experiment.


## Implemented observability experiments

Run from `research-desk/`; all commands below are local and make no model calls:

```sh
npm run experiment
npm run experiment:coverage
npm run experiment:lifetime
npm run experiment:detectors
npm run experiment:dav1d
npm test
npm run check
```

- `coverage`: LLVM instrumentation at `-O0`, separate from sanitizers. Seven
  cases cover both outcomes of all five fixture conditions (10/10), both
  functions and all nine counted source lines. The command fails if fixture
  branch coverage is incomplete. View `artifacts/coverage/html/index.html`;
  JSON, text report, raw/merged profiles and a command record live beside it.
  This number describes only `toy_path.c`, not the driver or upstream project.
- `lifetime`: a real 16-byte malloc, initialized reads, free and pointer clear.
  Logs use an opaque ID. No read occurs after free, and no reuse is measured.
- `detectors`: an isolated fixed signed-integer-overflow positive control for
  UBSan. A nonzero exit or SIGABRT plus the expected diagnostic is required;
  missing diagnostics, timeouts or unrelated signals fail the experiment.
  This is the only expected sanitizer failure. It performs no memory corruption.
  ASan is enabled for clean runs; its fault-detection capability is not tested.

Each mode writes `artifacts/<mode>/record.json` and `run.log` with revision,
dirty status, source/input SHA-256, flags, tool versions, sanitizer settings,
commands and termination status. Inputs are fixed in hashed sources. Observation
steps time out after 30 seconds. Preserve records before rerunning; named local
records are overwritten. Model response archives are retained individually.

## Approved dav1d pilot

The current maintained upstream snapshot was fetched on November 3, 2026 from
[VideoLAN's official mirror](https://github.com/videolan/dav1d), and pinned to
`e5af12796d46cd7788e5f5349da1a27c5f7a8f1a` (1.5.5 development snapshot).
This is a maintained snapshot containing upstream fixes, not a guarantee that
it has no defects. No older vulnerable build is used. Build options and tests
were checked against that snapshot's `meson_options.txt`, `tests/meson.build`,
README and public API headers.

The pilot uses a debug C build with ASan/UBSan, assembly disabled, at most two
build jobs and one test process. It runs six upstream header tests, a
single-threaded open/get-picture-without-input/flush/close contract check, and
one generated ordinary AV1 frame. The frame is 64x64 black YUV420; decoding
must produce exactly 6144 bytes with luma within one of 16 and chroma within
one of 128. Every subprocess has a 120-second timeout. These are time and
parallelism bounds, not an enforced memory quota.

The study passed locally with Apple clang 21, Meson 1.12.1, Ninja 1.13.2 and
FFmpeg 8.1.2 with libsvtav1. Local bootstrap (downloads tools/source once):

```sh
mkdir -p artifacts/upstream
python3 -m venv artifacts/upstream/tools
artifacts/upstream/tools/bin/python -m pip install meson==1.12.1 ninja==1.13.2
git clone https://github.com/videolan/dav1d.git artifacts/upstream/dav1d
git -C artifacts/upstream/dav1d checkout --detach e5af12796d46cd7788e5f5349da1a27c5f7a8f1a
npm run experiment:dav1d
```

FFmpeg with the libsvtav1 encoder must already be installed. The runner itself
performs no downloads and rejects a changed revision or dirty source (apart
from Meson's generated `.wraplock`). It records the generation command, tool
versions and hashes in `artifacts/upstream/record.json`; build configuration,
compiler commands and upstream test logs remain in `artifacts/upstream/build/`.

Reviewed input SHA-256:
`52cfb153a24796593b228c7998368fa0975040b83098b9ed008937a67838d9fc`.
Decoded frame SHA-256:
`ea9e3dd5ac3926c3b532515984de59fece80f298e98b6e0d0791d0a6d43bc3c5`.
Encoded bytes can differ with encoder versions; the runner records actual hashes
and verifies semantic pixel expectations rather than claiming byte identity
across encoders. No downloaded crash corpus, fuzzing or vulnerable-version
comparison is part of this pilot. Skia is deferred to keep the study frugal.

This macOS build does not measure Scudo or MTE. A later study needs a supported
local userspace environment, exact allocator/toolchain configuration, evidence
that tagging is active, and the same ordinary inputs. No live-device, driver,
kernel or security-object target is included.

## Optional bounded model assessment

No paid assessment has run. Choose model IDs and provider limits before making
any request. Each invocation makes one request with the same source/prompt and
output cap. Review the cheaper response and usage first; run a reference model
only if a concrete unresolved question justifies its cost. Do not automate a
batch. Each result is archived under `artifacts/analyses/<unique-id>.json`,
with the latest also at `artifacts/analysis.json`. Prompt hash, source hash,
revision, provider/model, usage and completion reason are recorded. A local
exclusive lock prevents overlapping requests from this working directory.
If a process is killed, inspect the leftover lock and request status before
removing it manually; do not assume it means nothing was charged.

After two deliberately selected complete responses, compare offline:

```sh
npm run compare-analysis -- artifacts/analyses/CHEAPER.json artifacts/analyses/REFERENCE.json
```

Different source/prompt hashes or output caps are rejected. The worksheet at
`artifacts/model-comparison.json` has six explicit criteria scored manually
0/1/2. It starts unscored and makes no equivalence claim. Record provider-reported
cost (OpenRouter may include it in usage) and dashboard evidence; token counts
alone are not dollars. A single pair is a pilot, not evidence of general model
capability or savings. No credentials enter reports or prompts.

## Stop rules for this implementation

Stop immediately on unexpected sanitizer diagnostics, assertion/pixel mismatch,
missing tools, incomplete coverage, compiler/test failure, timeout, changed
upstream revision or an API error/truncation. The expected UBSan positive control
is allowed only in its isolated detector command. Preserve evidence and review
before rerunning. Do not expand into corruption characterization, allocator
reuse strategies, target objects, bypasses or escalation. Treat any unexpected
crash as a defensive test result, never as proof of exploitability.


The analysis prompt now uses version 2: at most 300 words, four numbered
sections, no code blocks or tables, exhaustive fallback conditions, caller
preconditions and explicit limits on unmeasured claims. This keeps the existing
output ceiling while reducing verbose generated test code. Version and prompt
hash are recorded; changed prompts are separate experiments, not matched model
comparisons. Offline tests also verify truncation is preserved and fails closed.
