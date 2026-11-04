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
cp ../.env.example .env   # edit only the local copy and add the key
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
Case coverage is asserted; no instrumented branch coverage percentage is claimed.
A later local experiment can add LLVM source coverage, separately from ASan.

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
and review before continuing. Stop before any upstream build until written
approval identifies a patched revision, local build configuration, public safe
regression inputs, resource limits and success criteria. No vulnerable-version
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
