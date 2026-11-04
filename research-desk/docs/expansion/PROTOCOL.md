# Three small expansion tracks

1. Measure actual pinned dav1d source coverage, separately from sanitizer builds.
   Compare the existing ordinary clips with an ordinary textured multi-frame clip.
   Report executed functions and branch outcomes; do not infer call edges from
   function counts or claim complete path coverage.
2. Ask Haiku 4.5 and Sonnet 4.5 once each about a small pinned upstream data-lifetime
   API exercise. Compare predicted callback events with the trusted local runner.
   Only valid documented API use, no generated code, malformed input or reuse.
   Keep request/response records and costs in the existing ledger. Cap output at
   1000 tokens and cumulative harness spend at $0.25 for this expansion; no retries.
3. Record safe malloc/calloc/realloc/free events and allocator statistics. Probe
   Scudo support and MTE capability/configuration read-only. Use a local disposable
   Linux userspace container if available; no privileged container, device access,
   pointer addresses, allocator reclaim, tag manipulation or permission changes.
   Absence of MTE support is an environment finding, not a mitigation result.

All steps preserve source revision, dirty state, compiler settings, hashes,
commands, exit statuses and logs. Timeouts and unexpected sanitizer diagnostics
stop the relevant track. Dependencies may be downloaded during preparation; all
actual tests run locally with network disabled where containerized. Results and
limitations are reported separately so one track's evidence does not substitute
for another's.
