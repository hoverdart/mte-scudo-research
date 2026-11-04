# Defensive pilot completion audit

The authorized goal was measurable defensive research within the existing safety
boundaries. The raw notes also describe excluded exploit work. That work is not
an unmet pilot deliverable and has not been implemented. This audit establishes
the defensive pilot's results, not the full exploit plan or general model equivalence.

| Requirement | Evidence inspected | Result |
| --- | --- | --- |
| Explicit cybersecurity purpose; no prompt concealment | `docs/PROMPTING.md`, exact benchmark prompts in `docs/results/requests.json` | Purpose and exclusions are explicit |
| Small deterministic programs and reachable behavior | Three source fixtures, trusted hex driver, `artifacts/benchmark/oracle.json` | Outputs correct; 10/10, 10/10, 14/14 branch outcomes |
| Safe regression tests and independent scoring | `tests/benchmark.test.mjs`, saved per-request `measurement.json` and `coverage.json` | Wrong expected outputs and a missing branch are detected by negative tests |
| Frugal cheaper/stronger comparison | Frozen protocol; paired request prompt/source hashes; score report | Three matched tasks per Haiku/Sonnet, one adaptive Opus task; no retries |
| Log every paid request and spend | Ten raw local archives; ten committed redacted records; ledger | $0.053378 total, zero unknown costs; earlier prose trials separate from benchmark |
| Advance model only when justified | Record-task Sonnet failure, then one Opus request | Escalation logged; Opus still had wrong predictions; no repeated escalation |
| Safe allocation observability and detector check | Lifetime and detector records, C sources, observability test | Real safe lifetime sequence passes; arithmetic UBSan positive control detected |
| Current maintained local dav1d work | Pinned source, six header tests, lifecycle and eight media records | ASan/UBSan pass; 16 ordinary decodes; sizes/pixels/repeated hashes verified |
| Current maintained local Skia work | Pinned source and dependencies, GN config, compile-command sanitizer flags, native runner record | CPU raster and PNG round trips pass at three sizes twice |
| Patch/class reading and temporal candidate | `docs/PATCH_REVIEW.md`, local ancestor checks, vendor advisory | Two dav1d fixes classified; CVE-2025-0444 verified as temporal literature candidate; no CVE reproduction claim |
| Repeatable records and artifacts | Source/input hashes, revision/dirty state, tool flags, statuses and logs | Preserved locally; committed redacted evidence and restoration path |
| Reproduce without more credits | Fresh temporary workspace restored all ten redacted records; reran oracle/scoring | Exact grouped scores and $0.053378 ledger reproduced; no credentials/provider calls |
| Verification and limitations | `npm test`, `npm run check`, library records and final report | 38 tests and syntax checks pass; limitations are explicit |
| Stop and safety rules | Root scope, protocol ceiling, schema checks, timeout/status handling | No corruption, reclaim, targets, bypasses, kernel/drivers or live devices; no model code executed |

The fresh-workspace replay record is `artifacts/offline-replay.json`; restoration
idempotence and tampering checks are also covered by the automated test suite.
The final machine report checks oracle hashes, matching paired prompts, library
pass states, exact request count, known costs and pilot ceiling before writing.

MTE/Scudo measurements, library-wide coverage and CVE regression reproduction
were not performed and are not claimed. They would be distinct studies requiring
their own actual supported configuration and concrete protocol. The pilot is
complete with a negative result on reliable model replacement: no statistical
or Android-exploitation conclusion follows from it.
