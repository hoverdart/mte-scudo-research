# Safe execution-path experiment

This repository implements a defensive cybersecurity pilot: reproducible safe C
path tests, sanitizer diagnostics, ordinary local library tests and a frugal
model comparison. The source notes also discussed exploit development; those
parts are deliberately outside the authorized implementation.

The completed measured work is described in
[EXPERIMENT_SCOPE.md](EXPERIMENT_SCOPE.md) and the
[result report](research-desk/docs/results/REPORT.md). Models propose bounded
hex-byte test inputs; a trusted local runner checks their predictions and measures
LLVM branch outcomes. No model code is executed. Pinned maintained dav1d and
native CPU-only Skia builds process only ordinary generated inputs.

The local lifetime fixture never accesses freed storage or tests reclaim. The
sanitizer positive control is fixed arithmetic overflow, not memory corruption.
Public patch reading classifies defensive fixes without reconstructing primitives
or target objects. No vulnerable-version comparison or CVE reproduction is used.

Never disguise the research purpose or ask models to bypass provider safeguards.
Do not add corruption characterization, reclaim strategies, permission-related
objects, escalation, sandbox escape, privileged services, drivers, kernels or
live devices to these experiments. Scope changes need a concrete reviewed plan.

Stop on unexpected sanitizer diagnostics, crashes, timeouts, compiler/test
failures, pixel mismatches, API errors/truncation, or changed upstream revisions.
Preserve source/input hashes, revision, settings, termination status and logs.
Model mistakes remain recorded outcomes; never weaken tests to make them pass.
A crash is not proof of exploitability.

Credentials stay in ignored local `.env` files. The model request archive and
cost ledger record usage without credentials; unknown costs halt further
benchmark calls. The completed pilot cost $0.053378 across ten requests. No
further paid calls are needed for offline reproduction. See
[REPRODUCE.md](research-desk/docs/REPRODUCE.md).
