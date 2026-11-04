# Three expansion tracks — November 4, 2026

All three local tracks completed with separate evidence. No corruption/reclaim,
target-object, privilege, driver or live-device experiment was added.

## 1. Actual library execution coverage

| Local corpus/build | Covered mapped branch outcomes | Coverage |
| --- | ---: | ---: |
| dav1d: eight ordinary black clips | 1935/8927 | 21.68% |
| dav1d: those clips plus one textured six-frame clip | 3104/8927 | 34.77% |
| Skia: three known-color raster/PNG round trips | 1210/49374 | 2.45% |

The dav1d addition gained 1169 mapped branch outcomes and
raised mapped source-function coverage from 193/423 to 257/423. Newly executed
entries include CDEF filtering and directional intra-prediction helpers. There
are 82 newly executed exported function entries; this
is a different instantiation/mapping count from the file-summary function metric.
Skia executed 599/10995 mapped source functions, including raster and PNG codec
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
| claude-haiku-4.5 | 4/4 | no (outer fence) | $0.003493 |
| claude-sonnet-4.5 | 4/4 | no (outer fence) | $0.009279 |

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

Two new requests cost **$0.012772**. Cumulative harness usage is
**$0.066150 across 12 requests**, with no unknown costs.
The original pilot's report remains a separate ten-request snapshot.
Exact nonsecret requests/responses and summarized measurements are in
[results.json](results.json); full command records are under artifacts/expansion/.

From research-desk, with the previous pinned library dependencies prepared:

```sh
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
```

Only allocator preparation downloads container dependencies. None of these
commands makes a paid model request. The two upstream requests are already
archived and the request script rejects duplicates. Query executed functions
with npm run paths:list -- dav1d cdef, or add an empty/literal filter and
--uncovered to inspect gaps. Do not infer a CVE reproduction or mitigation
strength from these safe successful-path observations.

The next small coverage step can add ordinary image transforms/alpha paths and
ordinary decoder content guided by the uncovered-function lists. A separate
supported MTE environment would be required before any MTE measurements.
