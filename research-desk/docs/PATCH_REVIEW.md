# Defensive patch and background review

This review classifies defects and identifies defensive evidence. It does not
characterize corruption primitives, object reclaim, target selection or escalation.

| Source | Verified observation | Consequence for this study |
| --- | --- | --- |
| [dav1d bounds fix](https://github.com/videolan/dav1d/commit/d7a83f6e0f9360188a38ceae0883f3d132d87b47) | Upstream classifies an x86 high-bit-depth SGR assembly read as out of bounds; the repair constrains an edge read. | Spatial read defect, not evidence of a UAF or write. The pinned checkout contains the fix, but our ARM64 C-only build does not execute that assembly and is not its regression reproduction. |
| [dav1d failure-state repair](https://github.com/videolan/dav1d/commit/9143ecbe6d25e0f0c3fe95642525138fc1466500) | The repair clears tile-state count when replacement allocation fails before taking the error path. | State/count consistency during failure cleanup. Ordinary successful decodes do not test allocation-failure handling. Do not assign a CVE or temporal class from this diff alone. |
| [Chrome 133 security announcement](https://chromereleases.googleblog.com/2025/02/stable-channel-update-for-desktop.html?m=1) | Google identifies CVE-2025-0444 as use after free in Skia and announces fixed Chrome builds. | A verified temporal-safety literature candidate. Our generated PNG/raster tests do not reproduce this CVE; the advisory alone does not map the exact Skia fixing commit. |

Both dav1d commits were inspected locally and verified as ancestors of pinned
`e5af12796d46cd7788e5f5349da1a27c5f7a8f1a` using `git merge-base --is-ancestor`.
The working tree was not switched to an older build. Patch texts and lineage
checks are retained locally in `artifacts/literature/patch-record.json`.

[Project Zero's MTE case studies](https://projectzero.google/2023/08/mte-as-implemented-part-2-mitigation.html)
explain why mitigation conclusions depend on implementation and deployment
context. The measurement lesson here is to record actual fault mode, allocator,
hardware and instrumentation, and separate those observations from claims about
security outcomes. Our macOS sanitizer results establish no MTE or Scudo result.
This is a defensive reading summary, not an end-to-end exploitation study.

The [xairy bibliography](https://github.com/xairy/linux-kernel-exploitation) is a
collection of security references rather than evidence about these library
builds. It is recorded for attribution to the original notes; no kernel or
live-device experiment is derived from it.

A clean run of ordinary inputs does not prove an upstream library has no defects.
A sanitizer report, if encountered later, is a diagnostic requiring review; it
would not establish exploitability. Existing library tests here exercise a small
set of successful paths and do not supply library-wide branch coverage.
